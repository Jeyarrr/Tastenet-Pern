import { downloadBlob } from "./downloadBlob.js";
// SpreadsheetML stores user text as String cells, never formulas.
export function downloadWorkbook(filename, sheets) {
  const escape = (value) =>
    String(value ?? "")
      // XML 1.0 forbids these control characters in spreadsheet cell text.
      // eslint-disable-next-line no-control-regex
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
  downloadBlob(
    filename,
    new Blob([xml], { type: "application/xml;charset=utf-8" }),
  );
}
