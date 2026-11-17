import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  listMutualFunds,
  insertMutualFund,
  updateMutualFund,
  deleteMutualFund,
  getAmcBySlug,
  getMutualFundById,
  normalizeSchemeName,
  upsertSchemeCatalogEntry,
} from "../db";
import { detectFundHouse, getRegisteredAmcSlug } from "../fundHouseDetector";

export const fundsRouter = router({
  list: protectedProcedure.query(async () => {
    return listMutualFunds();
  }),

  add: protectedProcedure
    .input(
      z.object({
        name: z.string().min(3).max(256),
        isin: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await listMutualFunds();
      if (existing.length >= 40) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Maximum of 40 funds allowed.",
        });
      }
      const fundHouse = detectFundHouse(input.name);
      const registrySlug = getRegisteredAmcSlug(fundHouse);
      const amc = registrySlug ? await getAmcBySlug(registrySlug) : undefined;
      const schemeCatalogId = amc
        ? await upsertSchemeCatalogEntry({
            amcId: amc.id,
            name: input.name,
            normalizedName: normalizeSchemeName(input.name),
            isin: input.isin ?? null,
            sourceType: "fund_list",
            isActive: 1,
          })
        : null;
      const id = await insertMutualFund({
        name: input.name,
        fundHouse,
        isin: input.isin,
        amcId: amc?.id ?? null,
        schemeCatalogId,
        isActive: 1,
      });
      return { id, fundHouse };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(3).max(256),
        isin: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const fund = await getMutualFundById(input.id);
      if (!fund) throw new TRPCError({ code: "NOT_FOUND" });
      const fundHouse = detectFundHouse(input.name);
      const registrySlug = getRegisteredAmcSlug(fundHouse);
      const amc = registrySlug ? await getAmcBySlug(registrySlug) : undefined;
      const schemeCatalogId = amc
        ? await upsertSchemeCatalogEntry({
            amcId: amc.id,
            name: input.name,
            normalizedName: normalizeSchemeName(input.name),
            isin: input.isin ?? null,
            sourceType: "fund_list",
            isActive: 1,
          })
        : fund.schemeCatalogId;
      await updateMutualFund(input.id, { name: input.name, fundHouse, isin: input.isin, amcId: amc?.id ?? fund.amcId, schemeCatalogId });
      return { fundHouse };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteMutualFund(input.id);
      return { success: true };
    }),

  detectHouse: protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(({ input }) => {
      return { fundHouse: detectFundHouse(input.name) };
    }),
});
