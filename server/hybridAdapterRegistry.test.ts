import { describe, expect, it } from "vitest";
import { getHybridAdapterProfile } from "./hybridAdapterRegistry";

describe("hybrid AMC retrieval adapter registry", () => {
  it("uses verified snapshot guidance for repaired or opaque document sources", () => {
    expect(getHybridAdapterProfile("hdfc")).toMatchObject({ method: "official_public_feed", allowGenericFallback: true });
    expect(getHybridAdapterProfile("sbi")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("groww")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("helios")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("hsbc")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("invesco")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("iti")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("lic")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("mahindra-manulife")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("icici-prudential")).toMatchObject({ method: "official_public_feed", allowGenericFallback: true });
    expect(getHybridAdapterProfile("pgim-india")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("taurus")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("trust")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("wealth-company")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("jio-blackrock")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("motilal-oswal")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("nippon-india")).toMatchObject({ method: "official_public_feed", allowGenericFallback: true });
    expect(getHybridAdapterProfile("quantum")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("samco")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("bank-of-india")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("bandhan")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("union")).toMatchObject({ method: "verified_snapshot", allowGenericFallback: true });
    expect(getHybridAdapterProfile("mirae-asset")).toMatchObject({ method: "official_public_feed", allowGenericFallback: true });
    expect(getHybridAdapterProfile("franklin-templeton")).toMatchObject({ method: "official_public_feed", allowGenericFallback: true });
    expect(getHybridAdapterProfile("sundaram")).toMatchObject({ method: "official_public_feed", allowGenericFallback: true });
    expect(getHybridAdapterProfile("whiteoak-capital")).toMatchObject({ method: "dynamic_metadata", allowGenericFallback: true });
  });

  it("returns approved-access guidance instead of generic scraping for protected source profiles", () => {
    const edelweiss = getHybridAdapterProfile("edelweiss");
    expect(edelweiss).toMatchObject({ method: "approved_access_required", allowGenericFallback: false });
    expect(edelweiss.guidance).toContain("allowlisting");
  });

  it("keeps an explicit generic profile for AMCs without a special adapter", () => {
    expect(getHybridAdapterProfile("abakkus")).toMatchObject({ method: "generic_registry", allowGenericFallback: true });
  });
});
