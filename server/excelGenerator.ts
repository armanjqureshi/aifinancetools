/**
 * Excel Generator Service
 *
 * Consolidates sector and asset allocation data from all funds
 * into a single, well-formatted Excel workbook.
 */

import ExcelJS from "exceljs";

export interface FundAllocationData {
  fundName: string;
  fundHouse: string;
  sectorAllocations: { label: string; percentage: number }[];
  assetAllocations: { label: string; percentage: number }[];
  marketCapAllocations?: { label: string; percentage: number }[];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E3A5F" },
};

const SUBHEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2D5F8A" },
};

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F4F8" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
  name: "Calibri",
};

const BODY_FONT: Partial<ExcelJS.Font> = {
  size: 10,
  name: "Calibri",
};

const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD0D7E0" } },
  left: { style: "thin", color: { argb: "FFD0D7E0" } },
  bottom: { style: "thin", color: { argb: "FFD0D7E0" } },
  right: { style: "thin", color: { argb: "FFD0D7E0" } },
};

function applyHeaderStyle(cell: ExcelJS.Cell, isSubHeader = false) {
  cell.fill = isSubHeader ? SUBHEADER_FILL : HEADER_FILL;
  cell.font = HEADER_FONT;
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = BORDER;
}

function applyBodyStyle(cell: ExcelJS.Cell, rowIndex: number, isNumeric = false) {
  if (rowIndex % 2 === 0) {
    cell.fill = ALT_ROW_FILL;
  }
  cell.font = BODY_FONT;
  cell.border = BORDER;
  if (isNumeric) {
    cell.alignment = { horizontal: "right", vertical: "middle" };
    cell.numFmt = "0.00%";
  } else {
    cell.alignment = { horizontal: "left", vertical: "middle" };
  }
}

/**
 * Generate an Excel workbook with sector and asset allocation data.
 * Returns a Buffer containing the .xlsx file.
 */
export async function generateExcel(
  funds: FundAllocationData[],
  runDate: Date
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MF Factsheet Bot";
  workbook.created = runDate;
  workbook.modified = runDate;

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet("Summary", {
    properties: { tabColor: { argb: "FF1E3A5F" } },
  });

  summarySheet.mergeCells("A1:D1");
  const titleCell = summarySheet.getCell("A1");
  titleCell.value = "Mutual Fund Factsheet Report";
  titleCell.font = { bold: true, size: 16, name: "Calibri", color: { argb: "FF1E3A5F" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  summarySheet.getRow(1).height = 36;

  summarySheet.mergeCells("A2:D2");
  const dateCell = summarySheet.getCell("A2");
  dateCell.value = `Generated: ${runDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}`;
  dateCell.font = { size: 11, name: "Calibri", color: { argb: "FF666666" } };
  dateCell.alignment = { horizontal: "center" };
  summarySheet.getRow(2).height = 24;

  summarySheet.addRow([]);

  const summaryHeaders = ["#", "Fund Name", "Fund House", "Status"];
  const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
  summaryHeaderRow.height = 28;
  summaryHeaderRow.eachCell((cell) => applyHeaderStyle(cell));
  summarySheet.columns = [
    { key: "no", width: 6 },
    { key: "name", width: 45 },
    { key: "house", width: 22 },
    { key: "status", width: 16 },
  ];

  funds.forEach((fund, i) => {
    const row = summarySheet.addRow([
      i + 1,
      fund.fundName,
      fund.fundHouse,
      fund.sectorAllocations.length > 0 ? "✓ Extracted" : "⚠ No Data",
    ]);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      applyBodyStyle(cell, i, false);
      if (colNumber === 4) {
        cell.font = {
          ...BODY_FONT,
          color: {
            argb: fund.sectorAllocations.length > 0 ? "FF1A7A3C" : "FFC0392B",
          },
        };
      }
    });
  });

  // ── Sheet 2: Sector Allocation ────────────────────────────────────────────
  const sectorSheet = workbook.addWorksheet("Sector Allocation", {
    properties: { tabColor: { argb: "FF2D5F8A" } },
  });

  // Collect all unique sector labels
  const allSectors = Array.from(
    new Set(funds.flatMap((f) => f.sectorAllocations.map((s) => s.label)))
  ).sort();

  const sectorHeaders = ["Fund Name", "Fund House", ...allSectors];
  const sectorHeaderRow = sectorSheet.addRow(sectorHeaders);
  sectorHeaderRow.height = 36;
  sectorHeaderRow.eachCell((cell, colNumber) =>
    applyHeaderStyle(cell, colNumber > 2)
  );

  sectorSheet.getColumn(1).width = 45;
  sectorSheet.getColumn(2).width = 22;
  for (let i = 3; i <= sectorHeaders.length; i++) {
    sectorSheet.getColumn(i).width = 18;
  }

  funds.forEach((fund, i) => {
    const sectorMap = new Map(
      fund.sectorAllocations.map((s) => [s.label, s.percentage / 100])
    );
    const rowData = [
      fund.fundName,
      fund.fundHouse,
      ...allSectors.map((s) => sectorMap.get(s) ?? null),
    ];
    const row = sectorSheet.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      applyBodyStyle(cell, i, colNumber > 2);
    });
  });

  // ── Sheet 3: Asset Allocation ─────────────────────────────────────────────
  const assetSheet = workbook.addWorksheet("Asset Allocation", {
    properties: { tabColor: { argb: "FF3A7D44" } },
  });

  const allAssets = Array.from(
    new Set(funds.flatMap((f) => f.assetAllocations.map((a) => a.label)))
  ).sort();

  const assetHeaders = ["Fund Name", "Fund House", ...allAssets];
  const assetHeaderRow = assetSheet.addRow(assetHeaders);
  assetHeaderRow.height = 36;
  assetHeaderRow.eachCell((cell, colNumber) =>
    applyHeaderStyle(cell, colNumber > 2)
  );

  assetSheet.getColumn(1).width = 45;
  assetSheet.getColumn(2).width = 22;
  for (let i = 3; i <= assetHeaders.length; i++) {
    assetSheet.getColumn(i).width = 18;
  }

  funds.forEach((fund, i) => {
    const assetMap = new Map(
      fund.assetAllocations.map((a) => [a.label, a.percentage / 100])
    );
    const rowData = [
      fund.fundName,
      fund.fundHouse,
      ...allAssets.map((a) => assetMap.get(a) ?? null),
    ];
    const row = assetSheet.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      applyBodyStyle(cell, i, colNumber > 2);
    });
  });

  // ── Sheet 4: Market Cap Allocation ─────────────────────────────────────────
  const marketCapSheet = workbook.addWorksheet("Market Cap Allocation", {
    properties: { tabColor: { argb: "FF7B5E17" } },
  });
  const allMarketCaps = Array.from(
    new Set(funds.flatMap((fund) => (fund.marketCapAllocations ?? []).map((item) => item.label)))
  ).sort();
  const marketCapHeaders = ["Fund Name", "Fund House", ...allMarketCaps];
  const marketCapHeaderRow = marketCapSheet.addRow(marketCapHeaders);
  marketCapHeaderRow.height = 36;
  marketCapHeaderRow.eachCell((cell, colNumber) => applyHeaderStyle(cell, colNumber > 2));
  marketCapSheet.getColumn(1).width = 45;
  marketCapSheet.getColumn(2).width = 22;
  for (let i = 3; i <= marketCapHeaders.length; i++) marketCapSheet.getColumn(i).width = 18;
  funds.forEach((fund, index) => {
    const marketCapMap = new Map((fund.marketCapAllocations ?? []).map((item) => [item.label, item.percentage / 100]));
    const row = marketCapSheet.addRow([
      fund.fundName,
      fund.fundHouse,
      ...allMarketCaps.map((label) => marketCapMap.get(label) ?? null),
    ]);
    row.height = 22;
    row.eachCell((cell, colNumber) => applyBodyStyle(cell, index, colNumber > 2));
  });

  // Return buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
