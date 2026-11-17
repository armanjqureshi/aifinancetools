import { readFile } from "node:fs/promises";
const outcomes = (await readFile(new URL("../current_revalidation_outcomes.jsonl", import.meta.url), "utf8"))
  .split("\n").map((line) => line.trim()).filter(Boolean).map((line) => JSON.parse(line));
for (const item of outcomes) if (item.status === "worker_timeout_or_error") console.log(item.slug);
