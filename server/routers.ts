import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  clearSignInAttempts,
  createSessionToken,
  isSignInThrottled,
  normalizeEmail,
  recordFailedSignIn,
  upsertPasswordUser,
  verifyPassword,
} from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { getUserByEmail, listUsers, upsertUser } from "./db";
import { factsheetsRouter } from "./routers/factsheets";

export const appRouter = router({
  system: systemRouter,
  factsheets: factsheetsRouter,
  // Retained for internal compatibility while the client uses only factsheets.
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user
      ? { id: opts.ctx.user.id, name: opts.ctx.user.name, email: opts.ctx.user.email, role: opts.ctx.user.role, loginMethod: opts.ctx.user.loginMethod }
      : null),
    mode: publicProcedure.query(() => ({ authMode: ENV.authMode })),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().min(3).max(320), password: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        if (ENV.authMode !== "password") return { success: true as const };
        const email = normalizeEmail(input.email);
        const throttleKey = `${ctx.req.ip ?? "unknown"}|${email}`;
        if (isSignInThrottled(throttleKey)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Try again in 15 minutes." });
        }
        const user = await getUserByEmail(email);
        const ok = await verifyPassword(input.password, user?.passwordHash);
        if (!user || !ok) {
          recordFailedSignIn(throttleKey);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
        }
        clearSignInAttempts(throttleKey);
        await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const token = await createSessionToken(user.openId);
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
        return { success: true as const };
      }),
    listUsers: adminProcedure.query(() => listUsers()),
    createUser: adminProcedure
      .input(z.object({ email: z.string().trim().email().max(320), name: z.string().trim().max(120).optional(), password: z.string().min(10).max(200), role: z.enum(["user", "admin"]).default("user") }))
      .mutation(async ({ input }) => {
        if (ENV.authMode !== "password") throw new TRPCError({ code: "BAD_REQUEST", message: "Accounts are only used when AUTH_MODE=password." });
        const user = await upsertPasswordUser(input);
        return { id: user?.id, email: user?.email, role: user?.role };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
