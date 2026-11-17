// Create a sign-in account, or reset an existing account's password.
//
//   pnpm user:create --email person@1finance.co.in --name "Person" [--admin]
//
// The password is read from the NEW_USER_PASSWORD environment variable, or
// typed at the prompt (it is not echoed and never passed on the command line).
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { upsertPasswordUser, MIN_PASSWORD_LENGTH } from "../server/_core/auth.ts";
import { getDb } from "../server/db.ts";

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, admin: { type: "boolean", default: false } },
});
if (!values.email) {
  console.error('Usage: pnpm user:create --email person@example.com [--name "Name"] [--admin]');
  process.exit(1);
}
if (!(await getDb())) {
  console.error("DATABASE_URL is not set or the database is unreachable.");
  process.exit(1);
}

async function promptHidden(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  rl._writeToOutput = (text) => { if (text.includes(question)) process.stdout.write(text); };
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  process.stdout.write("\n");
  return answer;
}

const password = process.env.NEW_USER_PASSWORD ?? await promptHidden(`Password (min ${MIN_PASSWORD_LENGTH} characters): `);
try {
  const user = await upsertPasswordUser({ email: values.email, name: values.name ?? null, password, role: values.admin ? "admin" : "user" });
  console.log(`Saved ${user?.role} account ${user?.email}.`);
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
