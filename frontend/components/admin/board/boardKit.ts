/* Shared bits for the Project board: normalising rows from MySQL, list tints,
   dates (India time), card facts (overdue, checklist, renewal). */
import type { BoardRow, CardRow, CardSummary, BoardList, BoardLabel } from "@/lib/adminApi";
import { istToday, addDays, avatarColor } from "@/lib/activityText";

/* JSON columns can come back as strings, booleans as 1/0/"1"/"0" on some MySQL setups. */
export function toArr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.trim().startsWith("[")) { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } }
  return [];
}
export const booly = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";
export const day10 = (v: unknown) => (v ? String(v).slice(0, 10) : "");

export const normBoard = (b: BoardRow): BoardRow => ({ ...b, columns: toArr<BoardList>(b.columns), labels: toArr<BoardLabel>(b.labels) });
export const normCard = (t: CardRow): CardRow => ({
  ...t,
  completed: booly(t.completed),
  memberIds: toArr<number>(t.memberIds).map(Number),
  labelIds: toArr<string>(t.labelIds),
  checklist: toArr<CardRow["checklist"][number]>(t.checklist).map((c) => ({ ...c, done: booly(c.done) })),
  attachments: toArr<CardRow["attachments"][number]>(t.attachments),
  position: Number(t.position) || 0,
});
export const normSummary = (t: CardSummary): CardSummary => ({ ...t, completed: booly(t.completed), memberIds: toArr<number>(t.memberIds).map(Number) });

export const uid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 8)}`;
export const byPos = (a: CardRow, b: CardRow) => a.position - b.position || a.id - b.id;
export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/* ── list tints (the approved design: Backlog grey, To Do blue, In Progress
   orange, Review pink, Done green). Matched by id first, then by title, so
   renamed or custom lists still get a sensible colour. ── */
export type Tone = "backlog" | "todo" | "doing" | "review" | "done";
export function toneOf(l: Pick<BoardList, "id" | "title">, index = 0): Tone {
  const id = String(l.id || "").toLowerCase(), t = String(l.title || "").toLowerCase();
  if (/^done$|complete|shipped|live/.test(id) || /done|complete|shipped|launched|live/.test(t)) return "done";
  if (/review|approv/.test(id) || /review|approv|check|qa|feedback/.test(t)) return "review";
  if (/progress|doing/.test(id) || /progress|doing|working|active|wip/.test(t)) return "doing";
  if (/backlog|idea/.test(id) || /backlog|idea|later|someday/.test(t)) return "backlog";
  if (/todo/.test(id) || /to ?do|next|planned|brief/.test(t)) return "todo";
  return (["todo", "doing", "review", "backlog"] as Tone[])[index % 4];
}
export const TONE_DOT: Record<Tone, string> = { backlog: "#8a93aa", todo: "#3e60ab", doing: "#e2791f", review: "#d64b8a", done: "#25a36a" };
export const isDoneList = (l?: Pick<BoardList, "id" | "title"> | null) => !!l && toneOf(l) === "done";

/* Board label palette (settings) and default labels for a new board. */
export const LABEL_COLORS = ["#8b5cf6", "#3e60ab", "#0ea5e9", "#16a34a", "#f59e0b", "#e2791f", "#ef4444", "#d64b8a", "#64748b"];
export const DEFAULT_LABELS: BoardLabel[] = [
  { id: "l1", name: "Design", color: "#8b5cf6" }, { id: "l2", name: "Development", color: "#3e60ab" },
  { id: "l3", name: "QA", color: "#f59e0b" }, { id: "l4", name: "Urgent", color: "#ef4444" },
];
export const DEFAULT_LISTS: BoardList[] = [{ id: "todo", title: "To Do" }, { id: "inprogress", title: "In Progress" }, { id: "done", title: "Done" }];
export const COVER_SWATCHES = ["", "#3e60ab", "#8b5cf6", "#16a34a", "#f59e0b", "#ef4444", "#0ea5e9", "#d64b8a"];

/* Client tag colour, stable per name. */
export const clientColor = (c: string) => avatarColor(c.trim().toLowerCase());
export const clientTag = (c: string) => "#" + (c.trim().split(/\s+/)[0] || c).toLowerCase();

/* ── dates ── */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDay = (d: string) => { const [, m, dd] = d.split("-").map(Number); return m && dd ? `${dd} ${MONTHS[m - 1]}` : d; };
export const daysUntil = (d: string, today = istToday()) => Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);

export type DueInfo = { text: string; tone: "late" | "soon" | ""; days: number };
export function dueInfo(t: Pick<CardRow, "dueDate" | "completed">, done: boolean, today = istToday()): DueInfo | null {
  const d = day10(t.dueDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const n = daysUntil(d, today);
  if (done || t.completed) return { text: shortDay(d), tone: "", days: n };
  if (n < 0) return { text: `${-n}d overdue`, tone: "late", days: n };
  if (n === 0) return { text: "Due today", tone: "soon", days: n };
  if (n === 1) return { text: "Due tomorrow", tone: "soon", days: n };
  return { text: shortDay(d), tone: "", days: n };
}
export const isOverdue = (t: Pick<CardRow, "dueDate" | "completed">, done: boolean, today = istToday()) => {
  const d = day10(t.dueDate);
  return !done && !t.completed && /^\d{4}-/.test(d) && d < today;
};
export const dueThisWeek = (t: Pick<CardRow, "dueDate" | "completed">, done: boolean, today = istToday()) => {
  const d = day10(t.dueDate);
  return !done && !t.completed && /^\d{4}-/.test(d) && d >= today && d <= addDays(today, 7);
};

/* Description is rich text (HTML) on newer cards, plain text on older ones. */
export function plainText(html?: string | null) {
  const s = String(html || "");
  if (!/[<&]/.test(s)) return s.trim();
  return s.replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

export const isImage = (f: { url: string; name?: string; thumbUrl?: string | null }) => !!f.thumbUrl || /\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(f.url || f.name || "");
