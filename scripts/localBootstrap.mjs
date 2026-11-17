import { amfiClassificationSnapshots } from "../drizzle/schema.ts";
import { seedAmcRegistry, upsertUser, getDb } from "../server/db.ts";
import { REGISTERED_AMC_SOURCES } from "../server/amcRegistrySeed.ts";
import { AMFI_JULY_2026_SOURCE, importAmfiClassificationWorkbook } from "../server/amfiClassificationService.ts";

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required for local bootstrap.");

await seedAmcRegistry(REGISTERED_AMC_SOURCES);
await upsertUser({
  openId: "local-admin",
  name: "Local Administrator",
  email: null,
  loginMethod: "local",
  role: "admin",
  lastSignedIn: new Date(),
});

const existingSnapshot = (await db.select({ id: amfiClassificationSnapshots.id }).from(amfiClassificationSnapshots).limit(1))[0];
if (!existingSnapshot && process.env.LOCAL_SKIP_AMFI !== "true") {
  try {
    const response = await fetch(AMFI_JULY_2026_SOURCE);
    if (!response.ok) throw new Error(`AMFI workbook request failed with ${response.status}`);
    const workbookBuffer = Buffer.from(await response.arrayBuffer());
    const result = await importAmfiClassificationWorkbook({
      workbookBuffer,
      effectiveFrom: new Date("2026-07-01T00:00:00.000Z"),
      sourceUrl: AMFI_JULY_2026_SOURCE,
      sourceLabel: "AMFI Categorisation of Large, Mid and Small Cap Stocks — 30 June 2026",
    });
    console.log(`Imported local AMFI snapshot ${result.snapshotId} with ${result.securityCount} securities.`);
  } catch (error) {
    console.warn("AMFI seed import was skipped. The app will run, but holdings-based market-cap fallback remains unavailable until an official snapshot is imported.", error);
  }
}

console.log(`Local bootstrap complete: ${REGISTERED_AMC_SOURCES.length} AMC sources seeded.`);
