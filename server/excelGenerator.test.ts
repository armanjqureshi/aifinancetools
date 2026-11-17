import { describe, expect, it } from "vitest";
import { generateExcel } from "./excelGenerator";

describe("generateExcel", () => {
  it("generates a valid Excel buffer", async () => {
    const funds = [
      {
        fundName: "HDFC Flexi Cap Fund",
        fundHouse: "HDFC",
        sectorAllocations: [
          { label: "Financial Services", percentage: 28.5 },
          { label: "IT", percentage: 15.2 },
          { label: "Healthcare", percentage: 10.1 },
        ],
        assetAllocations: [
          { label: "Equity", percentage: 95.3 },
          { label: "Cash", percentage: 4.7 },
        ],
      },
      {
        fundName: "Axis Bluechip Fund",
        fundHouse: "Axis",
        sectorAllocations: [
          { label: "Financial Services", percentage: 30.0 },
          { label: "Consumer Goods", percentage: 12.5 },
        ],
        assetAllocations: [
          { label: "Equity", percentage: 97.0 },
          { label: "Cash", percentage: 3.0 },
        ],
      },
    ];

    const buffer = await generateExcel(funds, new Date("2026-08-01"));
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
    // Excel files start with PK (ZIP format)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4b); // K
  });

  it("handles empty fund list", async () => {
    const buffer = await generateExcel([], new Date());
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("handles funds with no allocations", async () => {
    const funds = [
      { fundName: "Test Fund", fundHouse: "Unknown", sectorAllocations: [], assetAllocations: [] },
    ];
    const buffer = await generateExcel(funds, new Date());
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

