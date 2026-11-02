/* Turning activity-history rows into plain English: field names, values
   ("₹18,000", "2 Nov 2026"), the item's kind and the day headings.
   Used by the Activity page and the History sections in drawers. */
import type { ActivityRow } from "./adminApi";

const TZ = "Asia/Kolkata";

/* Item kinds as people say them. */
export const ENTITY_NOUN: Record<string, string> = {
  lead: "lead", renewal: "renewal", user: "user", setting: "settings", seo: "SEO for", contact: "message from",
  task: "card", board: "board", "social-client": "brand", "social-post": "post",
  project: "project", service: "service", testimonial: "testimonial", "team-member": "team member", blog: "blog post",
  page: "page", faq: "FAQ", value: "value", brand: "brand logo", milestone: "milestone", "process-step": "process step",
  stat: "stat", logo: "logo", feature: "feature",
};

/* Filter groups on the Activity page → the entity list the API takes. */
export const ENTITY_GROUPS: { value: string; label: string; entity: string }[] = [
  { value: "leads", label: "Leads", entity: "lead" },
  { value: "renewals", label: "Renewals", entity: "renewal" },
  { value: "users", label: "Users", entity: "user" },
  { value: "settings", label: "Settings", entity: "setting,seo" },
  { value: "content", label: "Website content", entity: "content-section" },
  { value: "board", label: "Project board", entity: "task,board" },
  { value: "social", label: "Content calendar", entity: "social-post,social-client" },
  { value: "contact", label: "Contact", entity: "contact" },
];

/* Where an item opens in the dashboard (only pages that can open one item). */
export function itemHref(r: Pick<ActivityRow, "entity" | "entityId" | "action">): string | null {
  if (r.action === "delete" || !r.entityId) return null;
  if (r.entity === "lead") return `/dashboard/leads?lead=${r.entityId}`;
  return null;
}

const LABELS: Record<string, string> = {
  name: "name", title: "title", stage: "stage", value: "value", amount: "amount", owner: "owner", ownerId: "owner",
  priority: "priority", nextFollowUp: "next follow-up", nextFollowUpAt: "next follow-up", followUpNote: "follow-up note",
  meetingUrl: "meeting link", meetingAt: "meeting time", lastContactedAt: "last contacted", lostReason: "lost reason",
  notes: "notes", email: "email", phone: "phone", company: "company", purpose: "purpose", source: "source",
  status: "status", cycle: "billing cycle", renewalDate: "renewal date", lastInvoiced: "last renewed", client: "client",
  project: "project", postDate: "go-live date", postTime: "time", dueDate: "due date", assigneeId: "assigned to",
  theme: "theme", topic: "topic", format: "format", caption: "caption", requirements: "requirements", remarks: "remarks",
  festive: "day / festival", keywords: "keywords", media: "files", publishTo: "publish to", step: "step", team: "team",
  estimateHours: "estimate (hours)", driveLink: "drive link", column: "list", completed: "done", description: "description",
  memberIds: "members", labelIds: "labels", checklist: "checklist", attachments: "attachments", startDate: "start date",
  boardId: "board", role: "role", roles: "roles", active: "active", avatar: "photo", socialClients: "brands", password: "password",
  isRead: "read", content: "content", excerpt: "excerpt", slug: "web address", category: "category", image: "image",
  cover: "cover image", published: "published", quote: "quote", question: "question", answer: "answer", label: "label",
  year: "year", seoTitle: "SEO title", seoDescription: "SEO description", metaTitle: "meta title", metaDescription: "meta description",
};
/** "nextFollowUpAt" → "next follow-up"; unknown names: "someField" → "some field". */
export function fieldLabel(f: string) {
  if (LABELS[f]) return LABELS[f];
  return f.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
}

const MONEY = /^(value|amount|price|budget|fee)$/i;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });

/** A stored value as a short readable string ("—" for empty). */
export function showValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return MONEY.test(field) ? `₹${v.toLocaleString("en-IN")}` : v.toLocaleString("en-IN");
  if (Array.isArray(v)) {
    if (!v.length) return "—";
    if (v.every((x) => typeof x !== "object")) return v.join(", ");
    return `${v.length} item${v.length === 1 ? "" : "s"}`;
  }
  if (typeof v === "object") {
    const e = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== null && x !== "" && x !== undefined);
    return e.length ? e.map(([k, x]) => `${k}: ${typeof x === "object" ? "…" : String(x)}`).join(", ") : "—";
  }
  const s = String(v);
  if (MONEY.test(field) && /^-?\d+(\.\d+)?$/.test(s)) return `₹${Number(s).toLocaleString("en-IN")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fmtDay(s);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) { const d = new Date(s); if (!isNaN(+d)) return fmtDateTime(d); }
  if (field === "stage" || field === "status" || field === "priority" || field === "cycle") return s.charAt(0).toUpperCase() + s.slice(1);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

export type ChangeLine = { field: string; label: string; from: string; to: string };
/** The row's changes as readable lines, in a stable order (duplicates like owner/ownerId merged). */
export function changeLines(r: Pick<ActivityRow, "changes">): ChangeLine[] {
  const ch = r.changes && typeof r.changes === "object" ? r.changes : {};
  const out: ChangeLine[] = [];
  const seen = new Set<string>();
  for (const [f, pair] of Object.entries(ch)) {
    if (!Array.isArray(pair)) continue;
    const label = fieldLabel(f);
    if (f === "ownerId" && "owner" in ch) continue; // the name says it better
    if (f === "nextFollowUp" && "nextFollowUpAt" in ch) continue;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ field: f, label, from: showValue(f, pair[0]), to: showValue(f, pair[1]) });
  }
  return out;
}

const VERB: Record<string, string> = { create: "added", update: "updated", delete: "deleted", other: "updated" };
const PILL: Record<string, string> = { create: "Added", update: "Changed", delete: "Deleted", other: "Other" };
const TOUCH_WORD: Record<string, string> = { call: "call", whatsapp: "WhatsApp", email: "email", meeting: "meeting", note: "note" };

/** Server summaries made friendlier: "Logged whatsapp: hi" → "Logged WhatsApp: hi". */
export function prettySummary(s: string | null | undefined) {
  if (!s) return "";
  return s.replace(/^Logged (call|whatsapp|email|meeting|note)\b/i, (_, t: string) => `Logged ${t.toLowerCase() === "whatsapp" ? "WhatsApp" : t.toLowerCase()}`);
}

/** Sentence parts: who, what they did, the item's name, a short tail (first changes or the summary), the pill word. */
export function sentence(r: ActivityRow, { withNoun = true } = {}) {
  const who = r.userName || "Someone";
  let noun = ENTITY_NOUN[r.entity] || r.entity.replace(/-/g, " ");
  let verb = VERB[r.action] || r.action;
  let pill = PILL[r.action] || r.action;
  const lines = changeLines(r);
  const summary = r.summary || "";
  let tail = "";
  const touch = r.action === "other" ? /^Logged (call|whatsapp|email|meeting|note)(?::\s*([\s\S]*))?$/i.exec(summary) : null;
  if (touch) {
    // Lead touch: "Rishi logged a call with lead Priya Sharma — note"
    const t = touch[1].toLowerCase();
    verb = t === "note" ? "added a note to" : `logged ${t === "email" ? "an" : "a"} ${TOUCH_WORD[t]} with`;
    pill = t === "note" ? "Note" : TOUCH_WORD[t].charAt(0).toUpperCase() + TOUCH_WORD[t].slice(1);
    tail = touch[2] || "";
  } else if (r.action === "other" && /^Renewed\b/.test(summary)) {
    verb = "renewed"; noun = ""; pill = "Renewed"; tail = summary.replace(/^Renewed\s*/, "");
  } else if (r.action === "other" && /^Terminated\b/.test(summary)) {
    verb = "terminated"; noun = ""; pill = "Terminated"; tail = summary.replace(/^Terminated\s*(—\s*)?/, "");
  } else if (r.action === "other" && summary) {
    tail = summary;
  } else if (r.action === "update" && lines.length) {
    tail = lines.slice(0, 2).map((l) => `${l.label}: ${l.from} → ${l.to}`).join(", ") + (lines.length > 2 ? ` +${lines.length - 2} more` : "");
    if (summary) tail = `${summary} · ${tail}`;
  } else if (summary) tail = summary;
  const label = r.entityLabel || (r.entity === "setting" ? "" : r.entityId ? `#${r.entityId}` : "");
  return { who, verb, noun: withNoun ? noun : "", label, tail, lines, pill };
}

/* ── time ── */
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
/** "YYYY-MM-DD" of a moment in India time. */
export const istDay = (d: Date | string | number) => dayKeyFmt.format(new Date(d));
export const istToday = () => istDay(Date.now());
export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
/** "Today", "Yesterday", "Mon 2 Nov" (+ year when not this year). */
export function dayHeading(day: string) {
  const today = istToday();
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const d = new Date(`${day}T00:00:00Z`);
  const parts = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC", ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) });
  return parts.replace(",", "");
}
export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
export const whenOf = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TZ });
/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", "2 Oct". */
export function relative(iso: string | null | undefined) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400 && istDay(t) === istToday()) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.round((Date.parse(istToday()) - Date.parse(istDay(t))) / 86400000);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TZ, ...(istDay(t).slice(0, 4) !== istToday().slice(0, 4) ? { year: "numeric" } : {}) });
}
export const initials = (n?: string | null) => String(n || "?").split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase();
const AV = ["#3e60ab", "#0f766e", "#be185d", "#a16207", "#7c5cff", "#0369a1", "#c2410c", "#15803d"];
export const avatarColor = (n?: string | null) => AV[[...String(n || "")].reduce((s, c) => s + c.charCodeAt(0), 0) % AV.length];
