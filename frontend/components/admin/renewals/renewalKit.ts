/* Shared bits for the Renewals page: cycles, dates, the remarks log, money. */
import type { RenewalRow, RenewalCycle, RenewalStatus } from "@/lib/adminApi";
import { istToday, addDays } from "@/lib/activityText";

export const CYCLES: { id: RenewalCycle; name: string; months: number }[] = [
  { id: "monthly", name: "Monthly", months: 1 },
  { id: "quarterly", name: "Quarterly", months: 3 },
  { id: "half-yearly", name: "Half-yearly", months: 6 },
  { id: "yearly", name: "Yearly", months: 12 },
];
export const cycleOf = (c?: string | null) => CYCLES.find((x) => x.id === c) || CYCLES[3];
/* What one renewal brings in over a year (₹15,000 quarterly → ₹60,000). */
export const yearlyValue = (r: Pick<RenewalRow, "amount" | "cycle">) => (Number(r.amount) || 0) * (12 / cycleOf(r.cycle).months);

export const STATUSES: { id: RenewalStatus; name: string; tone: "green" | "amber" | "grey" }[] = [
  { id: "active", name: "Active", tone: "green" },
  { id: "paused", name: "Paused", tone: "amber" },
  { id: "cancelled", name: "Terminated", tone: "grey" },
];
export const statusOf = (s?: string | null) => STATUSES.find((x) => x.id === s) || STATUSES[0];

export const RENEW_PICKS = ["Paid by UPI", "Invoice sent", "Paid by bank transfer", "Paid by cheque", "Paid in cash"];
export const END_PICKS = ["Client moved to another agency", "Project closed", "Budget cut", "Taking it in-house", "No response"];

/* ₹1,53,000 and ₹1.53L */
export const inr = (n?: number | null) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
export const inrShort = (n?: number | null) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${+(v / 1e3).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
};
export const sumAmount = (rs: RenewalRow[]) => rs.reduce((a, r) => a + (Number(r.amount) || 0), 0);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const day10 = (v?: string | null) => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };
/* "28 Oct 2026" (the same shape the server writes into the remarks log). */
export const fmtDay = (iso?: string | null, withYear = true) => {
  const d = day10(iso); if (!d) return "";
  const [y, m, dd] = d.split("-").map(Number);
  return `${dd} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
};
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

/* One billing cycle on from the date it was due — the same rule as the server
   (31 Jan + 1 month → 28/29 Feb). No date yet → from today. */
export function addMonths(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}
export const nextDate = (r: Pick<RenewalRow, "renewalDate" | "cycle">, today = istToday()) => addMonths(day10(r.renewalDate) || today, cycleOf(r.cycle).months);

/* The countdown chip next to the date. */
export function dueChip(r: RenewalRow, today = istToday()): { text: string; tone: "red" | "amber" | "blue" | "grey" } | null {
  const d = day10(r.renewalDate);
  if (!d) return r.status === "cancelled" ? null : { text: "No date", tone: "grey" };
  if (r.status === "cancelled") return { text: "Ended", tone: "grey" };
  const n = daysBetween(today, d);
  if (r.status === "paused") return { text: "On hold", tone: "grey" };
  if (n < 0) return { text: `${-n} day${n === -1 ? "" : "s"} late`, tone: "red" };
  if (n === 0) return { text: "Due today", tone: "amber" };
  if (n === 1) return { text: "Tomorrow", tone: "amber" };
  return { text: `in ${n} days`, tone: n <= 7 ? "amber" : n <= 30 ? "blue" : "grey" };
}

/* Timeline groups: Overdue, This month, Next month, later months by name,
   then No date, Paused and Terminated. */
export type Group = { key: string; title: string; tone?: "red" | "amber" | "grey"; rows: RenewalRow[] };
export function groupRows(rows: RenewalRow[], today = istToday()): Group[] {
  const thisM = today.slice(0, 7);
  const nextM = addMonths(`${thisM}-01`, 1).slice(0, 7);
  const map = new Map<string, Group>();
  const put = (key: string, title: string, r: RenewalRow, tone?: Group["tone"]) => {
    if (!map.has(key)) map.set(key, { key, title, tone, rows: [] });
    map.get(key)!.rows.push(r);
  };
  for (const r of rows) {
    const d = day10(r.renewalDate);
    if (r.status === "cancelled") put("~3ended", "Terminated", r, "grey");
    else if (r.status === "paused") put("~2paused", "Paused", r, "grey");
    else if (!d) put("~1nodate", "No date set", r, "grey");
    else if (d < today) put("0overdue", "Overdue", r, "red");
    else {
      const m = d.slice(0, 7);
      const [y, mm] = m.split("-").map(Number);
      const title = m === thisM ? "This month" : m === nextM ? "Next month" : `${MONTHS_LONG[mm - 1]}${String(y) !== today.slice(0, 4) ? ` ${y}` : ""}`;
      put(`1${m}`, title, r, m === thisM ? "amber" : undefined);
    }
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((g) => ({ ...g, rows: g.rows.sort(byDate) }));
}
export const byDate = (a: RenewalRow, b: RenewalRow) =>
  (day10(a.renewalDate) || "9999").localeCompare(day10(b.renewalDate) || "9999") || (Number(a.position) || 0) - (Number(b.position) || 0) || a.client.localeCompare(b.client);
const STATUS_IDX: Record<string, number> = { active: 0, paused: 1, cancelled: 2 };
export const byStatusThenDate = (a: RenewalRow, b: RenewalRow) => (STATUS_IDX[a.status] ?? 0) - (STATUS_IDX[b.status] ?? 0) || byDate(a, b);

/* ── The remarks log ──
   `notes` holds dated lines, newest first, written by the server:
     "1 Nov 2026 · Renewed till 1 Nov 2027 · Priya — Paid by UPI"
     "1 Nov 2026 · Terminated · Priya — Client moved to another agency"
   and by this page for a plain remark: "1 Nov 2026 · Note · Priya — text".
   Anything else (older free text) is shown as it is. */
export type Remark = { date: string; kind: "renewed" | "terminated" | "note" | "text"; what: string; by: string; text: string };
const LINE = /^(\d{1,2} [A-Z][a-z]{2,4}\.? \d{4}) · (.*)$/;
export function parseRemarks(notes?: string | null): Remark[] {
  const out: Remark[] = [];
  for (const raw of String(notes || "").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const m = LINE.exec(line);
    if (!m) {
      const prev = out[out.length - 1];
      if (prev && prev.kind !== "text") prev.text = prev.text ? `${prev.text}\n${line}` : line; // a remark that spans lines
      else if (prev && prev.kind === "text") prev.text += `\n${line}`;
      else out.push({ date: "", kind: "text", what: "", by: "", text: line });
      continue;
    }
    const rest = m[2];
    const cut = rest.indexOf(" — ");
    const meta = (cut >= 0 ? rest.slice(0, cut) : rest).split(" · ");
    const text = cut >= 0 ? rest.slice(cut + 3) : "";
    const what = meta[0] || "";
    const kind: Remark["kind"] = /^Renewed/i.test(what) ? "renewed" : /^Terminated/i.test(what) ? "terminated" : /^Note/i.test(what) ? "note" : "note";
    out.push({ date: m[1], kind, what, by: meta.length > 1 ? meta.slice(1).join(" · ") : "", text });
  }
  return out;
}
export const latestRemark = (notes?: string | null) => parseRemarks(notes)[0] || null;
export const remarkLine = (what: string, by: string, text: string, today = istToday()) =>
  `${fmtDay(today)} · ${what}${by ? ` · ${by}` : ""}${text.trim() ? ` — ${text.trim().replace(/\s*\n\s*/g, " ")}` : ""}`;
export const prependRemark = (notes: string | null | undefined, line: string) => [line, notes].filter((x) => x && String(x).trim()).join("\n");

export { istToday, addDays };
export const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
export const label = (r: Pick<RenewalRow, "client" | "project">) => (r.project ? `${r.client} — ${r.project}` : r.client);
