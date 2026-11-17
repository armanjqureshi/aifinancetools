export type ManualAllocation = { label: string; percentage: number };

export function parseManualAllocations(value: string): ManualAllocation[] {
  const rows = value
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)(?:\s*[:,-]\s*)(\d+(?:\.\d+)?)\s*%?$/);
      if (!match) throw new Error(`Use “Label: percentage” for each allocation. Could not read: ${line}`);
      const label = match[1].trim();
      const percentage = Number(match[2]);
      if (!label || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) throw new Error(`Invalid allocation: ${line}`);
      return { label, percentage };
    });
  if (rows.length === 0) throw new Error("Enter at least one allocation.");
  return rows;
}
