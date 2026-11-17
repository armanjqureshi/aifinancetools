import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnvironment = { ...process.env };

beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-hs256-signing";
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...originalEnvironment };
  vi.resetModules();
});

describe("self-hosted authentication", () => {
  it("hashes passwords with a per-password salt and verifies them", async () => {
    const { hashPassword, verifyPassword } = await import("./_core/auth");
    const first = await hashPassword("correct horse battery");
    const second = await hashPassword("correct horse battery");
    expect(first).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(first).not.toBe(second);
    await expect(verifyPassword("correct horse battery", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong password!!", first)).resolves.toBe(false);
    await expect(verifyPassword("anything", null)).resolves.toBe(false);
  });

  it("refuses short passwords", async () => {
    const { hashPassword } = await import("./_core/auth");
    await expect(hashPassword("short")).rejects.toThrow(/at least 10/);
  });

  it("signs and verifies session tokens, rejecting tampered or foreign ones", async () => {
    const { createSessionToken, verifySessionToken } = await import("./_core/auth");
    const token = await createSessionToken("pw_abc");
    await expect(verifySessionToken(token)).resolves.toBe("pw_abc");
    await expect(verifySessionToken(`${token.slice(0, -2)}xx`)).resolves.toBeNull();
    await expect(verifySessionToken(undefined)).resolves.toBeNull();

    process.env.JWT_SECRET = "a-completely-different-secret-value-of-good-length";
    vi.resetModules();
    const other = await import("./_core/auth");
    await expect(other.verifySessionToken(token)).resolves.toBeNull();
  });

  it("refuses to sign sessions without a strong JWT_SECRET", async () => {
    process.env.JWT_SECRET = "short";
    vi.resetModules();
    const { createSessionToken } = await import("./_core/auth");
    await expect(createSessionToken("pw_abc")).rejects.toThrow(/JWT_SECRET/);
  });

  it("throttles repeated failed sign-ins for the same IP and email", async () => {
    const { isSignInThrottled, recordFailedSignIn, clearSignInAttempts } = await import("./_core/auth");
    const key = "1.2.3.4|someone@example.com";
    for (let i = 0; i < 8; i++) recordFailedSignIn(key);
    expect(isSignInThrottled(key)).toBe(true);
    clearSignInAttempts(key);
    expect(isSignInThrottled(key)).toBe(false);
  });

  it("defaults to no sign-in in LOCAL_MODE and password sign-in otherwise", async () => {
    process.env.LOCAL_MODE = "true";
    delete process.env.AUTH_MODE;
    vi.resetModules();
    expect((await import("./_core/env")).ENV.authMode).toBe("none");

    process.env.LOCAL_MODE = "false";
    vi.resetModules();
    expect((await import("./_core/env")).ENV.authMode).toBe("password");
  });
});
