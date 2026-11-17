import { seedAmcRegistry } from "../server/db.ts";
import { REGISTERED_AMC_SOURCES } from "../server/amcRegistrySeed.ts";

await seedAmcRegistry(REGISTERED_AMC_SOURCES);
console.log(`Seeded ${REGISTERED_AMC_SOURCES.length} AMC sources.`);
