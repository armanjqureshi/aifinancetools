export const DAILY_RETRY_SOURCES: Record<string, "timed_out" | "unavailable"> = {
  abakkus: "timed_out",
  "aditya-birla": "timed_out",
  "angel-one": "timed_out",
  "bajaj-finserv": "timed_out",
  capitalmind: "timed_out",
  quant: "timed_out",
  sbi: "unavailable",
};

export function isDailyRetryEligible(slug: string) {
  return DAILY_RETRY_SOURCES[slug] !== undefined;
}
