/* Minimal .xlsx reader for sheet imports: returns the first worksheet as rows
   of strings (like parseCsv). An .xlsx file is a zip of XML; this reads the
   zip directory, inflates with the browser's DecompressionStream, and reads
   the shared strings and cells. No dependency needed. */

type Entry = { name: string; method: number; size: number; offset: number };

function zipEntries(buf: ArrayBuffer): Entry[] {
  const v = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This doesn't look like an Excel (.xlsx) file.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Entry[] = [];
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true), extraLen = v.getUint16(p + 30, true), commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    out.push({ name: dec.decode(new Uint8Array(buf, p + 46, nameLen)), method, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function readEntry(buf: ArrayBuffer, e: Entry): Promise<string> {
  const v = new DataView(buf);
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const data = new Uint8Array(buf, start, e.size);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Unsupported compression in this Excel file.");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};
const textOf = (el: Element | null) => (el ? Array.from(el.getElementsByTagName("t")).map((t) => t.textContent || "").join("") : "");

export async function readXlsx(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const entries = zipEntries(buf);
  const get = async (name: string) => { const e = entries.find((x) => x.name === name); return e ? readEntry(buf, e) : null; };
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

  // First sheet in workbook order → its file via the workbook relationships.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await get("xl/workbook.xml"), rels = await get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName("sheet")[0];
    const rid = first?.getAttribute("r:id") || first?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const rel = Array.from(xml(rels).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = await get(sheetPath);
  if (!sheet) throw new Error("Couldn't find a worksheet in this Excel file.");
  const ssXml = await get("xl/sharedStrings.xml");
  const shared = ssXml ? Array.from(xml(ssXml).getElementsByTagName("si")).map((si) => textOf(si)) : [];

  const rows: string[][] = [];
  for (const r of Array.from(xml(sheet).getElementsByTagName("row"))) {
    const row: string[] = [];
    for (const c of Array.from(r.getElementsByTagName("c"))) {
      const i = colIndex(c.getAttribute("r") || "");
      const t = c.getAttribute("t");
      const raw = c.getElementsByTagName("v")[0]?.textContent ?? "";
      const val = t === "s" ? shared[Number(raw)] ?? "" : t === "inlineStr" ? textOf(c.getElementsByTagName("is")[0]) : raw;
      if (i >= 0) { while (row.length < i) row.push(""); row[i] = val; }
    }
    rows.push(row);
  }
  return rows;
}
