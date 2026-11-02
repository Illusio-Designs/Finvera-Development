/* Minimal .xlsx writer for exports — the other half of lib/xlsx.ts.
   Builds a real Excel workbook in the browser with no dependency:
   one or more sheets, bold header row frozen at the top with a filter,
   numbers kept as numbers, text as inline strings, column widths sized to
   the content. The zip is "stored" (no compression) — Excel, Google Sheets,
   Numbers and LibreOffice all open it, and our reader can read it back. */

export type Cell = string | number | boolean | null | undefined;
export type Sheet = { name: string; columns: string[]; rows: (Record<string, Cell> | Cell[])[] };

/* ── zip (store only) ── */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);       // version needed
    local.setUint16(6, 0x0800, true);   // UTF-8 names
    local.setUint16(8, 0, true);        // stored
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), name, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

/* ── sheet XML ── */
// Characters XML 1.0 doesn't allow (control chars except tab / newlines).
// eslint-disable-next-line no-control-regex
const BAD_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;
const esc = (s: string) => s.replace(BAD_XML, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i: number) => { let s = ""; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const sheetName = (n: string, used: Set<string>) => {
  let base = (n || "Sheet").replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet";
  let name = base, k = 2;
  while (used.has(name.toLowerCase())) { const suf = ` (${k++})`; name = base.slice(0, 31 - suf.length) + suf; }
  used.add(name.toLowerCase());
  return name;
};

function cellXml(ref: string, v: Cell, style: number) {
  const s = style ? ` s="${style}"` : "";
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number" && isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
  const text = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v).slice(0, 32767);
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

function sheetXml(sh: Sheet) {
  const cols = sh.columns;
  const rows = sh.rows.map((r) => (Array.isArray(r) ? r : cols.map((c) => r[c])));
  // Width ≈ longest text in the column (header + first 500 rows), 8–60 characters.
  const widths = cols.map((c, i) => {
    let w = String(c).length + 2;
    for (const r of rows.slice(0, 500)) {
      const v = r[i];
      if (v == null) continue;
      const len = Math.max(...String(v).split("\n").map((l) => l.length));
      if (len + 1 > w) w = len + 1;
    }
    return Math.min(60, Math.max(8, w));
  });
  const last = colName(Math.max(0, cols.length - 1));
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  out.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
  out.push(`<dimension ref="A1:${last}${rows.length + 1}"/>`);
  out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
  out.push('<sheetFormatPr defaultRowHeight="15"/>');
  if (cols.length) out.push(`<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`);
  out.push("<sheetData>");
  out.push(`<row r="1">${cols.map((c, i) => cellXml(`${colName(i)}1`, c, 1)).join("")}</row>`);
  rows.forEach((r, ri) => {
    out.push(`<row r="${ri + 2}">${r.map((v, ci) => cellXml(`${colName(ci)}${ri + 2}`, v, 0)).join("")}</row>`);
  });
  out.push("</sheetData>");
  if (cols.length && rows.length) out.push(`<autoFilter ref="A1:${last}${rows.length + 1}"/>`);
  out.push("</worksheet>");
  return out.join("");
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE6ECF8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

/** Build an .xlsx file (as bytes) from one or more sheets. */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const enc = new TextEncoder();
  const used = new Set<string>();
  const names = sheets.map((s) => sheetName(s.name, used));
  const files: { name: string; data: Uint8Array }[] = [];
  const add = (name: string, s: string) => files.push({ name, data: enc.encode(s) });
  add("[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
    "</Types>");
  add("_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  add("xl/workbook.xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    "</sheets>" +
    // The header filter needs a defined name per sheet for Excel to keep it.
    `<definedNames>${sheets.map((s, i) => s.columns.length && s.rows.length
      ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${esc(names[i].replace(/'/g, "''"))}'!$A$1:$${colName(s.columns.length - 1)}$${s.rows.length + 1}</definedName>` : "").join("")}</definedNames>` +
    "</workbook>");
  add("xl/_rels/workbook.xml.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    "</Relationships>");
  add("xl/styles.xml", STYLES);
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)));
  return zip(files);
}

/** Build the workbook and save it as `filename` (e.g. "finvera-leads-2026-11-02.xlsx"). */
export function downloadXlsx(filename: string, sheets: Sheet[]) {
  const bytes = buildXlsx(sheets);
  const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** "finvera-leads-2026-11-02.xlsx" — today in India time. */
export const exportFileName = (what: string) =>
  `finvera-${what}-${new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10)}.xlsx`;
