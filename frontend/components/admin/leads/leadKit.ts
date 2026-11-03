/* Shared bits for the Leads page: stages, money / date formatting, sorting. */
import type { LeadRow, LeadStage } from "@/lib/adminApi";
import { istToday, addDays } from "@/lib/activityText";

export type StageDef = { id: LeadStage; name: string; pct: number; tone: "grey" | "blue" | "violet" | "amber" | "green" | "red"; c: string; bg: string };
/* Stage → progress score (the bar always reflects where a lead sits in the funnel). */
export const STAGES: StageDef[] = [
  { id: "new", name: "New", pct: 10, tone: "grey", c: "var(--td-muted)", bg: "var(--td-grey-bg)" },
  { id: "contacted", name: "Contacted", pct: 35, tone: "blue", c: "var(--td-brand)", bg: "var(--td-brand-soft)" },
  { id: "qualified", name: "Qualified", pct: 60, tone: "violet", c: "var(--td-violet)", bg: "var(--td-violet-bg)" },
  { id: "proposal", name: "Proposal", pct: 85, tone: "amber", c: "var(--td-amber)", bg: "var(--td-amber-bg)" },
  { id: "won", name: "Won", pct: 100, tone: "green", c: "var(--td-green)", bg: "var(--td-green-bg)" },
  { id: "lost", name: "Lost", pct: 0, tone: "red", c: "var(--td-red)", bg: "var(--td-red-bg)" },
];
export const stageOf = (id?: string | null) => STAGES.find((s) => s.id === id) || STAGES[0];
/* Saved progress % (the server keeps it in step with the stage); older rows fall back to the stage score. */
export const progressOf = (l: Pick<LeadRow, "stage" | "progress">) => (l.progress == null ? stageOf(l.stage).pct : Math.max(0, Math.min(100, Number(l.progress) || 0)));
export const isOpen = (l: Pick<LeadRow, "stage">) => l.stage !== "won" && l.stage !== "lost";

export const SOURCES = ["Website", "Referral", "LinkedIn", "Cold outreach", "Event", "Other"];
export const PRIORITIES = ["low", "medium", "high"] as const;
export const LOST_REASONS = ["Budget", "Went with another agency", "No response", "Timing", "Not a fit"];

/* ₹1,53,000 and ₹1.53L */
export const inr = (n?: number | null) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
export const inrShort = (n?: number | null) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${+(v / 1e3).toFixed(1)}k`;
  return `₹${v}`;
};
export const sumValue = (ls: LeadRow[]) => ls.reduce((a, l) => a + (Number(l.value) || 0), 0);
export const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
export const firstName = (s?: string | null) => String(s || "").trim().split(/\s+/)[0] || "";

/* Next follow-up day (India date) of a lead. */
export const followDay = (l: LeadRow) => String(l.nextFollowUpAt || l.nextFollowUp || "").slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDay = (d: string) => { const [, m, day] = d.split("-").map(Number); return m && day ? `${day} ${MONTHS[m - 1]}` : ""; };

/* The follow-up chip: null for closed leads / no date. */
export function followChip(l: LeadRow, today = istToday()): { text: string; tone: "red" | "amber" | "grey"; title: string } | null {
  const d = followDay(l);
  if (!isOpen(l) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const title = `Next follow-up ${shortDay(d)}${l.followUpNote ? ` — ${l.followUpNote}` : ""}`;
  if (d < today) return { text: `Overdue · ${shortDay(d)}`, tone: "red", title };
  if (d === today) return { text: "Follow up today", tone: "amber", title };
  if (d === addDays(today, 1)) return { text: "Tomorrow", tone: "grey", title };
  return { text: shortDay(d), tone: "grey", title };
}

/* Board / list order: position, then newest first (as the server sends). */
export const byPosition = (a: LeadRow, b: LeadRow) =>
  (Number(a.position) || 0) - (Number(b.position) || 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || b.id - a.id;

/* "YYYY-MM" of a moment in India time. */
export const istMonth = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 7) : "");

/* ISO moment ↔ <input type="datetime-local"> (browser time). */
export const toLocalInput = (v: unknown) => {
  if (!v) return "";
  const d = new Date(String(v));
  if (isNaN(+d)) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const isUrl = (v: unknown) => /^https?:\/\/\S+\.\S+/i.test(String(v || "").trim());
