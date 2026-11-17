import { describe, expect, it } from "vitest";
import { getCachedPdfTextPages, primeCachedPdfTextPages } from "./pdfPageCache";

describe("PDF page cache", () => {
  it("reuses pages primed from acquisition when the signed URL changes", async () => {
    const pages = [{ num: 7, text: "HDFC Flexi Cap Fund" }];
    primeCachedPdfTextPages("file:factsheets/hdfc/july.pdf", pages);

    const result = await getCachedPdfTextPages(
      "https://storage.example.test/factsheets/hdfc/july.pdf?signature=rotated-token",
      "file:factsheets/hdfc/july.pdf",
    );

    expect(result).toEqual(pages);
  });
});
