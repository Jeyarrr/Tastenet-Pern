// SpreadsheetML stores user text as String cells, never formulas.
export function downloadWorkbook(filename, sheets) {
  const escape = (value) =>
    String(value ?? "")
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const xml =
    '<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    Object.entries(sheets)
      .map(
        ([name, rows]) =>
          `<Worksheet ss:Name="${escape(name)}"><Table>${rows.map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="${typeof value === "number" && Number.isFinite(value) ? "Number" : "String"}">${escape(value)}</Data></Cell>`).join("")}</Row>`).join("")}</Table></Worksheet>`,
      )
      .join("") +
    "</Workbook>";
  const url = URL.createObjectURL(
    new Blob([xml], { type: "application/xml;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
