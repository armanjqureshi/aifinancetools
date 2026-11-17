import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

let localDirectory = "";
const originalEnvironment = { ...process.env };

beforeEach(async () => {
  localDirectory = await mkdtemp(path.join(tmpdir(), "mf-factsheet-local-storage-"));
  process.env.LOCAL_MODE = "true";
  process.env.LOCAL_STORAGE_DIR = localDirectory;
  process.env.LOCAL_APP_ORIGIN = "http://localhost:3000";
  vi.resetModules();
});

afterEach(async () => {
  process.env = { ...originalEnvironment };
  vi.resetModules();
  await rm(localDirectory, { recursive: true, force: true });
});

describe("local-mode storage", () => {
  it("writes cached PDFs to disk and exposes them only through the /files/ route", async () => {
    const { storageGetSignedUrl, storagePut, readPdfBytes, keyFromFileRouteUrl } = await import("./storage");
    const stored = await storagePut("factsheets/test/latest.pdf", Buffer.from("%PDF-local"), "application/pdf");

    expect(stored.key).toMatch(/^factsheets\/test\/latest_[a-f0-9]{8}\.pdf$/);
    expect(stored.url).toBe(`/files/${stored.key}`);
    await expect(storageGetSignedUrl(stored.key)).resolves.toBe(stored.url);
    expect(keyFromFileRouteUrl(stored.url)).toBe(stored.key);
    expect(Buffer.from(await readPdfBytes(stored.url)).toString()).toBe("%PDF-local");
  });

  it("rejects keys that try to leave the storage folder", async () => {
    const { storagePut, keyFromFileRouteUrl } = await import("./storage");
    await expect(storagePut("../outside.pdf", Buffer.from("x"))).rejects.toThrow(/Invalid storage key/);
    expect(keyFromFileRouteUrl("/files/%2e%2e/secret")).toBeUndefined();
    expect(keyFromFileRouteUrl("/local-storage/a.pdf")).toBeUndefined();
  });
});
