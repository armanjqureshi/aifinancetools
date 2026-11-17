import { describe, expect, it } from "vitest";
import { detectFundHouse } from "./fundHouseDetector";

describe("detectFundHouse", () => {
  it("detects HDFC from fund name", () => {
    expect(detectFundHouse("HDFC Flexi Cap Fund")).toBe("HDFC");
    expect(detectFundHouse("HDFC Top 100 Fund")).toBe("HDFC");
    expect(detectFundHouse("HDFC Mid-Cap Opportunities Fund")).toBe("HDFC");
  });

  it("detects ICICI Prudential from fund name", () => {
    expect(detectFundHouse("ICICI Prudential Bluechip Fund")).toBe("ICICI Prudential");
    expect(detectFundHouse("ICICI Pru Large & Mid Cap Fund")).toBe("ICICI Prudential");
  });

  it("detects Axis from fund name", () => {
    expect(detectFundHouse("Axis Bluechip Fund")).toBe("Axis");
    expect(detectFundHouse("Axis Small Cap Fund")).toBe("Axis");
  });

  it("detects SBI from fund name", () => {
    expect(detectFundHouse("SBI Bluechip Fund")).toBe("SBI");
    expect(detectFundHouse("SBI Magnum Midcap Fund")).toBe("SBI");
  });

  it("detects Aditya Birla from fund name", () => {
    expect(detectFundHouse("Aditya Birla Sun Life Frontline Equity Fund")).toBe("Aditya Birla");
    expect(detectFundHouse("ABSL Tax Relief 96 Fund")).toBe("Aditya Birla");
  });

  it("detects Kotak from fund name", () => {
    expect(detectFundHouse("Kotak Flexicap Fund")).toBe("Kotak");
  });

  it("detects UTI from fund name", () => {
    expect(detectFundHouse("UTI Flexi Cap Fund")).toBe("UTI");
  });

  it("detects Nippon India from fund name", () => {
    expect(detectFundHouse("Nippon India Growth Fund")).toBe("Nippon India");
  });

  it("detects Mirae Asset from fund name", () => {
    expect(detectFundHouse("Mirae Asset Large Cap Fund")).toBe("Mirae Asset");
  });

  it("returns Unknown for unrecognized fund", () => {
    expect(detectFundHouse("Some Random Fund XYZ")).toBe("Unknown");
  });

  it("is case-insensitive", () => {
    expect(detectFundHouse("hdfc flexi cap fund")).toBe("HDFC");
    expect(detectFundHouse("AXIS BLUECHIP FUND")).toBe("Axis");
  });
});
