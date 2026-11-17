import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getAmcBySlug,
  getDb,
  listAmcSources,
  normalizeSchemeName,
  searchAmcDirectory,
  searchSchemeCatalog,
  seedAmcRegistry,
  updateAmcSource,
  upsertSchemeCatalogEntry,
} from "../db";
import { REGISTERED_AMC_SOURCES } from "../amcRegistrySeed";
import { discoverAllAmcSchemes } from "../amcSourceDiscovery";
import { amcSources, amcs } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const sourceKind = z.enum(["page", "direct_pdf"]);
const documentScope = z.enum(["unknown", "amc", "scheme", "both"]);
const discoveryMode = z.enum(["html", "dynamic", "selector", "direct", "manual"]);

export const amcsRouter = router({
  listSources: protectedProcedure.query(() => listAmcSources()),

  seedProvidedSources: protectedProcedure.mutation(async () => {
    await seedAmcRegistry(REGISTERED_AMC_SOURCES);
    return { success: true, count: REGISTERED_AMC_SOURCES.length };
  }),

  discoverSchemes: protectedProcedure.mutation(async () => {
    const results = await discoverAllAmcSchemes();
    const total = results.reduce((sum, result) => sum + result.discovered, 0);
    return { success: true, amcsProcessed: results.length, totalDiscovered: total, details: results };
  }),

  updateSource: protectedProcedure
    .input(z.object({
      id: z.number(),
      sourceUrl: z.string().url().optional(),
      sourceKind: sourceKind.optional(),
      documentScope: documentScope.optional(),
      discoveryMode: discoveryMode.optional(),
      notes: z.string().max(2000).nullable().optional(),
      priority: z.number().int().min(1).max(99).optional(),
      isActive: z.number().int().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateAmcSource(id, data);
      return { success: true };
    }),

  searchSchemes: protectedProcedure
    .input(z.object({ query: z.string().min(2).max(256), limit: z.number().int().min(1).max(50).optional() }))
    .query(async ({ input }) => {
      const [schemes, matchingAmcs] = await Promise.all([
        searchSchemeCatalog(input.query, input.limit ?? 25),
        searchAmcDirectory(input.query, 10),
      ]);
      return { query: input.query, normalizedQuery: normalizeSchemeName(input.query), schemes, matchingAmcs };
    }),

  addManualScheme: protectedProcedure
    .input(z.object({
      amcSlug: z.string().min(2).max(96),
      name: z.string().min(3).max(256),
      schemeCode: z.string().max(64).optional(),
      isin: z.string().max(20).optional(),
      factsheetUrl: z.string().url().optional(),
    }))
    .mutation(async ({ input }) => {
      const amc = await getAmcBySlug(input.amcSlug);
      if (!amc) throw new TRPCError({ code: "NOT_FOUND", message: "AMC not found in the registry." });
      const id = await upsertSchemeCatalogEntry({
        amcId: amc.id,
        name: input.name,
        normalizedName: normalizeSchemeName(input.name),
        schemeCode: input.schemeCode ?? null,
        isin: input.isin ?? null,
        factsheetUrl: input.factsheetUrl ?? null,
        sourceType: "manual",
        isActive: 1,
      });
      return { id, amcName: amc.name };
    }),
});
