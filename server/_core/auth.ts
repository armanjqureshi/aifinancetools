// Self-hosted authentication. Replaces the former hosted OAuth SDK.
//
// AUTH_MODE=none      Every request is the single local administrator. For a
//                     laptop install that nobody else can reach.
// AUTH_MODE=password  Email + password accounts stored in the users table.
//                     Sessions are signed JWTs in an httpOnly cookie.

import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const LOCAL_ADMIN_OPEN_ID = "local-admin";
const SESSION_ISSUER = "mf-factsheet-bot";
export const MIN_PASSWORD_LENGTH = 10;

// ── Passwords ────────────────────────────────────────────────────────────────

/** scrypt$<salt hex>$<hash hex> */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// ── Sessions ─────────────────────────────────────────────────────────────────

function sessionSecret() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createSessionToken(openId: string, expiresInMs = ONE_YEAR_MS): Promise<string> {
  return new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + expiresInMs) / 1000))
    .sign(sessionSecret());
}

export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"], issuer: SESSION_ISSUER });
    return typeof payload.openId === "string" && payload.openId.length > 0 ? payload.openId : null;
  } catch {
    return null;
  }
}

// ── Request authentication ───────────────────────────────────────────────────

async function getOrCreateLocalAdmin(): Promise<User> {
  let user = await db.getUserByOpenId(LOCAL_ADMIN_OPEN_ID);
  if (!user) {
    await db.upsertUser({ openId: LOCAL_ADMIN_OPEN_ID, name: "Local Administrator", email: null, loginMethod: "local", role: "admin", lastSignedIn: new Date() });
    user = await db.getUserByOpenId(LOCAL_ADMIN_OPEN_ID);
  }
  if (!user) throw ForbiddenError("Unable to initialise the local administrator");
  return user;
}

export async function authenticateRequest(req: Request): Promise<User> {
  if (ENV.authMode === "none") return getOrCreateLocalAdmin();

  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  const openId = await verifySessionToken(token);
  if (!openId) throw ForbiddenError("Invalid session");
  const user = await db.getUserByOpenId(openId);
  if (!user || !user.passwordHash) throw ForbiddenError("User not found");
  return user;
}

// ── Sign-in throttling (per IP + email, in memory) ───────────────────────────

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function isSignInThrottled(key: string) {
  const entry = attempts.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS);
}

export function recordFailedSignIn(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
  if (attempts.size > 10_000) {
    for (const [k, v] of Array.from(attempts.entries())) if (v.resetAt <= now) attempts.delete(k);
  }
}

export function clearSignInAttempts(key: string) {
  attempts.delete(key);
}

// ── Accounts ─────────────────────────────────────────────────────────────────

/** Create a password account, or reset its password/role if the email exists. */
export async function upsertPasswordUser(input: { email: string; password: string; name?: string | null; role?: "user" | "admin" }) {
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const passwordHash = await hashPassword(input.password);
  const existing = await db.getUserByEmail(email);
  const openId = existing?.openId ?? `pw_${randomBytes(12).toString("hex")}`;
  await db.upsertUser({ openId, email, name: input.name ?? existing?.name ?? email.split("@")[0], loginMethod: "password", role: input.role ?? existing?.role ?? "user", lastSignedIn: existing?.lastSignedIn ?? new Date() });
  await db.setUserPasswordHash(openId, passwordHash);
  return db.getUserByOpenId(openId);
}

/** At start-up, create the first administrator from ADMIN_EMAIL / ADMIN_PASSWORD if that account does not exist yet. */
export async function ensureAdminFromEnv() {
  if (ENV.authMode !== "password" || !ENV.adminEmail || !ENV.adminPassword) return;
  const existing = await db.getUserByEmail(normalizeEmail(ENV.adminEmail));
  if (existing?.passwordHash) return;
  await upsertPasswordUser({ email: ENV.adminEmail, password: ENV.adminPassword, name: "Administrator", role: "admin" });
  console.log(`[Auth] Created administrator account ${normalizeEmail(ENV.adminEmail)}`);
}
