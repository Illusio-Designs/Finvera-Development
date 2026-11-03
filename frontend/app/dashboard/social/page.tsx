"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { instagramSafeAll } from "@/lib/igImage";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";
import DatePicker from "@/components/ui/DatePicker";
import { BoardSkeleton } from "@/components/admin/Skeleton";
import { readXlsx } from "@/lib/xlsx";
import { visibleInterval } from "@/lib/visibleInterval";
import HistoryList from "@/components/admin/HistoryList";
import ExportButton from "@/components/admin/ExportButton";

type Stage = "planned" | "client" | "production" | "approval" | "ready" | "posted";
type LogEntry = { id: string; userId?: number | null; minutes: number; note?: string; at: string };
type Post = {
  id: number; client: string; status: Stage;
  postDate?: string | null; postTime?: string | null; dueDate?: string | null;
  assigneeId?: number | null; estimateHours?: number | null;
  timeLog?: LogEntry[]; timerStart?: string | null; timerBy?: number | null;
  festive?: string; theme: string; topic?: string; format?: string; requirements?: string; reference?: string;
  dataStatus?: string; poc?: string; caption?: string; driveLink?: string; tags?: string; keywords?: string;
  channels?: string; remarks?: string; position?: number;
  media?: Media[]; publishTo?: string[] | null; keywordHashtags?: boolean;
  step?: string | null; // In production: "graphic" (design) then "video" (edit)
  team?: Partial<Record<string, number | null>> | null; // who does each step, picked by hand
  _full?: boolean; // client-only: the heavy fields (HEAVY) are loaded — the board loads light "card" posts
};
/* Auto-publishing */
type Media = { url: string; type: "image" | "video"; name?: string; thumbUrl?: string | null }; // thumbUrl: small preview (newer uploads)
type PubJob = { id: number; postId: number; client: string; platform: "instagram" | "facebook"; status: string; runAt: string | null; attempts: number;
  error: string | null; url: string | null; publishedAt: string | null; account: string | null; theme: string; format: string | null; postStatus: string | null };
type SocialAcc = { client: string; pageName: string; igUsername: string | null; igAvatar: string | null; status: string; lastError: string | null };
const PLATFORM_NAME: Record<string, string> = { instagram: "Instagram", facebook: "Facebook" };
const JOB_LABEL: Record<string, [string, string, string]> = { // label, bg, fg
  scheduled: ["Scheduled", "#e8eefb", "#1d3474"], publishing: ["Publishing…", "#fdf0dc", "#8a4b12"], published: ["Published", "#e4f5ea", "#15703a"],
  failed: ["Failed", "#fdeaea", "#b42323"], check: ["Check post", "#efe9fd", "#6033c4"], missed: ["Missed", "#eef0f4", "#4b5466"],
};
/* What goes out: caption, then keywords as hashtags (no repeats, ≤30 hashtags,
   ≤2,200 characters) — the same rules the server publishes with. */
const HASH_RE = /#[\p{L}\p{N}_]+/gu;
function composeCaption(p: Partial<Post>) {
  const caption = String(p.caption || "").trim();
  const have = new Set((caption.match(HASH_RE) || []).map((h) => h.toLowerCase()));
  const extra: string[] = [];
  if (p.keywordHashtags !== false) {
    for (const raw of String(p.keywords || "").split(/[,\n;|]+/)) {
      const tag = "#" + raw.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]+/gu, "");
      if (tag.length < 2 || have.has(tag.toLowerCase())) continue;
      have.add(tag.toLowerCase()); extra.push(tag);
    }
  }
  const room = Math.max(0, 30 - (caption.match(HASH_RE) || []).length);
  return { caption, tags: extra.slice(0, room), text: [caption, extra.slice(0, room).join(" ")].filter(Boolean).join("\n\n").slice(0, 2200) };
}
const isVideoMedia = (m: Media) => m.type === "video" || /\.(mp4|mov|m4v)(\?|$)/i.test(m.url);
type Client = { id: number; name: string; color?: string };
type User = { id: number; name: string; avatar?: string | null; roles?: string[] };
type View = "board" | "schedule" | "calendar" | "mine";

const STAGES: { id: Stage; title: string; owner: string; color: string; bg: string; fg: string }[] = [
  { id: "planned", title: "Planned", owner: "Marketer", color: "#6b7590", bg: "#eef0f4", fg: "#4b5466" },
  { id: "client", title: "Need from client", owner: "Marketer", color: "#d97706", bg: "#fdf0dc", fg: "#9a4b06" },
  { id: "production", title: "In production", owner: "Graphic designer → Video editor", color: "#3e60ab", bg: "#e6ecf8", fg: "#2f55a4" },
  { id: "approval", title: "Pending approval", owner: "Admin approves", color: "#0e7490", bg: "#e0f2f7", fg: "#0e5f74" },
  { id: "ready", title: "Ready to post", owner: "Social media", color: "#7c5cff", bg: "#efeaff", fg: "#5b35c9" },
  { id: "posted", title: "Posted", owner: "Social media", color: "#16a34a", bg: "#e4f5ea", fg: "#15703a" },
];
/* Who works on a post at each stage — same rule as the server. */
type Role = "marketer" | "video" | "graphic" | "admin" | "social";
const ROLE_META: Record<Role, { label: string; fg: string; bg: string; does: string }> = {
  marketer: { label: "Marketer", fg: "#9a4b06", bg: "#fdf0dc", does: "Plans & shoots" },
  video: { label: "Video editor", fg: "#b0185a", bg: "#fbe6ef", does: "Edits the video" },
  graphic: { label: "Graphic designer", fg: "#0f6b62", bg: "#dff3f0", does: "Designs it" },
  admin: { label: "Approver", fg: "#0e5f74", bg: "#e0f2f7", does: "Approves it" },
  social: { label: "Social media manager", fg: "#2f55a4", bg: "#e6ecf8", does: "Approves & posts it" },
};
/* Two people per post, picked at sheet upload: the maker (Video editor for
   reels / videos, Graphic designer for everything else) uploads the finished
   work and clicks Done → the Social media manager approves it and it's
   scheduled. Same rule as the server. */
const CHAIN: Role[] = ["graphic", "video", "social"];
const isVideoFormat = (format?: string | null) => /reel|video/i.test(format || "");
const makerFor = (format?: string | null): Role => (isVideoFormat(format) ? "video" : "graphic");
const roleFor = (status: Stage, format?: string | null, step?: string | null): Role =>
  (status === "ready" || status === "posted" || status === "approval") ? "social"
    : status === "production" ? (step === "video" || step === "graphic" ? step : makerFor(format)) : makerFor(format);
/* What "Done" does from here: the next person in the chain. */
/* Where each person's step starts. */
const STEP_AT: Record<Role, { status: Stage; step?: string }> = {
  marketer: { status: "planned" }, graphic: { status: "production", step: "graphic" }, video: { status: "production", step: "video" },
  admin: { status: "approval" }, social: { status: "ready" },
};
/* What "Done" does from here: the next step in the chain. Steps nobody was
   picked for at upload (designer / video editor) are skipped — e.g. a post
   with no video editor goes from the designer straight to approval. */
function nextHop(p: Pick<Post, "status" | "step" | "team" | "format">): { role: Role; patch: { status?: Stage; step?: string } } | null {
  if (p.status === "posted" || p.status === "ready") return null; // Ready to post → posts itself (or Mark as posted)
  // Planned / Need from client → the maker starts work.
  if (p.status === "planned" || p.status === "client") { const m = makerFor(p.format); return { role: m, patch: STEP_AT[m] }; }
  // Maker done → Social media manager checks it (Pending approval); approving schedules it.
  if (p.status === "production") return { role: "social", patch: { status: "approval" } };
  if (p.status === "approval") return { role: "social", patch: STEP_AT.social };
  return null;
}
const CLIENT_COLORS = ["#3e60ab", "#0f766e", "#be185d", "#a16207", "#7c5cff", "#0369a1", "#c2410c", "#15803d"];
const FORMATS = ["Post", "Reel", "Carousel", "Video", "Story", "Influencer Reel"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const COL_PAGE = 20; // cards per board column before "Show more"
/* Fields the drawer edits — time log + timer are written separately so a save never clobbers them. */
const EDITABLE: (keyof Post)[] = ["team", "step", "client", "status", "postDate", "postTime", "dueDate", "assigneeId", "estimateHours", "festive", "theme", "topic",
  "format", "requirements", "reference", "dataStatus", "poc", "caption", "driveLink", "tags", "keywords", "channels", "remarks",
  "media", "publishTo", "keywordHashtags"];

/* Left out of the board's "card" list (?fields=card) and fetched with the
   full post (GET /social-posts/:id) when its details card or editor opens. */
const HEAVY: (keyof Post)[] = ["caption", "requirements", "remarks", "reference", "tags", "keywords", "timeLog", "poc", "driveLink", "estimateHours"];
const heavyOf = (p: Partial<Post>, skip?: Set<keyof Post>) =>
  Object.fromEntries(HEAVY.filter((k) => k in p && !skip?.has(k)).map((k) => [k, p[k]])) as Partial<Post>;

/* JSON columns can come back as strings on some MySQL setups — coerce. */
function toArr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.trim().startsWith("[")) { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } }
  return [];
}
/* A post is "full" when the server sent every heavy field (older backends
   ignore ?fields=card and always do). Heavy fields that weren't sent stay
   absent, so a save can tell "not loaded" from "empty". */
const normPost = (p: Post): Post => ({
  ...p,
  _full: HEAVY.every((k) => k in p),
  postDate: p.postDate ? String(p.postDate).slice(0, 10) : null,
  dueDate: p.dueDate ? String(p.dueDate).slice(0, 10) : null,
  ...("timeLog" in p ? { timeLog: toArr<LogEntry>(p.timeLog) } : {}),
  ...("estimateHours" in p ? { estimateHours: p.estimateHours != null ? Number(p.estimateHours) : null } : {}),
  media: toArr<Media>(p.media),
  publishTo: p.publishTo == null ? null : toArr<string>(p.publishTo),
  keywordHashtags: p.keywordHashtags === undefined ? true : !!p.keywordHashtags,
  team: typeof p.team === "string" ? (() => { try { return JSON.parse(p.team as unknown as string) || {}; } catch { return {}; } })() : (p.team || {}),
});
const uid = () => "tl-" + Math.random().toString(36).slice(2, 9);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayIso = () => iso(new Date());
/* Default work deadline: one week before go-live (same rule as the server). */
const weekBefore = (d?: string | null) => (d ? addDays(String(d).slice(0, 10), -7) : "");
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const daysFrom = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
function fmtDay(d?: string | null) {
  if (!d) return "No date";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
/* "26 Oct" */
function fmtShort(d?: string | null) {
  if (!d) return "—";
  return new Date(String(d).slice(0, 10) + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
/* Format chip colours: [background, text]. */
function formatColors(f?: string): [string, string] {
  const s = (f || "").toLowerCase();
  if (s.includes("reel") || s.includes("video") || s.includes("influencer")) return ["#fbe6ef", "#b0185a"];
  if (s.includes("carousel")) return ["#fbf0d6", "#8a5a00"];
  if (s.includes("story")) return ["#dff3f0", "#0f6b62"];
  if (s.includes("post")) return ["#e0f2f7", "#0b6a85"];
  return ["#eef0f4", "#4b5466"];
}
const isDone = (p: Post) => p.status === "posted";
/* Live = a real post link (http…) is in the channel links — plain text like
   "Instagram" from a sheet doesn't count. */
const hasLiveLink = (p: Partial<Post>) => /https?:\/\//i.test(p.channels || "");
/* Timeline: `dueDate` holds the day work starts (default a week before
   go-live); the go-live date is the real deadline. */
const startOn = (p: Post) => p.dueDate || p.postDate || "";
const isOverdue = (p: Post) => !isDone(p) && !!p.postDate && p.postDate < todayIso();
const TL = { over: ["#fde8e8", "#b91c1c"], soon: ["#fdf0dc", "#9a4b06"], live: ["#e6ecf8", "#2f55a4"], wait: ["#eef0f4", "#4b5466"], done: ["#e4f5ea", "#15703a"] };
function dueInfo(p: Post) {
  if (isDone(p)) return { cls: "done", text: "Posted", days: 0, bg: TL.done[0], fg: TL.done[1] };
  if (!(p.postDate || p.dueDate)) return null;
  const t = todayIso();
  const mk = (cls: keyof typeof TL, text: string, days: number) => ({ cls, text, days, bg: TL[cls][0], fg: TL[cls][1] });
  if (isOverdue(p)) { const d = daysFrom(p.postDate as string, t); return mk("over", `Overdue ${d}d`, -d); }
  if (p.dueDate && p.dueDate > t) { const d = daysFrom(t, p.dueDate); return mk(d <= 2 ? "soon" : "wait", `Starts in ${d}d`, d); }
  if (p.dueDate === t) return mk("soon", "Start today", 0);
  if (!p.postDate) return null;
  const d = daysFrom(t, p.postDate);
  return mk(d <= 3 ? "soon" : "live", d === 0 ? "Goes live today" : `Goes live in ${d}d`, d);
}
/* How far today is between the start-work day and go-live (0–100). */
function progressPct(p: Post) {
  if (isDone(p)) return 100;
  if (!p.postDate) return 0;
  const start = p.dueDate || weekBefore(p.postDate);
  const span = Math.max(1, daysFrom(start, p.postDate));
  return Math.max(0, Math.min(100, Math.round((daysFrom(start, todayIso()) / span) * 100)));
}

/* ── CSV import (a client's media-calendar sheet, saved from Excel as CSV) ── */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
type SheetKey = keyof Post | "date" | "day" | "contentTheme" | "concept" | "headline" | "visual" | "cta";
const HEADERS: [SheetKey, RegExp][] = [
  ["date", /^date/], ["day", /^days?$/], ["festive", /festiv|occasion/], ["contentTheme", /^content theme/], ["theme", /theme/], ["topic", /topic/],
  ["requirements", /requirement/], ["reference", /reference/], ["format", /reel|carousel|format|post type|content type/],
  ["dataStatus", /data\s*status|content status/], ["poc", /point of contact|^poc/], ["caption", /caption/], ["driveLink", /drive/],
  ["tags", /people|tag/], ["keywords", /keyword/], ["channels", /channel/], ["remarks", /remark/],
  ["concept", /concept/], ["headline", /headline/], ["visual", /visual|design direction/], ["cta", /^cta|engagement/],
];
const MONTHS3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function parseSheetDate(raw: string, dayName: string): string | null {
  const s = raw.trim(); if (!s) return null;
  // Excel date serial (a date cell read from an .xlsx file)
  if (/^\d{5}(\.\d+)?$/.test(s)) return iso(new Date(1899, 11, 30 + Math.floor(+s)));
  // "02 Nov 2026", "2-Nov-26", "Nov 2, 2026"
  let m = s.match(/^(\d{1,2})[\s.-]+([a-z]{3})[a-z]*[\s.,-]+(\d{2,4})$/i) || null;
  if (m && MONTHS3.includes(m[2].toLowerCase())) return iso(new Date(m[3].length === 2 ? 2000 + +m[3] : +m[3], MONTHS3.indexOf(m[2].toLowerCase()), +m[1]));
  m = s.match(/^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m && MONTHS3.includes(m[1].toLowerCase())) return iso(new Date(+m[3], MONTHS3.indexOf(m[1].toLowerCase()), +m[2]));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const make = (d: number, mo: number) => (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? iso(new Date(y, mo - 1, d)) : null);
    const dm = make(a, b), md = make(b, a);
    if (dm && !md) return dm;
    if (md && !dm) return md;
    // Ambiguous (both ≤ 12) — the sheet's "Days" column tells us which one is right.
    const wd = WEEKDAYS.findIndex((w) => dayName.trim().toLowerCase().startsWith(w.slice(0, 3)));
    if (wd >= 0 && md && new Date(md + "T00:00:00").getDay() === wd && new Date(dm + "T00:00:00").getDay() !== wd) return md;
    return dm; // default to Indian day/month order
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : iso(new Date(t));
}
function sheetToPosts(rows: string[][], client: string): Partial<Post>[] {
  const h = rows.findIndex((r) => r.some((c) => /theme/i.test(c)));
  if (h < 0) return [];
  const col: Record<string, number> = {};
  rows[h].forEach((raw, i) => {
    const name = raw.trim().toLowerCase().replace(/\s+/g, " ");
    const hit = HEADERS.find(([key, re]) => col[key] === undefined && re.test(name));
    if (hit) col[hit[0]] = i;
  });
  // Placeholder cells ("—", "Pending", "TBD") count as empty.
  const get = (r: string[], k: string) => { const v = col[k] !== undefined ? String(r[col[k]] ?? "").trim() : ""; return /^(—|-|–|n\/?a|tbd|pending)$/i.test(v) ? "" : v; };
  // Sheets with a "Content Theme" category plus a "Post Topic": the topic is the post's title.
  const titleFromTopic = col.theme === undefined && col.contentTheme !== undefined && col.topic !== undefined;
  const out: Partial<Post>[] = [];
  for (const r of rows.slice(h + 1)) {
    const postDate = parseSheetDate(get(r, "date"), get(r, "day"));
    const flat = (k: string) => get(r, k).replace(/\s*\n\s*/g, " ");
    const theme = titleFromTopic ? flat("topic") : flat("theme"), channels = get(r, "channels");
    if (!postDate || (!theme && !flat("topic") && !channels)) continue;
    const ds = flat("dataStatus").replace(/^\((.*)\)$/, "$1");
    const caption = get(r, "caption"), driveLink = get(r, "driveLink");
    const status: Stage = "planned"; // uploaded sheet rows start at the beginning of the pipeline
    const format = get(r, "format").replace(/caraousel/gi, "carousel").replace(/\s*[\\/]\s*/g, " / ")
      .toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase()).trim();
    // Brief columns (concept, headline, visual direction, CTA) go into the requirements.
    const brief = ([["Content theme", "contentTheme"], ["Graphic headline", "headline"], ["Visual / design direction", "visual"], ["CTA", "cta"]] as const)
      .map(([label, k]) => (get(r, k) ? `${label}: ${get(r, k)}` : "")).filter(Boolean);
    const requirements = [get(r, "requirements"), ...brief].filter(Boolean).join("\n");
    out.push({
      client, status, postDate, theme: theme || "Untitled post", topic: titleFromTopic ? flat("concept") : (flat("topic") || flat("concept")), festive: flat("festive"), format,
      requirements, reference: get(r, "reference"), dataStatus: ds, poc: get(r, "poc"),
      caption, driveLink, tags: get(r, "tags"), keywords: get(r, "keywords"), channels, remarks: get(r, "remarks"),
      ...(titleFromTopic && flat("contentTheme") ? { altTheme: flat("contentTheme") } : {}),
    } as Partial<Post>);
  }
  return out;
}

function initials(name = "") { return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"; }

export default function SocialCalendar() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [clientRows, setClientRows] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  // Brand access set by an admin: false = every brand (admin), true = only assigned brands + own posts.
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState("");
  const [view, setView] = useState<View>("board");
  const [month, setMonth] = useState("");
  const [format, setFormat] = useState("");
  const [who, setWho] = useState("");
  const [query, setQuery] = useState("");
  const [calMonth, setCalMonth] = useState("");
  const [calDay, setCalDay] = useState(todayIso());
  const [showStarts, setShowStarts] = useState(true);
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [viewId, setViewId] = useState<number | null>(null); // read-only details card
  type TeamUser = { id: number; name: string; roles: string[]; socialClients: string[]; active: boolean };
  const [team, setTeam] = useState<TeamUser[]>([]);           // admin only: who holds which role / brands
  type Upload = { importBatch: string; client: string; posts: number; from: string; to: string; uploadedAt: string };
  const [uploads, setUploads] = useState<Upload[] | null>(null); // admin Team & uploads panel (null = closed)
  const coverScrolled = useRef("");
  const [coverEdit, setCoverEdit] = useState<{ brand: string; role: Role } | null>(null); // "who covers" cell being edited
  const [coverBusy, setCoverBusy] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  // Board columns render COL_PAGE cards at first; "Show N more" adds the next batch.
  const [colShown, setColShown] = useState<Partial<Record<Stage, number>>>({});
  const [, setTick] = useState(0);
  const dragId = useRef<number | null>(null);
  const firstLoadDone = useRef(false);
  // Auto-publishing
  const [accounts, setAccounts] = useState<SocialAcc[]>([]);
  const [metaOk, setMetaOk] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<PubJob[]>([]);
  const [metaPick, setMetaPick] = useState<{ sel: string; brand: string; pages: { pageId: string; pageName: string; igUsername: string | null }[]; chosen: string } | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function loadPublishing() {
    const [a, j, st] = await Promise.all([api.socialAccounts().catch(() => []), api.publishJobs().catch(() => []), api.metaStatus().catch(() => null)]);
    setAccounts(Array.isArray(a) ? a : []); setJobs(Array.isArray(j) ? j : []); setMetaOk(st ? !!st.configured : null);
  }
  /* Back from Facebook's login: pick which Page (and its Instagram) is this brand's. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const sel = q.get("metaConnect"), err = q.get("metaError");
    if (!sel && !err) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (err) { toast("Couldn't connect", "err", { description: err }); return; }
    api.metaPages(sel as string).then((r) => {
      const best = r.pages.find((x: { igUsername: string | null }) => x.igUsername) || r.pages[0];
      setMetaPick({ sel: sel as string, brand: r.brand, pages: r.pages, chosen: best?.pageId || "" });
    }).catch((e) => toast("Couldn't finish connecting", "err", { description: e.message }));
  }, []);

  async function load() {
    try {
      const [p, c, u, me] = await Promise.all([
        api.listSocialPosts({ fields: "card" }), api.list("social-clients"),
        api.listUsers().catch(() => []), api.me().catch(() => null),
      ]);
      // Light card posts. Heavy fields already fetched for a post are kept so an
      // open details card doesn't flicker; it is re-fetched (it's no longer _full).
      setPosts((prev) => {
        const had = new Map(prev.map((x) => [x.id, x]));
        return (Array.isArray(p) ? p : []).map((raw: Post) => {
          const n = normPost(raw), old = had.get(n.id);
          return n._full || !old ? n : { ...heavyOf(old), ...n, _full: false };
        });
      });
      setClientRows(Array.isArray(c) ? c : []);
      setUsers(Array.isArray(u) ? u : []);
      setMeId((me?.user ?? me)?.id ?? null);
      const isLimited = Array.isArray((me?.user ?? me)?.socialClients);
      setLimited(isLimited);
      // Team members start on My work — only when the page first opens, not
      // on the reload after every save (that would yank them off Board).
      if (isLimited && !firstLoadDone.current) setView((v) => (v === "board" ? "mine" : v));
      firstLoadDone.current = true;
      if (!isLimited) api.list("users").then((t) => setTeam(Array.isArray(t) ? t : [])).catch(() => {});
      loadPublishing();
    } catch (e: any) { toast("Couldn't load the content calendar", "err", { description: e.message || "Check your connection and refresh the page." }); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    load();
    try { setView((localStorage.getItem("fv_social_view") as View) || "board"); setClient(localStorage.getItem("fv_social_client") || ""); } catch { /* ignore */ }
  }, []);
  // Re-render every 30s so "Goes live in…" / overdue labels stay current — only while the tab is visible.
  useEffect(() => visibleInterval(() => setTick((n) => n + 1), 30000), []);

  /* Full post for the open details card / editor: the card data shows at
     once; caption, requirements etc. fill in when this arrives. Fields the
     person already typed into in the editor are never overwritten. */
  const fullBusy = useRef(new Set<number>());
  const dirty = useRef(new Set<keyof Post>()); // editor fields changed by hand since it opened
  async function fetchFull(id: number): Promise<Post | null> {
    try {
      const full = normPost(await api.getSocialPost(id));
      if (!full?.id) return null;
      full._full = true;
      setPosts((ps) => ps.map((x) => (x.id === id ? { ...x, ...full } : x)));
      setEditing((e) => (e?.id === id && !e._full ? { ...e, ...heavyOf(full, dirty.current), _full: true } : e));
      return full;
    } catch { return null; }
  }
  /* ?post=ID (links from the home page and notifications) opens that post's
     details once the board has loaded, even if it's outside the loaded dates. */
  const deepLinked = useRef(false);
  useEffect(() => {
    if (loading || deepLinked.current || typeof window === "undefined") return;
    deepLinked.current = true;
    const url = new URL(window.location.href);
    const id = Number(url.searchParams.get("post"));
    if (!id) return;
    url.searchParams.delete("post");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
    if (posts.some((x) => x.id === id)) { setViewId(id); return; }
    fetchFull(id).then((full) => {
      if (!full) { toast("That post isn't available", "info", { description: "It may have been deleted, or it belongs to a brand you can't see." }); return; }
      setPosts((ps) => (ps.some((x) => x.id === id) ? ps : [...ps, full]));
      setViewId(id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  const viewedFull = viewId != null ? !!posts.find((x) => x.id === viewId)?._full : true;
  const editingFull = editing?.id ? !!editing._full : true;
  useEffect(() => {
    const id = editing?.id ?? viewId;
    if (id == null || (editing?.id ? editingFull : viewedFull) || fullBusy.current.has(id)) return;
    fullBusy.current.add(id);
    fetchFull(id).finally(() => fullBusy.current.delete(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, editing?.id, viewedFull, editingFull]);
  /* Saved post from a PUT/POST response (always the full row) → the board. */
  function applySaved(saved: Post | null | undefined) {
    if (!saved?.id) return false;
    const n = { ...normPost(saved), _full: true };
    setPosts((ps) => (ps.some((x) => x.id === n.id) ? ps.map((x) => (x.id === n.id ? n : x)) : [...ps, n]));
    return true;
  }
  /* One post changed on the server (publishing, mark posted) — re-read just it. */
  const refreshPost = (id: number) => { fetchFull(id); };
  useEffect(() => {
    if (viewId == null || editing) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setViewId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewId, editing]);
  useEffect(() => { try { localStorage.setItem("fv_social_view", view); localStorage.setItem("fv_social_client", client); } catch { /* ignore */ } }, [view, client]);

  const clientNames = useMemo(
    () => [...new Set([...clientRows.map((c) => c.name), ...posts.map((p) => p.client)].filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [clientRows, posts],
  );
  const clientColor = (name?: string) => clientRows.find((c) => c.name === name)?.color
    || CLIENT_COLORS[Math.max(0, clientNames.indexOf(name || "")) % CLIENT_COLORS.length];
  const userById = (id?: number | null) => users.find((u) => u.id === id);
  const scope = posts.filter((p) => !client || p.client === client);
  const months = [...new Set(scope.map((p) => (p.postDate || "").slice(0, 7)).filter(Boolean))].sort().reverse();
  const formats = [...new Set(scope.map((p) => p.format).filter(Boolean) as string[])].sort();
  const list = scope
    .filter((p) => (!month || (p.postDate || "").startsWith(month)) && (!format || p.format === format)
      && (!who || (who === "none" ? !p.assigneeId : String(p.assigneeId) === who))
      && (!query || [p.theme, p.topic, p.caption, p.festive, p.keywords, p.remarks].join(" ").toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => (a.postDate || "9").localeCompare(b.postDate || "9") || (a.postTime || "99").localeCompare(b.postTime || "99"));

  /* Admin: people who could take a post at a role for a brand (role + brand ticked). */
  const candidates = (role: Role, brand: string, exceptId?: number | null) => {
    const brandId = String(clientRows.find((c) => c.name === brand)?.id ?? "");
    return team.filter((u) => u.active !== false && u.id !== exceptId && (u.roles || []).includes(role)
      && ((u.roles || []).includes("admin") || (u.socialClients || []).map(String).includes(brandId)));
  };

  /* Admin: tick / untick a person for a brand at a role, from the "Who covers
     each brand" table. Someone without the role gets it added at the same time.
     The server then hands waiting posts to them. */
  async function toggleCover(u: TeamUser, brand: string, role: Role) {
    const brandId = String(clientRows.find((c) => c.name === brand)?.id ?? "");
    if (!brandId) return toast("Save the brand first", "warn", { description: `${brand} isn't a saved brand yet.` });
    const brands = (u.socialClients || []).map(String);
    const covers = brands.includes(brandId) && (u.roles || []).includes(role);
    const nextBrands = covers ? brands.filter((b) => b !== brandId) : [...new Set([...brands, brandId])];
    const nextRoles = covers || (u.roles || []).includes(role) ? u.roles : [...(u.roles || []), role];
    setCoverBusy(u.id);
    try {
      await api.update("users", u.id, { socialClients: nextBrands, roles: nextRoles });
      setTeam((t) => t.map((x) => (x.id === u.id ? { ...x, socialClients: nextBrands, roles: nextRoles } : x)));
      toast(covers ? `${u.name} no longer covers ${brand}` : `${u.name} now covers ${brand}`, "ok", {
        description: covers ? `As ${ROLE_META[role].label}.` : `As ${ROLE_META[role].label}${(u.roles || []).includes(role) ? "" : " (role added)"} — waiting posts go to them now.`,
      });
      load();
    } catch (e: any) { toast("Couldn't update", "err", { description: e.message || "Try again." }); }
    finally { setCoverBusy(null); }
  }

  /* Admin: take a role away from someone (all brands). Their open posts at
     that stage are unassigned first, so the server hands them to someone else
     with the role (or they wait). A user's last role can't be removed here —
     a user with no roles would be treated as an admin. */
  async function removeRole(u: TeamUser, role: Role) {
    const label = ROLE_META[role].label;
    const roles = (u.roles || []).filter((r) => r !== role);
    if (!roles.length) {
      return dialog.alert({
        title: `${label} is ${u.name}'s only role`,
        message: `Give ${u.name} another role first (tick them for a brand under another role), or deactivate them on the Users page.`,
        confirmText: "OK",
      });
    }
    const theirs = posts.filter((p) => p.assigneeId === u.id && p.status !== "posted" && roleFor(p.status, p.format, p.step) === role);
    const ok = await dialog.confirm({
      title: `Remove the ${label} role from ${u.name}?`,
      message: `They'll stop covering every brand as ${label}.${theirs.length ? ` Their ${theirs.length} open ${label} post${theirs.length === 1 ? "" : "s"} will go to someone else with the role, or wait if nobody has it.` : ""}`,
      confirmText: "Remove role", danger: true,
    });
    if (!ok) return;
    setCoverBusy(u.id);
    try {
      for (const p of theirs) await api.update("social-posts", p.id, { assigneeId: null });
      await api.update("users", u.id, { roles });
      setTeam((t) => t.map((x) => (x.id === u.id ? { ...x, roles } : x)));
      toast(`${u.name} is no longer ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label}`, "ok", {
        description: !theirs.length ? "Nothing of theirs needed handing on."
          : team.some((x) => x.id !== u.id && x.active !== false && (x.roles || []).includes(role))
            ? `${theirs.length} open post${theirs.length === 1 ? "" : "s"} handed on to others with the role.`
            : `${theirs.length} open post${theirs.length === 1 ? "" : "s"} now waiting — nobody else has the ${label} role yet.`,
      });
      load();
    } catch (e: any) { toast("Couldn't remove the role", "err", { description: e.message || "Try again." }); }
    finally { setCoverBusy(null); }
  }

  /* ── auto-publishing ── */
  const accFor = (brand?: string) => accounts.find((a) => a.client === brand && a.status === "connected");
  const jobsFor = (id?: number) => jobs.filter((j) => j.postId === id);
  const platformsFor = (p: Partial<Post>) => {
    const a = accFor(p.client); if (!a) return [] as string[];
    const connected = [...(a.igUsername ? ["instagram"] : []), "facebook"];
    return p.publishTo == null ? connected : connected.filter((x) => (p.publishTo || []).includes(x));
  };
  async function connectBrand(brand: string) {
    try { const r = await api.metaStart(brand); window.location.href = r.authUrl; }
    catch (e: any) { toast("Couldn't start connecting", "err", { description: e.message }); }
  }
  async function finishConnect() {
    if (!metaPick?.chosen) return;
    try {
      const a = await api.metaChoose(metaPick.sel, metaPick.chosen);
      setMetaPick(null);
      toast(`${a.client} connected`, "ok", { description: [a.igUsername && `Instagram @${a.igUsername}`, a.pageName && `Facebook ${a.pageName}`].filter(Boolean).join(" · ") + ". Ready posts will publish at their go-live time." });
      loadPublishing();
    } catch (e: any) { toast("Couldn't connect", "err", { description: e.message }); }
  }
  async function disconnectBrand(brand: string) {
    if (!(await dialog.confirm({ title: `Disconnect ${brand}?`, message: "Its scheduled posts stop publishing automatically. You can connect it again any time.", danger: true, confirmText: "Disconnect" }))) return;
    try { await api.disconnectSocial(brand); toast(`${brand} disconnected`, "ok"); loadPublishing(); }
    catch (e: any) { toast("Couldn't disconnect", "err", { description: e.message }); }
  }
  async function retryJob(j: PubJob) {
    try { await api.retryJob(j.id); toast(`Retrying ${PLATFORM_NAME[j.platform]}`, "info", { description: j.theme }); setTimeout(() => { loadPublishing(); refreshPost(j.postId); }, 4000); }
    catch (e: any) { toast("Couldn't retry", "err", { description: e.message }); }
  }
  async function markJobPosted(j: PubJob) {
    const url = await dialog.prompt({ title: `Posted on ${PLATFORM_NAME[j.platform]}?`, message: "Paste the post's link (optional). It then counts as published.", placeholder: "https://…", confirmText: "Mark as posted" });
    if (url === null) return;
    try { await api.markJobPosted(j.id, url.trim()); toast("Marked as posted", "ok", { description: j.theme }); loadPublishing(); refreshPost(j.postId); window.dispatchEvent(new Event("fv-badges")); }
    catch (e: any) { toast("Couldn't update", "err", { description: e.message }); }
  }
  async function publishNow(p: Post) {
    const where = platformsFor(p).map((x) => PLATFORM_NAME[x]).join(" and ");
    if (!(await dialog.confirm({ title: `Publish “${p.theme}” now?`, message: `It goes live on ${where} straight away, whatever its go-live time.`, confirmText: "Publish now" }))) return;
    try { await api.publishNow(p.id); toast("Publishing…", "info", { description: `${p.theme} · ${where}` }); setTimeout(() => { loadPublishing(); refreshPost(p.id); }, 5000); }
    catch (e: any) { toast("Couldn't publish", "err", { description: e.message }); }
  }
  async function addMedia(files: FileList | null) {
    if (!files?.length || !editing) return;
    setMediaBusy(true);
    try {
      const ig = await instagramSafeAll(Array.from(files).slice(0, 10));
      const r = await api.uploadSocialMedia(ig.files);
      setEditing((e) => (e ? { ...e, media: [...(e.media || []), ...r.items].slice(0, 10) } : e));
      if (ig.summary) toast("Ready for Instagram", "ok", { description: ig.summary });
    } catch (e: any) { toast("Upload failed", "err", { description: e.message || "Use JPG/PNG images or MP4/MOV videos." }); }
    finally { setMediaBusy(false); }
  }
  /* Small status for cards and the details card. */
  function pubChip(p: Post) {
    const js = jobsFor(p.id);
    const pick = ["failed", "check", "publishing", "missed", "scheduled"].find((st) => js.some((j) => j.status === st));
    if (!pick) return null;
    const [label, bg, fg] = JOB_LABEL[pick];
    const text = pick === "scheduled" ? `Auto · ${p.postTime ? fmtTime(p.postTime) : "10:00 AM"}` : pick === "failed" ? "Auto-post failed" : label;
    return <span className="cal-chip" style={css({ "--bg": bg, "--fg": fg })}>{text}</span>;
  }

  /* ── writes ── */
  function patchLocal(id: number, patch: Partial<Post>) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setEditing((e) => (e?.id === id ? { ...e, ...patch } : e));
  }
  /* Team members can edit every post of their allotted brands (the list is
     already limited to those brands); deleting stays with the assignee. */
  const canEdit = (p?: Partial<Post> | null) => !!p;
  const canDelete = (p?: Partial<Post> | null) => !limited || (!!p && p.assigneeId === meId);
  /* Approving: admins, or the Social media manager the post is waiting with. */
  const canApprove = (p?: Partial<Post> | null) => !limited || (!!p && p.assigneeId === meId);
  const notYours = (p: Partial<Post>) => toast("This post isn't yours to delete", "warn", {
    description: `It's assigned to ${userById(p.assigneeId ?? null)?.name || "nobody yet"} — only they or an admin can delete it.`,
  });
  /* Moving to another stage asks who takes it there (nothing is assigned automatically). */
  async function moveTo(id: number, status: Stage) {
    const p = posts.find((x) => x.id === id);
    if (!p || p.status === status) return;
    if (!canEdit(p)) return notYours(p);
    if (status !== "posted") {
      const step = status === "production" ? "graphic" : null;
      return askHandoff(p, roleFor(status, p.format, step), { status, ...(step ? { step } : {}) }, "move");
    }
    patchLocal(id, { status });
    try {
      // The server hands the post to the next stage's role — show the new assignee straight away.
      const saved = await api.update("social-posts", id, { status });
      if (!applySaved(saved)) patchLocal(id, { assigneeId: saved?.assigneeId ?? null, step: saved?.step ?? null });
      window.dispatchEvent(new Event("fv-badges")); // overdue count in the sidebar
      loadPublishing(); // Ready → scheduled, or a schedule cancelled
      const who = users.find((u) => u.id === saved?.assigneeId);
      const stageName = STAGES.find((s) => s.id === status)?.title || status;
      toast(status === "posted" ? "Marked as Posted" : `Moved to ${stageName}`, "ok", {
        description: who && who.id !== p.assigneeId ? `“${p.theme}” is now with ${who.name}.` : `“${p.theme}” · ${p.client}`,
      });
    }
    catch (e: any) { patchLocal(id, { status: p.status }); toast("Couldn't move the post", "err", { description: e.message || "It's back where it was — try again." }); }
  }
  /* Done → the next person in the chain gets it (picked by the server). */
  /* Approver: send it back to the video editor with a note. */
  /* Send back → to the maker who made it (Video editor for reels, Graphic designer otherwise). */
  function sendBack(p: Post) { const m = makerFor(p.format); askHandoff(p, m, STEP_AT[m], "back"); }

  /* Hand-off picker: every move asks who takes the post next. The person
     picked at upload (the post's team) is pre-selected. */
  type Handoff = { post: Post; role: Role; patch: Partial<Post>; kind: "next" | "approve" | "back" | "move"; chosen: number | null; note: string; busy: boolean;
    late?: boolean; when?: "now" | "pick"; newDate?: string; newTime?: string };
  /* Go-live time already passed (date before today, or today with the time gone). */
  const liveTimePassed = (p: Post) => {
    if (!p.postDate) return false;
    const t = todayIso();
    if (p.postDate < t) return true;
    if (p.postDate > t) return false;
    const m = /^(\d{1,2}):(\d{2})/.exec(p.postTime || "10:00");
    const [nh, nm] = hhmm(new Date()).split(":").map(Number);
    return !!m && nh * 60 + nm > +m[1] * 60 + +m[2];
  };
  // Go-live times are India time, whatever timezone the browser is in.
  const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const istToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const peopleFor = (role: Role) => users.filter((u) => (u.roles || []).includes(role));
  function askHandoff(p: Post, role: Role, patch: Partial<Post>, kind: Handoff["kind"]) {
    const picked = p.team?.[role] ?? null;
    const list = peopleFor(role);
    const late = kind === "approve" && liveTimePassed(p);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    setHandoff({ post: p, role, patch, kind, note: "", busy: false, chosen: picked ?? (list.length === 1 ? list[0].id : null),
      late, when: "now", newDate: iso(tomorrow), newTime: p.postTime?.slice(0, 5) || "10:00" });
  }
  async function confirmHandoff() {
    if (!handoff) return;
    const { post: p, role, kind, chosen, note } = handoff;
    let patch = handoff.patch;
    // Approving an overdue post: it goes live now, or at the new date and time picked.
    if (handoff.late) {
      if (handoff.when === "pick") {
        if (!handoff.newDate) return toast("Pick the new go-live date", "warn");
        patch = { ...patch, postDate: handoff.newDate, postTime: handoff.newTime || "10:00", dueDate: weekBefore(handoff.newDate) };
      } else {
        patch = { ...patch, postDate: istToday(), postTime: hhmm(new Date(Date.now() + 2 * 60000)) };
      }
    }
    setHandoff({ ...handoff, busy: true });
    const ok = await applyHandoff(p, role, patch, kind, chosen, note);
    if (ok) setHandoff(null); else setHandoff((h) => (h ? { ...h, busy: false } : h));
  }
  /* Hand the post over: save stage + person, then tell everyone what happened. */
  async function applyHandoff(p: Post, role: Role, patch: Partial<Post>, kind: Handoff["kind"], chosen: number | null, note = ""): Promise<boolean> {
    const team = { ...(p.team || {}), [role]: chosen };
    const body: Record<string, unknown> = { ...patch, assigneeId: chosen, team };
    try {
      if (kind === "back" && note.trim()) {
        // The note goes on top of the existing remarks — load them first if the board only has the card.
        const remarks = p._full ? p.remarks : (await fetchFull(p.id))?.remarks;
        if (!p._full && remarks === undefined) throw new Error("Couldn't load the post's remarks — try again.");
        const stamp = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
        body.remarks = [`Changes requested (${stamp}): ${note.trim()}`, remarks].filter(Boolean).join("\n");
      }
      const saved = await api.update("social-posts", p.id, body);
      if (!applySaved(saved)) patchLocal(p.id, { ...(patch as Partial<Post>), team, assigneeId: saved?.assigneeId ?? chosen, step: saved?.step ?? null, ...(body.remarks ? { remarks: body.remarks as string } : {}) });
      window.dispatchEvent(new Event("fv-badges"));
      loadPublishing();
      const who = users.find((u) => u.id === chosen);
      const head = kind === "approve" ? "Approved — scheduled" : kind === "back" ? "Sent back for changes" : kind === "move" ? `Moved to ${STAGES.find((x) => x.id === patch.status)?.title || "the next stage"}` : `Sent to ${ROLE_META[role].label}`;
      toast(head, "ok", { description: who ? `“${p.theme}” is now with ${who.name}.` : `“${p.theme}” waits until someone is picked.` });
      return true;
    } catch (e: any) { toast("Couldn't hand it over", "err", { description: e.message }); return false; }
  }
  /* Finished work: upload the final design / video straight onto the post. */
  const [workBusy, setWorkBusy] = useState<number | null>(null);
  async function uploadWork(p: Post, files: FileList | null) {
    if (!files?.length) return;
    setWorkBusy(p.id);
    try {
      const ig = await instagramSafeAll(Array.from(files).slice(0, 10));
      const r = await api.uploadSocialMedia(ig.files);
      const media = [...(p.media || []), ...r.items].slice(0, 10);
      const saved = await api.update("social-posts", p.id, { media });
      if (!applySaved(saved)) patchLocal(p.id, { media });
      toast(`${r.items.length} file${r.items.length === 1 ? "" : "s"} added`, "ok", { description: `“${p.theme}” · finished work${ig.summary ? ` · ${ig.summary}` : ""}` });
    } catch (e: any) { toast("Upload failed", "err", { description: e.message || "Use JPG/PNG images or MP4/MOV videos." }); }
    finally { setWorkBusy(null); }
  }
  async function removeWork(p: Post, i: number) {
    const media = (p.media || []).filter((_, k) => k !== i);
    try { const saved = await api.update("social-posts", p.id, { media }); if (!applySaved(saved)) patchLocal(p.id, { media }); }
    catch (e: any) { toast("Couldn't remove it", "err", { description: e.message }); }
  }

  /* Done: goes straight to the person picked at upload; asks only when nobody was picked. */
  function advance(p: Post) {
    const hop = nextHop(p);
    if (!hop) return moveTo(p.id, "posted");
    // The maker must upload the finished work before handing it on.
    if (p.status === "production" && !(p.media || []).length) {
      return toast("Upload the finished work first", "warn", { description: isVideoFormat(p.format) ? "Add the edited video, then click Done." : "Add the final design (JPG), then click Done." });
    }
    const kind = p.status === "approval" ? "approve" : "next";
    const picked = p.team?.[hop.role];
    // Overdue approval always asks when it should go live.
    if (picked && users.some((u) => u.id === picked) && !(kind === "approve" && liveTimePassed(p))) { applyHandoff(p, hop.role, hop.patch, kind, picked); return; }
    askHandoff(p, hop.role, hop.patch, kind);
  }
  const doneLabel = (p: Post) => {
    const hop = nextHop(p);
    if (!hop) return p.status === "ready" ? "Mark as posted" : "";
    if (p.status === "approval") return canApprove(p) ? "Approve & schedule" : "";
    const picked = users.find((u) => u.id === p.team?.[hop.role]);
    const where = picked ? picked.name.split(" ")[0] : ROLE_META[hop.role].label;
    return `Done → ${where}`;
  };
  async function savePost(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.client?.trim() || !editing?.theme?.trim()) return toast("Add a brand and a post theme", "warn", { description: "Both are needed before the post can be saved." });
    const body: Record<string, unknown> = {};
    // Heavy fields not loaded yet (full post still on its way) are left out
    // unless typed into, so a save never wipes them on the server.
    const partial = !!editing.id && !editing._full;
    for (const k of EDITABLE) {
      if (partial && HEAVY.includes(k) && !dirty.current.has(k)) continue;
      body[k] = editing[k] === "" ? null : editing[k] ?? null;
    }
    // A real post link on a post whose date has come means it's published.
    if (hasLiveLink(editing) && editing.postDate && String(editing.postDate).slice(0, 10) <= todayIso()) body.status = "posted";
    try {
      const saved = editing.id ? await api.update("social-posts", editing.id, body) : await api.create("social-posts", { ...body, timeLog: [] });
      let reload = false;
      if (!limited && !clientRows.some((c) => c.name === editing.client)) {
        const made = await api.create("social-clients", { name: editing.client }).catch(() => null);
        if (made?.id) setClientRows((cs) => [...cs, made]); else reload = true;
      }
      if (editing.id) setViewId(editing.id);
      // The response is the saved row (with server-set assignee / dates) — patch it in instead of reloading everything.
      if (reload || !applySaved(saved)) load();
      setEditing(null); toast(editing.id ? "Post updated" : "Post added", "ok", { description: `“${editing.theme}” · ${editing.client}` }); loadPublishing(); window.dispatchEvent(new Event("fv-badges"));
    } catch (err: any) { toast("Couldn't save the post", "err", { description: err.message || "Your changes are still in the form — try again." }); }
  }
  async function deletePost() {
    if (!editing?.id) return;
    if (!canDelete(editing)) return notYours(editing);
    if (!(await dialog.confirm({ title: "Delete this post?", message: "This can't be undone.", danger: true, confirmText: "Delete" }))) return;
    const gone = editing.id;
    await api.remove("social-posts", gone); setViewId(null); setEditing(null); toast("Post deleted", "ok", { description: `“${editing.theme}” was removed from ${editing.client}.` });
    setPosts((ps) => ps.filter((x) => x.id !== gone)); loadPublishing(); window.dispatchEvent(new Event("fv-badges"));
  }
  // Team members add posts to their own brands: pre-fill the open brand tab, or their only brand.

  /* ── time tracking ── */

  /* ── admin: why posts are waiting ── */
  const waiting = limited ? [] : posts.filter((p) => !p.assigneeId);
  const gaps = (() => {
    const out: { brand: string; role: Role; count: number }[] = [];
    for (const p of waiting) {
      const role = roleFor(p.status, p.format, p.step);
      if (candidates(role, p.client).length) continue;
      const g = out.find((x) => x.brand === p.client && x.role === role);
      if (g) g.count++; else out.push({ brand: p.client, role, count: 1 });
    }
    return out;
  })();

  /* ── admin: Team & uploads panel ── */
  async function openUploads() {
    try { setUploads(await api.listSocialUploads()); }
    catch (e: any) { toast("Couldn't load uploads", "err", { description: e.message }); }
  }
  async function deleteUpload(u: Upload) {
    if (!(await dialog.confirm({ title: `Delete this upload of ${u.posts} posts?`, message: `All ${u.posts} ${u.client} posts from the ${new Date(u.uploadedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} upload are deleted, with their time logs. This can't be undone.`, danger: true, confirmText: "Delete upload" }))) return;
    try {
      const r = await api.deleteSocialUpload(u.importBatch);
      toast("Upload deleted", "ok", { description: `${r.deleted} posts removed from ${u.client}.` });
      await openUploads(); load();
    } catch (e: any) { toast("Couldn't delete the upload", "err", { description: e.message }); }
  }
  async function deleteBrand(name: string) {
    const count = posts.filter((p) => p.client === name).length;
    const typed = await dialog.prompt({ title: `Delete all ${count} posts of ${name}?`, message: `This removes every post of this brand (uploaded or added by hand), with time logs. Type the brand name to confirm.`, placeholder: name, confirmText: "Delete all posts", danger: true });
    if (typed == null) return;
    if (typed.trim() !== name) return toast("Nothing deleted", "warn", { description: "The brand name didn't match." });
    try {
      const r = await api.deleteBrandPosts(name);
      toast("Posts deleted", "ok", { description: `${r.deleted} posts removed from ${name}.` });
      await openUploads(); load();
    } catch (e: any) { toast("Couldn't delete the posts", "err", { description: e.message }); }
  }

  /* ── import ── */
  const [brandPick, setBrandPick] = useState<{ rows: string[][]; value: string; newName: string } | null>(null);
  const [importTeam, setImportTeam] = useState<{ name: string; parsed: Partial<Post>[]; team: Partial<Record<string, number | null>>; busy: boolean } | null>(null);
  async function importCsv(file?: File) {
    if (!file) return;
    let rows: string[][];
    try { rows = /\.xlsx$/i.test(file.name) ? await readXlsx(file) : parseCsv(await file.text()); }
    catch (e: any) { return dialog.alert({ title: "Couldn't read the file", message: e.message || "Save it as .xlsx or .csv and try again." }); }
    // Pick the brand from a dropdown (or create a new one) — guessed from the selected tab or the sheet's first cell.
    const fileWords = file.name.replace(/\.(xlsx|csv)$/i, "").replace(/[_-]+/g, " ");
    const fromSheet = `${fileWords} ${(rows[0]?.find((c) => c.trim()) || "").trim()}`.toLowerCase();
    const squash = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = clientNames.find((n) => n.toLowerCase() === (client || "").toLowerCase())
      || clientNames.find((n) => squash(fromSheet).includes(squash(n)));
    const guessNew = fileWords.replace(/\b(social|media|content|calendar|sheet|posts?)\b.*$/i, "").trim().replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
    setBrandPick({ rows, value: match || (clientNames.length ? clientNames[0] : "__new"), newName: match ? "" : guessNew });
  }
  async function continueImport(rows: string[][], name: string) {
    if (!name) return;
    if (limited && !clientNames.includes(name)) return dialog.alert({ title: "Not one of your brands", message: `You can import only into: ${clientNames.join(", ") || "no brands yet"}.` });
    const parsed = sheetToPosts(rows, name);
    if (!parsed.length) return dialog.alert({ title: "No posts found", message: "The sheet needs a header row with a “Date” column and a “Post Theme” (or “Content Theme” + “Post Topic”) column." });
    if (!(await dialog.confirm({ title: `Import ${parsed.length} posts for ${name}?`, message: "Rows already on the board (same date + post theme) are updated, keeping their stage and person. Next you'll pick who does each step for these posts.", confirmText: "Next" }))) return;
    // Who does each step for these posts — chosen now, nothing is assigned automatically.
    const last = posts.filter((x) => x.client === name && x.team && Object.values(x.team).some(Boolean)).sort((x, y) => y.id - x.id)[0];
    setImportTeam({ name, parsed, team: { graphic: last?.team?.graphic ?? null, video: last?.team?.video ?? null, social: last?.team?.social ?? null }, busy: false });
  }
  async function finishImport() {
    if (!importTeam) return;
    const { name, parsed, team } = importTeam;
    setImportTeam({ ...importTeam, busy: true });
    try {
      const t = { graphic: team.graphic ?? null, video: team.video ?? null, social: team.social ?? null };
      // Each post starts with its maker: reels / videos → Video editor, everything else → Graphic designer.
      const r = await api.importSocialPosts(parsed.map((row) => ({ ...row, team: t, assigneeId: t[makerFor(row.format) as "graphic" | "video"] || null })));
      const parts = [r.created ? `${r.created} added to Planned` : "", r.updated ? `${r.updated} updated` : ""].filter(Boolean).join(", ");
      const who = [t.graphic && `posts → ${users.find((u) => u.id === t.graphic)?.name}`, t.video && `reels → ${users.find((u) => u.id === t.video)?.name}`].filter(Boolean).join(", ");
      toast(`Sheet uploaded · ${name}`, "ok", { description: `${parts || "Nothing new"}.${who ? ` New ${who}.` : ""}${limited ? " You'll see the ones assigned to you." : ""}` });
      setImportTeam(null); setClient(name); load();
    } catch (e: any) { setImportTeam((t) => (t ? { ...t, busy: false } : t)); toast("Import failed", "err", { description: e.message || "Check the file is the media calendar sheet (.xlsx or .csv)." }); }
  }

  /* ── small pieces ── */
  const css = (v: Record<string, string>) => v as unknown as React.CSSProperties;
  const badge = (p: Post) => { const d = dueInfo(p); return d ? <span className="cal-badge" style={css({ "--bg": d.bg, "--fg": d.fg })}>{d.text}</span> : null; };
  const fmtChip = (f?: string) => { if (!f) return null; const [bg, fg] = formatColors(f); return <span className="cal-chip" style={css({ "--bg": bg, "--fg": fg })}>{f}</span>; };
  const stageChip = (s: Stage) => { const st = STAGES.find((x) => x.id === s)!; return <span className="cal-chip" style={css({ "--bg": st.bg, "--fg": st.fg })}>{st.title}</span>; };
  /* Assignee pill coloured by the role the post's stage calls for. */
  const whoPill = (p: Post, size: "sm" | "md" = "sm") => {
    const u = userById(p.assigneeId);
    if (!u) return <span className={"cal-who none " + size}>Unassigned</span>;
    const r = ROLE_META[roleFor(p.status, p.format, p.step)];
    return <span className={"cal-who " + size} style={css({ "--bg": r.bg, "--fg": r.fg })} title={`${u.name} · ${r.label}`}><i>{initials(u.name)}</i>{u.name}</span>;
  };
  const progress = (p: Post) => {
    const d = dueInfo(p);
    const color = d?.cls === "over" ? "#dc2626" : isDone(p) ? "#16a34a" : d?.cls === "soon" ? "#d97706" : "#3e60ab";
    return <span className="cal-bar"><i style={{ width: `${progressPct(p)}%`, background: color }} /></span>;
  };
  const startOf = (p: Post) => p.dueDate || weekBefore(p.postDate);

  /* Render helpers are plain functions (not components) so a re-render mid-drag never remounts the board. */
  /* Stage → card tint (planned blue, production peach, approval pink, ready mint, posted sky). */
  const tintOf = (st: Stage) => (st === "production" ? "pr" : st === "approval" ? "ap" : st === "ready" ? "rd" : st === "posted" ? "po" : st === "client" ? "cl" : "pl");
  /* The team picked for this post, in order, for the avatar row. */
  const teamRow = (p: Post) => {
    const cur = roleFor(p.status, p.format, p.step);
    const ci = CHAIN.indexOf(cur);
    const rows = CHAIN.map((r, i) => ({ r, i, id: (p.team?.[r] ?? (r === cur ? p.assigneeId : null)) as number | null | undefined })).filter((x) => x.id);
    if (!rows.length && p.assigneeId) rows.push({ r: cur, i: ci, id: p.assigneeId });
    return rows.map((x) => ({ ...x, u: userById(x.id ?? null), state: isDone(p) || x.i < ci ? "done" : x.i === ci ? "now" : "next" }));
  };
  const avatars = (p: Post) => (
    <span className="fvc-stack">
      {teamRow(p).map((x) => x.u && (
        <i key={x.r} className={x.state} style={{ background: ROLE_META[x.r].fg }} title={`${x.u.name} · ${ROLE_META[x.r].label}${x.state === "now" ? " · has it now" : ""}`}>{initials(x.u.name)}</i>
      ))}
    </span>
  );
  /* Time progress: dots fill from the start-work day to go-live. */
  const timeDots = (p: Post) => {
    const pct = progressPct(p), n = 12, on = Math.round((pct / 100) * n);
    const left = p.postDate ? daysFrom(todayIso(), p.postDate) : null;
    const label = isOverdue(p) ? `Overdue ${-(left || 0)}d` : left === 0 ? "Goes live today" : left != null ? `${left} day${left === 1 ? "" : "s"} left` : "No date";
    return (
      <span className="fvc-prog">
        <span className="fvc-prog-h"><span>Progress</span><b className={isOverdue(p) ? "late" : ""}>{pct}% · {label}</b></span>
        <span className="fvc-dots" aria-label={`${pct}% of the time to go-live used`}>{Array.from({ length: n }, (_, i) => <i key={i} className={i < on ? "on" : ""} />)}</span>
      </span>
    );
  };

  /* Render helpers are plain functions (not components) so a re-render mid-drag never remounts the board. */
  function renderCard(p: Post) {
    const js = jobsFor(p.id);
    const media = p.media || [];
    const first = media[0];
    const flag = p.dataStatus && !/^(planning|ok|done|ready|we have)$/i.test(p.dataStatus.trim()) ? p.dataStatus : "";
    return (
      <button type="button" key={p.id} className={"fvc-card " + tintOf(p.status) + (canEdit(p) ? "" : " ro")} draggable={canEdit(p)}
        onDragStart={(e) => { dragId.current = p.id; e.currentTarget.classList.add("dragging"); }}
        onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
        onClick={() => setViewId(p.id)} aria-label={`${p.theme}, ${p.client}, ${dueInfo(p)?.text || ""}`}>
        <span className="fvc-tags"><span>#{p.client.replace(/\s+/g, "")}</span>{p.format && <span>#{p.format.replace(/\s+/g, "")}</span>}</span>
        <span className="fvc-title">{p.theme || "Untitled post"}</span>
        {flag ? <span className="fvc-flag">⚠ {flag}</span> : (p.festive || p.topic) ? <span className="fvc-note">{p.festive || p.topic}</span> : null}
        {(p.status === "production" || p.status === "approval") && first && (
          <span className="fvc-shot">
            {isVideoMedia(first) ? <video src={first.url} muted playsInline preload="metadata" /> : <img src={first.thumbUrl || first.url} alt="" loading="lazy" />}
            <em>{isVideoMedia(first) ? "▶ video" : media.length > 1 ? `${media.length} files` : "finished work"}</em>
          </span>
        )}
        {p.status === "ready" && (
          <span className="fvc-check">
            <span>🕑 Goes live {fmtShort(p.postDate)} · {p.postTime ? fmtTime(p.postTime) : "10:00 AM"}</span>
            {js.map((j) => <span key={j.id}>{PLATFORM_NAME[j.platform]} · {(JOB_LABEL[j.status]?.[0] || j.status).toLowerCase()}</span>)}
          </span>
        )}
        {p.status === "posted" && (
          <span className="fvc-check">
            {js.filter((j) => j.status === "published").map((j) => <span key={j.id}>✓ {PLATFORM_NAME[j.platform]} · published</span>)}
            {!js.some((j) => j.status === "published") && <span>✓ Posted {fmtShort(p.postDate)}</span>}
          </span>
        )}
        {!isDone(p) && p.postDate && timeDots(p)}
        <span className="fvc-foot">
          {avatars(p)}
          <span className="fvc-meta">
            {media.length > 0 && <span title="Finished work files">📎 {media.length}</span>}
            {p.postDate && <span>📅 {p.postDate === todayIso() ? "Today" : fmtShort(p.postDate)}</span>}
          </span>
        </span>
      </button>
    );
  }

  function renderBoard() {
    return (
      <div className="cal-board-scroll">
        <div className="cal-board">
          {STAGES.map((s) => {
            const items = list.filter((p) => p.status === s.id);
            const shown = colShown[s.id] ?? COL_PAGE;
            const more = Math.min(items.length - shown, Math.max(COL_PAGE, shown));
            return (
              <section key={s.id} aria-label={s.title} className={"cal-col" + (overStage === s.id ? " over" : "")}
                onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
                onDragLeave={() => setOverStage((o) => (o === s.id ? null : o))}
                onDrop={() => { setOverStage(null); if (dragId.current != null) moveTo(dragId.current, s.id); dragId.current = null; }}>
                <div className="cal-col-head">
                  <span className="cal-col-title"><h2>{s.title}</h2><b className={"fvc-n " + tintOf(s.id)}>{items.length}</b><small>{s.owner}</small></span>
                </div>
                {items.slice(0, shown).map(renderCard)}
                {more > 0 && (
                  <button type="button" className="cal-btn sm" onClick={() => setColShown((c) => ({ ...c, [s.id]: shown + more }))}>
                    Show {more} more
                  </button>
                )}
                {!items.length && <div className="cal-col-empty">Nothing here</div>}
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  function scheduleGroups(source: Post[]) {
    const t = todayIso(), wk = addDays(t, 7);
    const open = source.filter((p) => !isDone(p));
    return ([
      ["Overdue", "Go-live date has passed — post or reschedule", "over", open.filter(isOverdue)],
      ["Work on now", "Inside the 7 days before going live", "now", open.filter((p) => !isOverdue(p) && startOn(p) && startOn(p) <= t)],
      ["Starting this week", "Start-work date in the next 7 days", "", open.filter((p) => startOn(p) > t && startOn(p) <= wk)],
      ["Later", "Start-work date after next week", "later", open.filter((p) => startOn(p) > wk)],
      ["No date", "Add a go-live date", "later", open.filter((p) => !startOn(p))],
    ] as [string, string, string, Post[]][]).filter((g) => g[3].length);
  }

  /* Week calendar: posts placed at their go-live time, tinted by stage. */
  function renderCalendar() {
    const t = todayIso();
    const base = calDay || t;
    const d0 = new Date(base + "T00:00:00"); d0.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); return iso(d); });
    const hourOf = (p: Post) => { const m = /^(\d{1,2}):(\d{2})/.exec(p.postTime || ""); return m ? +m[1] + +m[2] / 60 : 10; };
    const inWeek = list.filter((p) => p.postDate && days.includes(p.postDate));
    const hrs = inWeek.map(hourOf);
    const PX = 96, DUR = 1.7; // px per hour, card length in hours
    const H0 = Math.min(9, Math.floor(hrs.length ? Math.min(...hrs) : 9));
    let H1 = Math.max(20, Math.ceil((hrs.length ? Math.max(...hrs) : 18) + DUR));
    const shift = (n: number) => { const d = new Date(d0); d.setDate(d0.getDate() + n * 7); setMonth(""); setCalDay(iso(d)); };
    const now = new Date(), nowH = now.getHours() + now.getMinutes() / 60;
    // Posts that overlap on a day are stacked as compact rows (full width), a lone post gets a big card.
    const MINI = 74; // px per compact row
    const layoutFor = (ps: Post[]) => {
      const sorted = [...ps].sort((x, y) => hourOf(x) - hourOf(y));
      const groups: { start: number; items: Post[] }[] = [];
      for (const p of sorted) {
        const g = groups[groups.length - 1];
        const end = g ? g.start + Math.max(DUR, (g.items.length * MINI) / PX) : -1;
        if (g && hourOf(p) < end) g.items.push(p); else groups.push({ start: hourOf(p), items: [p] });
      }
      const pos = new Map<number, { top: number; height: number; mini: boolean }>();
      for (const g of groups) {
        if (g.items.length === 1) pos.set(g.items[0].id, { top: (g.start - H0) * PX + 4, height: DUR * PX - 8, mini: false });
        else g.items.forEach((p, i) => pos.set(p.id, { top: (g.start - H0) * PX + 4 + i * MINI, height: MINI - 6, mini: true }));
      }
      const bottom = Math.max(0, ...[...pos.values()].map((x) => x.top + x.height));
      return { pos, bottom };
    };
    // Make the day tall enough for stacked rows.
    const tallest = Math.max(0, ...days.map((ds) => layoutFor(inWeek.filter((p) => p.postDate === ds)).bottom));
    H1 = Math.max(H1, H0 + Math.ceil((tallest + 16) / PX));
    return (
      <div className="fvw">
        <div className="fvw-bar">
          <button type="button" className="cal-icon" onClick={() => shift(-1)} aria-label="Previous week">‹</button>
          <b>{fmtShort(days[0])} – {fmtShort(days[6])}</b>
          <button type="button" className="cal-icon" onClick={() => shift(1)} aria-label="Next week">›</button>
          <button type="button" className="cal-btn" onClick={() => { setMonth(""); setCalDay(t); }}>This week</button>
          <span className="fvw-legend">{STAGES.map((st) => <span key={st.id}><i className={tintOf(st.id)} />{st.title}</span>)}</span>
        </div>
        <div className="fvw-scroll">
          <div className="fvw-grid">
            <div className="fvw-head"><span />{days.map((ds) => {
              const d = new Date(ds + "T00:00:00");
              return <span key={ds} className={ds === t ? "today" : ""}>{String(d.getDate()).padStart(2, "0")} {DOW[(d.getDay() + 6) % 7].toUpperCase()}</span>;
            })}</div>
            <div className="fvw-body" style={{ height: (H1 - H0) * PX }}>
              <div className="fvw-hours">{Array.from({ length: H1 - H0 }, (_, i) => H0 + i).map((h) => <span key={h} style={{ top: (h - H0) * PX }}>{h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>)}</div>
              <div className="fvw-days" style={{ backgroundSize: `100% ${PX}px` }}>
                {days.map((ds) => {
                  const ps = inWeek.filter((p) => p.postDate === ds);
                  const { pos } = layoutFor(ps);
                  return (
                    <div key={ds} className={"fvw-day" + (ds === t ? " today" : "")}>
                      {ps.map((p) => {
                        const at = pos.get(p.id)!;
                        const js = jobsFor(p.id);
                        const plats = js.length ? [...new Set(js.map((j) => j.platform as string))] : platformsFor(p);
                        return (
                          <button type="button" key={p.id} className={"fvw-ev " + tintOf(p.status) + (at.mini ? " mini" : "")} onClick={() => setViewId(p.id)}
                            style={{ top: at.top, height: at.height }}
                            aria-label={`${p.theme}, ${p.client}, ${fmtTime(p.postTime) || "10:00 AM"}`}>
                            {ds === t && <span className="fvw-today">Today</span>}
                            <b>{p.theme || "Untitled post"}</b>
                            <small>{fmtTime(p.postTime) || "10:00 AM"} · {p.client}{p.format ? ` · ${p.format}` : ""}</small>
                            <span className="fvw-st">{STAGES.find((x) => x.id === p.status)?.title}</span>
                            <span className="fvw-foot">{avatars(p)}<span className="fvw-plat">{plats.map((pl) => <em key={pl} className={pl}>{pl === "instagram" ? "IG" : "f"}</em>)}</span></span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              {days.includes(t) && nowH >= H0 && nowH <= H1 && <div className="fvw-now" style={{ top: (nowH - H0) * PX }} />}
            </div>
          </div>
        </div>
        {!inWeek.length && <div className="cal-empty sm">Nothing goes live this week{client ? ` for ${client}` : ""}. Use the arrows to see other weeks.</div>}
      </div>
    );
  }

  /* Team member's home: their own posts, by what to do now. */
  function renderMine() {
    const groups = scheduleGroups(list.filter((p) => p.assigneeId === meId));
    if (!groups.length) return <div className="cal-empty">{!clientNames.length
      ? "No brands assigned to you yet. Ask an admin to give you access under Users → Social media brands."
      : "You're clear for now. Posts appear here when they reach your stage."}</div>;
    return (
      <div className="cal-sched">
        {groups.map(([name, hint, cls, items]) => (
          <section key={name} aria-label={name}>
            <div className="cal-group-head"><h2 className={cls}>{name}</h2><b>{items.length}</b><span>{hint}</span></div>
            <div className="cal-mine">
              {items.map((p) => {
                return (
                  <article key={p.id} className="cal-task">
                    <div className="cal-task-main">
                      <span className="cal-card-top">{fmtChip(p.format)}<span className="cal-brand">{p.client}</span>{badge(p)}</span>
                      <button type="button" className="cal-link big" onClick={() => setViewId(p.id)}>{p.theme}</button>
                      <span className="cal-muted">{stageChip(p.status)} Goes live {fmtDay(p.postDate)}{p.postTime ? ` · ${fmtTime(p.postTime)}` : ""}</span>
                      {p.postDate && progress(p)}
                    </div>
                    <div className="cal-task-actions">
                      {doneLabel(p) && <button type="button" className="cal-primary" onClick={() => advance(p)}>{doneLabel(p)}</button>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  /* Read-only details card — what someone sees when they open a post. */
  function renderDetails(p: Post) {
    const urls = (t?: string) => (t || "").match(/https?:\/\/[^\s]+/g) || [];
    const linkChips = (t?: string) => urls(t).map((u) => (
      <a key={u} className="cal-linkchip" href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0]} ↗</a>
    ));
    const section = (label: string, body?: React.ReactNode) => (body ? <div className="cal-vsec"><h4>{label}</h4>{body}</div> : null);
    const text = (v?: string | null) => (v && v.trim() ? <p className="cal-pre">{v.trim()}</p> : null);
    const copyCaption = async () => {
      try { await navigator.clipboard.writeText(p.caption || ""); toast("Caption copied", "ok", { description: "Paste it into Instagram or Facebook." }); }
      catch { toast("Couldn't copy the caption", "err", { description: "Select the caption text and copy it by hand." }); }
    };
    // Hand-off track: the roles this format passes through, and where it is now.
    const chain: Role[] = CHAIN;
    const cur = chain.indexOf(roleFor(p.status, p.format, p.step));
    const assignee = userById(p.assigneeId);
    const nextLabel = doneLabel(p);
    return (
      <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewId(null); }}>
        <div className="adm-drawer kb-drawer cal-view" role="dialog" aria-modal="true" aria-label={p.theme}>
          <div className="cal-vtop">
            <span className="cal-chip" style={css({ "--bg": "#eef2fa", "--fg": "#2f55a4" })}>{p.client}</span>
            {stageChip(p.status)}{fmtChip(p.format)}
            <button type="button" className="cal-x" onClick={() => setViewId(null)} aria-label="Close">×</button>
          </div>
          <h2>{p.theme}</h2>
          {p.festive && <span className="cal-fest">{p.festive}</span>}
          {p.topic && <p className="cal-lead">{p.topic}</p>}

          <div className="cal-track">
            <span className="cal-eyebrow">Who has it</span>
            {chain.map((r, i) => {
              const state = isDone(p) || i < cur ? "done" : i === cur ? "now" : "next";
              const pickedName = users.find((u) => u.id === p.team?.[r])?.name;
              const names = state === "now" ? (assignee ? [assignee.name] : []) : pickedName ? [pickedName] : [];
              const meta = ROLE_META[r];
              return (
                <div key={r} className={"cal-step " + state}>
                  <i style={state === "now" ? css({ "--fg": meta.fg }) : undefined}>{state === "done" ? "✓" : i + 1}</i>
                  <span>
                    <b className={!names.length && state === "now" ? "missing" : ""}>{names.length ? names.join(", ") : state === "now" ? "Nobody yet — pick someone" : meta.label}</b>
                    <small>{meta.label} · {state === "now" ? "has it now" : state === "done" ? "done" : meta.does}</small>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="cal-vgrid">
            <div><span>Start work on</span><b>{p.postDate ? fmtDay(startOf(p)) : "—"}</b></div>
            <div><span>Goes live</span><b>{fmtDay(p.postDate)}{p.postTime && ` · ${fmtTime(p.postTime)}`}</b></div>
            <div><span>Timeline</span>{badge(p) || <b>—</b>}</div>
            {p.poc && <div><span>Client contact</span><b>{p.poc}</b></div>}
            {p.dataStatus && <div><span>Data status</span><b>{p.dataStatus}</b></div>}
          </div>

          <div className="cal-vsec cal-work">
            <h4>Finished work</h4>
            <div className="cal-media">
              {(p.media || []).map((m, i) => (
                <a key={m.url + i} className="cal-media-item" href={m.url} target="_blank" rel="noopener noreferrer" title={m.name || "Open"}>
                  {isVideoMedia(m) ? <video src={m.url} muted playsInline preload="metadata" /> : <img src={m.thumbUrl || m.url} alt={m.name || `File ${i + 1}`} />}
                  {canEdit(p) && p.status !== "posted" && <button type="button" aria-label="Remove" onClick={(e) => { e.preventDefault(); removeWork(p, i); }}>×</button>}
                </a>
              ))}
              {canEdit(p) && p.status !== "posted" && (p.media || []).length < 10 && (
                <label className={"cal-media-add" + (workBusy === p.id ? " busy" : "")}>
                  <input type="file" multiple accept="image/*,video/mp4,video/quicktime" disabled={workBusy === p.id}
                    onChange={(e) => { uploadWork(p, e.target.files); e.target.value = ""; }} />
                  {workBusy === p.id ? "Uploading…" : "+ Upload"}
                </label>
              )}
            </div>
            <span className="adm-hint">{p.status === "posted"
              ? "Live now — the uploaded files were removed from our server to save space."
              : "Upload the final design or video here. It's what gets posted, and it's deleted from our server once the post is live."}</span>
          </div>

          {renderPublishing(p)}

          {section("Caption & hashtags", p.caption && <>
            {text(p.caption)}
            <button type="button" className="cal-btn sm" onClick={copyCaption}>Copy caption</button>
          </>)}
          {(urls(p.driveLink).length > 0 || urls(p.reference).length > 0 || urls(p.channels).length > 0) && section("Links", <div className="cal-links">
            {linkChips(p.driveLink)}{linkChips(p.reference)}{linkChips(p.channels)}
          </div>)}
          {section("Client requirements", text(p.requirements))}
          {section("People to tag", text(p.tags))}
          {section("Keywords", text(p.keywords))}
          {section("Remarks", text(p.remarks))}
          <HistoryList entity="social-post" id={p.id} refreshKey={`${p.status}|${p.assigneeId ?? ""}`} />


          {canEdit(p) ? (
            <div className="adm-drawer-actions cal-actions">
              {p.status === "approval" && !canApprove(p) && <div className="cal-readonly">Waiting for the Social media manager to approve. Once approved it's scheduled for {fmtDay(p.postDate)}{p.postTime ? ` · ${fmtTime(p.postTime)}` : ""}.</div>}
              {nextLabel && <button type="button" className="cal-primary wide" onClick={() => advance(p)}>{nextLabel}</button>}
              {p.status === "approval" && canApprove(p) && <button type="button" className="cal-btn lg" onClick={() => sendBack(p)}>Send back for changes</button>}
              <div className="cal-row">
                <button type="button" className="cal-btn lg grow" onClick={() => { dirty.current = new Set(); setEditing({ ...p }); setViewId(null); }}>Edit post</button>
              </div>
            </div>
          ) : (
            <div className="cal-readonly">
              View only — this post is with <b>{assignee?.name || "nobody yet"}</b>. Only they or an admin can change it.
            </div>
          )}
        </div>
      </div>
    );
  }

  /* Auto-publishing on the details card: per platform status and actions. */
  function renderPublishing(p: Post) {
    const js = jobsFor(p.id);
    const acc = accFor(p.client);
    const media = p.media || [];
    if (!js.length && !acc) {
      if (p.status !== "ready" && p.status !== "production") return null;
      return (
        <div className="cal-vsec"><h4>Auto-publishing</h4>
          <p className="adm-hint" style={{ margin: 0 }}>{p.client} isn't connected to Instagram / Facebook yet{limited ? " — ask an admin to connect it." : <> — connect it in <a className="cal-link" href="/dashboard/social-studio?tab=channels">Social studio</a> and Ready posts publish themselves.</>}</p>
        </div>
      );
    }
    const when = p.postDate ? `${fmtDay(p.postDate)} · ${p.postTime ? fmtTime(p.postTime) : "10:00 AM"}` : "its go-live date";
    const allOut = js.length > 0 && js.every((j) => j.status === "published");
    return (
      <div className="cal-vsec cal-pub">
        <h4>Auto-publishing</h4>
        {!js.length && <p className="adm-hint" style={{ margin: 0 }}>
          {p.status === "posted" ? "Already posted." : `Goes out on ${platformsFor(p).map((x) => PLATFORM_NAME[x]).join(" and ") || "—"} by itself at ${when} once it's in Ready to post.`}
          {!media.length && p.status !== "posted" && platformsFor(p).includes("instagram") && " Add the image or video in Edit post — Instagram needs it."}
        </p>}
        {js.map((j) => {
          const [label, bg, fg] = JOB_LABEL[j.status] || [j.status, "#eef1f6", "#475069"];
          return (
            <div key={j.id} className="cal-pubrow">
              <div className="cal-pubrow-main">
                <b>{PLATFORM_NAME[j.platform]}</b>
                <span className="cal-chip" style={css({ "--bg": bg, "--fg": fg })}>{label}</span>
                <span className="cal-muted">{j.account}{j.status === "scheduled" && j.runAt ? ` · ${new Date(j.runAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : ""}
                  {j.status === "published" && j.publishedAt ? ` · ${new Date(j.publishedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : ""}</span>
              </div>
              {j.error && j.status !== "published" && <p className={"cal-puberr" + (j.status === "scheduled" ? " soft" : "")}>{j.status === "scheduled" ? `Will try again: ${j.error}` : j.error}</p>}
              <div className="cal-row">
                {j.url && <a className="cal-btn sm" href={j.url} target="_blank" rel="noopener noreferrer">View post ↗</a>}
                {["failed", "check", "missed"].includes(j.status) && <button type="button" className="cal-btn sm" onClick={() => retryJob(j)}>{j.status === "missed" ? "Post now" : "Retry"}</button>}
                {["failed", "check", "missed"].includes(j.status) && <button type="button" className="cal-btn sm" onClick={() => markJobPosted(j)}>I posted it myself</button>}
              </div>
            </div>
          );
        })}
        {!allOut && p.status !== "posted" && acc && canEdit(p) && platformsFor(p).length > 0 && !js.some((j) => j.status === "publishing") && (
          <button type="button" className="cal-btn sm" onClick={() => publishNow(p)}>Publish now</button>
        )}
      </div>
    );
  }


  /* Admin: Team & uploads — who covers each brand, and the sheet uploads. */
  /* The "who covers" editor, shown right under the brand row that was clicked. */
  function renderCoverEdit() {
    if (!coverEdit) return null;
              const brandId = String(clientRows.find((c) => c.name === coverEdit.brand)?.id ?? "");
              const active = team.filter((u) => u.active !== false && !(u.roles || []).includes("admin"));
              const withRole = active.filter((u) => (u.roles || []).includes(coverEdit.role));
              const others = active.filter((u) => !(u.roles || []).includes(coverEdit.role));
              const row = (u: TeamUser, addsRole: boolean) => {
                const checked = !addsRole && (u.socialClients || []).map(String).includes(brandId);
                return (
                  <div key={u.id} className={"cal-cover-opt" + (checked ? " on" : "")}>
                    <label>
                      <input type="checkbox" checked={checked} disabled={coverBusy === u.id} onChange={() => toggleCover(u, coverEdit.brand, coverEdit.role)} />
                      <span><b>{u.name}</b><small>{(u.roles || []).map((r) => ROLE_META[r as Role]?.label || r).join(", ") || "No role yet"}{addsRole ? ` · gets the ${ROLE_META[coverEdit.role].label} role` : ""}</small></span>
                    </label>
                    {!addsRole && (
                      <button type="button" className="cal-cover-remove" disabled={coverBusy === u.id} onClick={() => removeRole(u, coverEdit.role)}
                        aria-label={`Remove the ${ROLE_META[coverEdit.role].label} role from ${u.name}`}>Remove role</button>
                    )}
                  </div>
                );
              };
              return (
                <div className="cal-cover-edit" ref={(el) => { if (el && coverScrolled.current !== `${coverEdit.brand}|${coverEdit.role}`) { coverScrolled.current = `${coverEdit.brand}|${coverEdit.role}`; el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } }} role="group" aria-label={`Who covers ${coverEdit.brand} as ${ROLE_META[coverEdit.role].label}`}>
                  <div className="cal-cover-edit-head">
                    <b>{coverEdit.brand} · <span style={{ color: ROLE_META[coverEdit.role].fg }}>{ROLE_META[coverEdit.role].label}</span></b>
                    <button type="button" className="cal-link" onClick={() => setCoverEdit(null)}>Done</button>
                  </div>
                  <p className="adm-hint" style={{ margin: 0 }}>Tick who covers this brand. Posts at this stage go to the least busy ticked person.</p>
                  {withRole.length ? withRole.map((u) => row(u, false)) : <p className="adm-hint" style={{ margin: 0 }}>Nobody has the {ROLE_META[coverEdit.role].label} role yet. Pick someone below to give it to them.</p>}
                  {others.length > 0 && <>
                    <span className="cal-cover-sub">Give the role to someone else</span>
                    {others.map((u) => row(u, true))}
                  </>}
                </div>
              );
  }

  function renderTeamPanel(ups: Upload[]) {
    const roles: Role[] = ["marketer", "video", "graphic", "social"];
    return (
      <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setUploads(null); }}>
        <div className="adm-drawer kb-drawer cal-view cal-wide" role="dialog" aria-modal="true" aria-label="Upload history">
          <div className="cal-vtop"><h2 style={{ margin: 0 }}>Upload history</h2>
            <button type="button" className="cal-x" onClick={() => setUploads(null)} aria-label="Close">×</button></div>
          <p className="cal-lead">Every sheet you've uploaded, newest first. Delete an upload to remove all of its posts.</p>

          <div className="cal-vsec">
            <h4>Sheet uploads</h4>
            <p className="adm-hint" style={{ marginTop: 0 }}>Every row lands in Planned. Uploading the same sheet again updates its posts instead of duplicating them.</p>
            {ups.length === 0 ? (
              <div className="cal-empty sm">No uploads recorded yet. Sheets uploaded from now on appear here.</div>
            ) : (
              <div className="sm-uploads">
                {ups.map((u) => (
                  <div key={u.importBatch + u.client} className="sm-upload">
                    <div>
                      <b>{u.client}</b>
                      <span className="cal-muted">{new Date(u.uploadedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        {" · "}{u.posts} post{u.posts === 1 ? "" : "s"}{u.from && ` · ${fmtShort(String(u.from).slice(0, 10))} – ${fmtShort(String(u.to).slice(0, 10))}`}</span>
                    </div>
                    <button type="button" className="cal-btn danger" onClick={() => deleteUpload(u)}>Delete upload</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cal-vsec">
            <h4>Delete all posts of a brand</h4>
            <p className="adm-hint" style={{ marginTop: 0 }}>For sheets uploaded before uploads were recorded, or to start a brand from scratch. You'll be asked to type the brand name.</p>
            <div className="cal-links">
              {clientNames.filter((n) => posts.some((p) => p.client === n)).length === 0 && <span className="adm-hint">No brand has posts right now.</span>}
              {clientNames.filter((n) => posts.some((p) => p.client === n)).map((n) => (
                <button key={n} type="button" className="cal-btn danger" onClick={() => deleteBrand(n)}>Delete {posts.filter((p) => p.client === n).length} posts · {n}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return (
    <>
      <div className="adm-top"><div><h1>Content calendar</h1><p>Loading posts…</p></div></div>
      <BoardSkeleton cols={5} />
    </>
  );

  const t = todayIso(), wk = addDays(t, 7);
  const openList = list.filter((p) => !isDone(p));
  const tiles: [string, string | number, string, string][] = [
    ["Overdue", openList.filter(isOverdue).length, "Go-live date passed", "over"],
    ["Work on now", openList.filter((p) => !isOverdue(p) && startOn(p) && startOn(p) <= t).length, "Inside their 7-day window", "now"],
    ["Starting this week", openList.filter((p) => startOn(p) > t && startOn(p) <= wk).length, "Start date in the next 7 days", ""],
    limited ? ["Assigned to you", list.filter((p) => p.assigneeId === meId && !isDone(p)).length, "Open posts in My work", "now"] : ["Ready to post", list.filter((p) => p.status === "ready").length, "With Social media", "ready"],
    ["Posted", list.filter(isDone).length, "Live with links", "ok"],
  ];
  const viewed = viewId != null ? posts.find((p) => p.id === viewId) : undefined;
  const set = (patch: Partial<Post>) => { Object.keys(patch).forEach((k) => dirty.current.add(k as keyof Post)); setEditing((e) => ({ ...e, ...patch })); };
  const txt = (k: keyof Post) => String(editing?.[k] ?? "");
  const views: [View, string][] = limited ? [["mine", "My work"], ["board", "Board"], ["calendar", "Calendar"]] : [["board", "Board"], ["calendar", "Calendar"]];
  const activeView: View = (!limited && view === "mine") || view === "schedule" ? "board" : view;

  // Editor: who the post goes to at its stage, and whether the start date is automatic.
  const edRole = editing ? roleFor((editing.status || "planned") as Stage, editing.format, editing.step) : "graphic";
  const edAssignee = editing ? userById(editing.assigneeId) : undefined;
  const edAutoStart = editing ? !editing.dueDate || String(editing.dueDate).slice(0, 10) === weekBefore(editing.postDate) : true;
  const edCands = editing && !limited && editing.client ? candidates(edRole, editing.client) : [];

  return (
    <div className="cal-page">
      <div className="cal-head">
        <div>
          <span className="cal-eyebrow">Social media</span>
          <h1>{limited ? "My work" : "Content calendar"}</h1>
          <p>{limited
            ? "My work lists your posts. Board, Schedule and Calendar show everything for your brands, and you can edit any of them."
            : "Every brand's posts from plan to live link, with who has each one and when work starts."}</p>
        </div>
        <div className="cal-head-actions">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => { importCsv(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          <button type="button" className="cal-primary" onClick={() => fileRef.current?.click()}>Import sheet</button>
          {!limited && <button type="button" className="cal-btn" onClick={openUploads}>Upload history</button>}
          <ExportButton entity="social-posts" file={client ? `content-calendar-${client.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}` : "content-calendar"} sheet={client || "Content calendar"}
            params={() => ({
              client, q: query.trim(), assigneeId: /^\d+$/.test(who) ? who : "",
              from: month ? `${month}-01` : "", to: month ? iso(new Date(+month.slice(0, 4), +month.slice(5, 7), 0)) : "",
            })} />

        </div>
      </div>

      <div className="cal-tabs" role="tablist" aria-label="Brands">
        {[{ name: "", label: "All brands" }, ...clientNames.map((n) => ({ name: n, label: n }))].map(({ name, label }) => {
          const items = posts.filter((p) => !name || p.client === name);
          const late = items.filter(isOverdue).length;
          return (
            <button type="button" key={name || "all"} role="tab" aria-selected={client === name} className={"cal-tab" + (client === name ? " on" : "")}
              onClick={() => { setClient(name); setMonth(""); setCalMonth(""); }}>
              {name && <i style={{ background: clientColor(name) }} />}
              {label}<span className="n">{items.length}</span>{late > 0 && <span className="late">{late} late</span>}
            </button>
          );
        })}
      </div>


      <div className="cal-tiles">
        {tiles.map(([k, v, hint, cls]) => <div key={k} className={"cal-tile " + cls}><span>{k}</span><b>{v}</b><small>{hint}</small></div>)}
      </div>

      <div className="cal-toolbar">
        <div className="cal-seg" role="group" aria-label="View">
          {views.map(([v, label]) => (
            <button type="button" key={v} aria-pressed={activeView === v} className={activeView === v ? "on" : ""} onClick={() => { setView(v); if (v === "mine") setWho(""); }}>{label}</button>
          ))}
        </div>
        <div className="sm-filter"><Select value={month} onChange={(v) => { setMonth(v); setCalMonth(""); }} ariaLabel="Month"
          options={[{ value: "", label: "All months" }, ...months.map((m) => ({ value: m, label: `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}` }))]} /></div>
        <div className="sm-filter"><Select value={format} onChange={setFormat} ariaLabel="Format"
          options={[{ value: "", label: "All formats" }, ...formats.map((f) => ({ value: f, label: f }))]} /></div>
        {activeView !== "mine" && <div className="sm-filter"><Select value={who} onChange={setWho} ariaLabel="Assigned to"
          options={[{ value: "", label: "Everyone" }, { value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} /></div>}
        <label className="cal-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input placeholder="Search theme, topic, caption…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search posts" />
        </label>
        <span className="cal-today">Today · {fmtDay(t)}</span>
      </div>

      {!posts.length && activeView !== "mine" ? (
        <div className="cal-empty">{limited && !clientNames.length
          ? "No brands assigned to you yet. Ask an admin to give you access under Users → Social media brands."
          : limited ? "Nothing is assigned to you right now. Posts appear here when they reach your stage."
          : "No posts yet. Import a brand's media calendar sheet (Excel or CSV). A new brand is added automatically from the upload."}</div>
      ) : activeView === "mine" ? renderMine() : activeView === "calendar" ? renderCalendar() : renderBoard()}

      {viewed && !editing && renderDetails(viewed)}
      {uploads && renderTeamPanel(uploads)}
      {handoff && (() => {
        const h = handoff, list = peopleFor(h.role), meta = ROLE_META[h.role];
        const title = h.kind === "approve" ? "Approve & schedule" : h.kind === "back" ? "Send back for changes" : h.kind === "move" ? `Move to ${STAGES.find((x) => x.id === h.patch.status)?.title}` : `Done — who's next?`;
        const btn = h.kind === "approve" ? "Approve & schedule" : h.kind === "back" ? "Send back" : h.chosen ? `Send to ${list.find((u) => u.id === h.chosen)?.name.split(" ")[0] || "them"}` : "Move without a person";
        return (
          <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setHandoff(null); }}>
            <div className="cal-pick" role="dialog" aria-modal="true" aria-label={title}>
              <div className="cal-pick-h"><div><h3>{title}</h3><small>“{h.post.theme}” · {h.post.client}</small></div>
                <button type="button" className="cal-x" onClick={() => setHandoff(null)} aria-label="Close">×</button></div>
              <span className="cal-pick-l">Pick the <b style={{ color: meta.fg }}>{meta.label}</b>{h.kind === "approve" ? " who posts it" : ""}</span>
              <div className="cal-pick-list" role="radiogroup">
                {list.map((u) => (
                  <label key={u.id} className={h.chosen === u.id ? "on" : ""}>
                    <input type="radio" name="handoff" checked={h.chosen === u.id} onChange={() => setHandoff({ ...h, chosen: u.id })} />
                    <i style={{ background: meta.fg }}>{initials(u.name)}</i>
                    <span><b>{u.name}</b><small>{h.post.team?.[h.role] === u.id ? "Picked for this post" : (u.roles || []).map((r) => ROLE_META[r as Role]?.label || r).join(", ")}</small></span>
                  </label>
                ))}
                {!list.length && <p className="adm-hint">Nobody has the {meta.label} role yet. Give someone the role on the Users page.</p>}
              </div>
              {h.kind === "back" && <label className="adm-field" style={{ margin: 0 }}><span>What needs changing</span>
                <textarea rows={3} value={h.note} onChange={(e) => setHandoff({ ...h, note: e.target.value })} placeholder="e.g. Use the new price card, shorten the intro" /></label>}
              {h.kind === "approve" && !h.late && <p className="adm-hint" style={{ margin: 0 }}>It goes to Ready to post and is scheduled for {fmtDay(h.post.postDate)}{h.post.postTime ? ` · ${fmtTime(h.post.postTime)}` : " · 10:00 AM"} on connected channels.</p>}
              {h.kind === "approve" && h.late && (
                <div className="cal-late">
                  <b>The go-live time has passed</b>
                  <span>It was due {fmtDay(h.post.postDate)}{h.post.postTime ? ` · ${fmtTime(h.post.postTime)}` : ""}. When should it go live?</span>
                  <label className={h.when === "now" ? "on" : ""}><input type="radio" name="late" checked={h.when === "now"} onChange={() => setHandoff({ ...h, when: "now" })} />
                    <span><b>Right after approval</b><small>Posts within a couple of minutes on connected channels.</small></span></label>
                  <label className={h.when === "pick" ? "on" : ""}><input type="radio" name="late" checked={h.when === "pick"} onChange={() => setHandoff({ ...h, when: "pick" })} />
                    <span><b>New date &amp; time</b><small>Scheduled for later; the calendar moves with it.</small></span></label>
                  {h.when === "pick" && (
                    <div className="cal-late-row">
                      <DatePicker value={h.newDate || ""} onChange={(v) => setHandoff({ ...h, newDate: v })} placeholder="New go-live date" />
                      <input type="time" value={h.newTime || "10:00"} onChange={(e) => setHandoff({ ...h, newTime: e.target.value })} aria-label="New go-live time" />
                    </div>
                  )}
                </div>
              )}
              <div className="cal-pick-f">
                <button type="button" className="cal-btn" onClick={() => setHandoff(null)}>Cancel</button>
                <button type="button" className="cal-primary" disabled={h.busy || (!h.chosen && h.kind !== "move")} onClick={confirmHandoff}>{h.busy ? "Saving…" : btn}</button>
              </div>
            </div>
          </div>
        );
      })()}
      {brandPick && (() => {
        const creating = brandPick.value === "__new";
        const name = creating ? brandPick.newName.trim() : brandPick.value;
        const dupe = creating && clientNames.find((n) => n.toLowerCase() === name.toLowerCase());
        const go = () => { if (!name) return; const rows = brandPick.rows; setBrandPick(null); continueImport(rows, dupe || name); };
        return (
          <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setBrandPick(null); }}>
            <div className="cal-pick" role="dialog" aria-modal="true" aria-label="Import posts for which brand?">
              <div className="cal-pick-h"><div><h3>Import posts for which brand?</h3><small>Pick a brand, or create a new one for this sheet.</small></div>
                <button type="button" className="cal-x" onClick={() => setBrandPick(null)} aria-label="Close">×</button></div>
              <div className="adm-field" style={{ margin: 0 }}><label>Brand</label>
                <Select value={brandPick.value} ariaLabel="Brand" onChange={(v) => setBrandPick({ ...brandPick, value: v })}
                  options={[...clientNames.map((n) => ({ value: n, label: n })), ...(!limited ? [{ value: "__new", label: "+ Create a new brand" }] : [])]} />
              </div>
              {creating && (
                <div className="adm-field" style={{ margin: 0 }}><label>New brand name</label>
                  <input autoFocus value={brandPick.newName} placeholder="e.g. Maharani by Rungta's" onChange={(e) => setBrandPick({ ...brandPick, newName: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); go(); } }} />
                  <span className="adm-hint">{dupe ? `${dupe} already exists — the posts go into it.` : "It's added to the brand list with this upload."}</span>
                </div>
              )}
              <div className="cal-pick-f">
                <button type="button" className="cal-btn" onClick={() => setBrandPick(null)}>Cancel</button>
                <button type="button" className="cal-primary" disabled={!name} onClick={go}>Next</button>
              </div>
            </div>
          </div>
        );
      })()}
      {importTeam && (
        <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setImportTeam(null); }}>
          <div className="cal-pick wide" role="dialog" aria-modal="true" aria-label="Who works on these posts">
            <div className="cal-pick-h"><div><h3>Who works on these posts?</h3><small>{importTeam.parsed.length} posts for {importTeam.name}. Posts go to the Graphic designer, reels to the Video editor; when they upload the finished work and click Done it goes to the Social media manager.</small></div>
              <button type="button" className="cal-x" onClick={() => setImportTeam(null)} aria-label="Close">×</button></div>
            <div className="cal-pick-team">
              {CHAIN.map((r, i) => (
                <div key={r} className="cal-pick-row">
                  <span className="n" style={{ background: ROLE_META[r].bg, color: ROLE_META[r].fg }}>{i + 1}</span>
                  <span className="lbl"><b>{ROLE_META[r].label}</b><small>{ROLE_META[r].does}</small></span>
                  <Select value={importTeam.team[r] ? String(importTeam.team[r]) : ""} ariaLabel={ROLE_META[r].label}
                    onChange={(v) => setImportTeam({ ...importTeam, team: { ...importTeam.team, [r]: v ? Number(v) : null } })}
                    options={[{ value: "", label: "Pick later" }, ...peopleFor(r).map((u) => ({ value: String(u.id), label: u.name }))]} />
                </div>
              ))}
            </div>
            <p className="adm-hint" style={{ margin: 0 }}>Graphic designer makes posts and carousels, Video editor makes reels and videos. Each uploads the finished work and clicks Done → the Social media manager approves it and it's scheduled; once it's live it moves to Posted and the files are removed from our server. People picked get access to {importTeam.name}.</p>
            <div className="cal-pick-f">
              <button type="button" className="cal-btn" onClick={() => setImportTeam(null)}>Cancel</button>
              <button type="button" className="cal-primary" disabled={importTeam.busy} onClick={finishImport}>{importTeam.busy ? "Importing…" : `Import ${importTeam.parsed.length} posts`}</button>
            </div>
          </div>
        </div>
      )}
      {metaPick && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setMetaPick(null); }}>
          <div className="adm-drawer kb-drawer cal-view" role="dialog" aria-modal="true" aria-label={`Connect ${metaPick.brand}`}>
            <div className="cal-vtop"><h2 style={{ margin: 0 }}>Connect {metaPick.brand}</h2>
              <button type="button" className="cal-x" onClick={() => setMetaPick(null)} aria-label="Close">×</button></div>
            <p className="cal-lead">Which Facebook Page is {metaPick.brand}'s? Its linked Instagram account is connected with it.</p>
            <div className="cal-pagepick">
              {metaPick.pages.map((pg) => (
                <label key={pg.pageId} className={"cal-pageopt" + (metaPick.chosen === pg.pageId ? " on" : "")}>
                  <input type="radio" name="metapage" checked={metaPick.chosen === pg.pageId} onChange={() => setMetaPick({ ...metaPick, chosen: pg.pageId })} />
                  <span><b>{pg.pageName}</b><small>{pg.igUsername ? `Instagram @${pg.igUsername}` : "No Instagram business account linked — Facebook only"}</small></span>
                </label>
              ))}
            </div>
            <div className="adm-drawer-actions">
              <button type="button" className="cal-primary" disabled={!metaPick.chosen} onClick={finishConnect}>Connect</button>
              <button type="button" className="cal-btn" onClick={() => setMetaPick(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="adm-drawer kb-drawer cal-view cal-edit" onSubmit={savePost}>
            <div className="cal-vtop">
              <h2 style={{ margin: 0 }}>{editing.id ? "Edit post" : "New post"}</h2>
              <button type="button" className="cal-x" onClick={() => { if (editing.id) setViewId(editing.id); setEditing(null); }} aria-label="Close">×</button>
            </div>

            <fieldset className="cal-fs">
              <legend>The post</legend>
              <div className="field row" style={{ gap: 12 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>Brand</label>
                  {limited ? (
                    <Select value={txt("client")} onChange={(v) => set({ client: v })} ariaLabel="Brand" placeholder="Choose a brand"
                      options={clientNames.map((n) => ({ value: n, label: n }))} />
                  ) : (
                    <>
                      <input list="sm-clients" value={txt("client")} onChange={(e) => set({ client: e.target.value })} required placeholder="Brand name" />
                      <datalist id="sm-clients">{clientNames.map((n) => <option key={n} value={n} />)}</datalist>
                    </>
                  )}</div>
                <div className="adm-field" style={{ flex: 1 }}><label>Format</label>
                  <input list="sm-formats" value={txt("format")} onChange={(e) => set({ format: e.target.value })} placeholder="Post / Reel / Carousel" />
                  <datalist id="sm-formats">{FORMATS.map((f) => <option key={f} value={f} />)}</datalist></div>
              </div>
              <div className="adm-field"><label>Post theme</label>
                <input value={txt("theme")} onChange={(e) => set({ theme: e.target.value })} required placeholder="e.g. Customer Review" /></div>
              <div className="field row" style={{ gap: 12 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>Day / festival</label>
                  <input value={txt("festive")} onChange={(e) => set({ festive: e.target.value })} placeholder="e.g. Diwali" /></div>
                <div className="adm-field" style={{ flex: 1 }}><label>Client contact</label>
                  <input value={txt("poc")} onChange={(e) => set({ poc: e.target.value })} placeholder="Point of contact" /></div>
              </div>
              <div className="adm-field"><label>Post topic</label>
                <textarea value={txt("topic")} onChange={(e) => set({ topic: e.target.value })} /></div>
            </fieldset>

            <fieldset className="cal-fs">
              <legend>When</legend>
              <div className="field row" style={{ gap: 12 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>Goes live on</label>
                  <DatePicker value={txt("postDate").slice(0, 10)} onChange={(v) => setEditing((e) => {
                    // An empty or automatic start date follows the post date; a hand-set one stays.
                    const auto = !e?.dueDate || String(e.dueDate).slice(0, 10) === weekBefore(e?.postDate);
                    return { ...e, postDate: v, ...(auto && v ? { dueDate: weekBefore(v) } : {}) };
                  })} placeholder="Goes live on" /></div>
                <div className="adm-field" style={{ flex: 1 }}><label>At</label>
                  <input type="time" value={txt("postTime")} onChange={(e) => set({ postTime: e.target.value })} /></div>
              </div>
              <div className="field row" style={{ gap: 12 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>Start work on</label>
                  <DatePicker value={txt("dueDate").slice(0, 10)} onChange={(v) => set({ dueDate: v })} placeholder="Start date" /></div>
              </div>
              <div className="cal-note">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                <span>{edAutoStart
                  ? editing.postDate ? `Work starts 7 days before going live (${fmtShort(editing.postDate)} → ${fmtShort(weekBefore(editing.postDate))}). It follows the post date.` : "Pick a go-live date — work starts 7 days before it."
                  : "Start date set by hand — it stays put if the post date moves."}</span>
                {!edAutoStart && editing.postDate && <button type="button" className="cal-btn sm" onClick={() => set({ dueDate: weekBefore(editing.postDate) })}>Use 7 days before</button>}
              </div>
            </fieldset>

            <fieldset className="cal-fs">
              <legend>Stage &amp; who has it</legend>
              <div className="cal-stagepick" role="radiogroup" aria-label="Stage">
                {STAGES.map((s) => (
                  <button type="button" key={s.id} role="radio" aria-checked={(editing.status || "planned") === s.id}
                    className={(editing.status || "planned") === s.id ? "on" : ""} onClick={() => set({ status: s.id })}>{s.title}</button>
                ))}
              </div>
              <div className="cal-goes">
                <span className="cal-muted">At this stage it's for the <b style={{ color: ROLE_META[edRole].fg }}>{ROLE_META[edRole].label}</b>.</span>
              </div>
              <div className="adm-field"><label>Assigned to</label>
                <Select value={editing.assigneeId ? String(editing.assigneeId) : ""} onChange={(v) => set({ assigneeId: v ? Number(v) : null })} ariaLabel="Assigned to"
                  options={[{ value: "", label: "Nobody yet" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
                <span className="adm-hint">Nothing is assigned automatically. When someone clicks Done they pick who's next; the people below are pre-selected.</span></div>
              <div className="cal-teamgrid">
                {CHAIN.map((r) => (
                  <div key={r} className="adm-field"><label style={{ color: ROLE_META[r].fg }}>{ROLE_META[r].label}</label>
                    <Select value={editing.team?.[r] ? String(editing.team[r]) : ""} ariaLabel={ROLE_META[r].label}
                      onChange={(v) => set({ team: { ...(editing.team || {}), [r]: v ? Number(v) : null } })}
                      options={[{ value: "", label: "Not picked" }, ...users.filter((u) => (u.roles || []).includes(r)).map((u) => ({ value: String(u.id), label: u.name }))]} /></div>
                ))}
              </div>
            </fieldset>

            <fieldset className="cal-fs">
              <legend>Content &amp; links</legend>
              <div className="adm-field"><label>Caption &amp; hashtags</label>
                <textarea rows={6} value={txt("caption")} onChange={(e) => set({ caption: e.target.value })} /></div>
              <div className="field row" style={{ gap: 12 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>Creative (Drive link)</label>
                  <input value={txt("driveLink")} onChange={(e) => set({ driveLink: e.target.value })} placeholder="https://drive.google.com/…" /></div>
                <div className="adm-field" style={{ flex: 1 }}><label>Reference link</label>
                  <input value={txt("reference")} onChange={(e) => set({ reference: e.target.value })} placeholder="https://" /></div>
              </div>
              <div className="adm-field"><label>Live post links</label>
                <textarea value={txt("channels")} onChange={(e) => set({ channels: e.target.value })} placeholder={"Instagram https://…\nFacebook https://…"} />
                <span className="adm-hint">Paste the real post links (https://…) once it's published — saving then moves it to Posted. Channel names alone don't count.</span></div>
              <div className="field row" style={{ gap: 12 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>Client requirements</label>
                  <textarea value={txt("requirements")} onChange={(e) => set({ requirements: e.target.value })} /></div>
                <div className="adm-field" style={{ flex: 1 }}><label>Data status</label>
                  <textarea value={txt("dataStatus")} onChange={(e) => set({ dataStatus: e.target.value })} placeholder="We have / Required from client" /></div>
              </div>
              <div className="field row" style={{ gap: 12 }}>
                <div className="adm-field" style={{ flex: 1 }}><label>People to tag</label>
                  <input value={txt("tags")} onChange={(e) => set({ tags: e.target.value })} /></div>
                <div className="adm-field" style={{ flex: 1 }}><label>Keywords</label>
                  <input value={txt("keywords")} onChange={(e) => set({ keywords: e.target.value })} /></div>
              </div>
              <div className="adm-field"><label>Remarks</label>
                <textarea value={txt("remarks")} onChange={(e) => set({ remarks: e.target.value })} /></div>
            </fieldset>

            {(() => {
              const acc = accFor(editing.client);
              const media = editing.media || [];
              const cap = composeCaption(editing);
              const avail = acc ? [...(acc.igUsername ? ["instagram"] : []), "facebook"] : [];
              const chosen = editing.publishTo == null ? avail : avail.filter((x) => (editing.publishTo || []).includes(x));
              const toggle = (x: string) => {
                const next = chosen.includes(x) ? chosen.filter((y) => y !== x) : [...chosen, x];
                set({ publishTo: next.length === avail.length ? null : next });
              };
              const nonJpg = media.filter((m) => !isVideoMedia(m) && !/\.jpe?g(\?|$)/i.test(m.url));
              const when = editing.postDate ? `${fmtDay(editing.postDate)} at ${editing.postTime ? fmtTime(editing.postTime) : "10:00 AM"}` : "its go-live date";
              return (
                <fieldset className="cal-fs">
                  <legend>Publishing</legend>
                  {acc ? (
                    <p className="cal-pubnote">Publishes automatically on <b>{when}</b> once it's in Ready to post{!editing.postTime && " (set a time above to change it)"}.</p>
                  ) : (
                    <p className="adm-hint" style={{ marginTop: 0 }}>{editing.client || "This brand"} isn't connected to Instagram / Facebook yet, so it won't publish by itself. You can still add the media here.</p>
                  )}
                  {acc && <div className="adm-field"><label>Post to</label>
                    <div className="cal-row">
                      {avail.map((x) => (
                        <label key={x} className="cal-check"><input type="checkbox" checked={chosen.includes(x)} onChange={() => toggle(x)} />
                          {PLATFORM_NAME[x]} <span className="cal-muted">{x === "instagram" ? `@${acc.igUsername}` : acc.pageName}</span></label>
                      ))}
                    </div>
                    {!chosen.length && <span className="adm-hint">Nothing ticked — this post won't publish by itself.</span>}
                  </div>}
                  <div className="adm-field"><label>Image or video to post</label>
                    <div className="cal-media">
                      {media.map((m, i) => (
                        <div key={m.url + i} className="cal-media-item">
                          {isVideoMedia(m) ? <video src={m.url} muted playsInline preload="metadata" /> : <img src={m.thumbUrl || m.url} alt={m.name || `Image ${i + 1}`} />}
                          {media.length > 1 && <span className="cal-media-n">{i + 1}</span>}
                          <button type="button" aria-label="Remove" onClick={() => set({ media: media.filter((_, k) => k !== i) })}>×</button>
                        </div>
                      ))}
                      {media.length < 10 && (
                        <label className={"cal-media-add" + (mediaBusy ? " busy" : "")}>
                          <input type="file" multiple accept="image/*,video/mp4,video/quicktime" disabled={mediaBusy}
                            onChange={(e) => { addMedia(e.target.files); e.target.value = ""; }} />
                          {mediaBusy ? "Uploading…" : "+ Add"}
                        </label>
                      )}
                    </div>
                    <span className="adm-hint">One image or video, or up to 10 for a carousel. JPG images and MP4 videos work everywhere.</span>
                    {nonJpg.length > 0 && chosen.includes("instagram") && <span className="cal-warn">Instagram only accepts JPG images — {nonJpg.length === 1 ? "one image isn't" : `${nonJpg.length} images aren't`} JPG. Export as JPG, or untick Instagram.</span>}
                    {/reel/i.test(editing.format || "") && media.length > 0 && !media.some(isVideoMedia) && <span className="cal-warn">This is a Reel — add the video.</span>}
                  </div>
                  <label className="cal-check"><input type="checkbox" checked={editing.keywordHashtags !== false} onChange={(e) => set({ keywordHashtags: e.target.checked })} />
                    Add the keywords as hashtags</label>
                  {cap.text && <div className="adm-field"><label>What gets posted</label>
                    <p className="cal-pre cal-preview">{cap.text}</p>
                    <span className={"adm-hint" + (cap.text.length > 2200 ? " cal-warn" : "")}>{cap.text.length}/2,200 characters · {(cap.text.match(/#[\p{L}\p{N}_]+/gu) || []).length}/30 hashtags</span>
                  </div>}
                </fieldset>
              );
            })()}


            <div className="adm-drawer-actions">
              <button className="cal-primary" type="submit">Save post</button>
              <button className="cal-btn" type="button" onClick={() => { if (editing.id) setViewId(editing.id); setEditing(null); }}>Cancel</button>
              {editing.id && canDelete(editing) && <button className="cal-btn danger" type="button" onClick={deletePost} style={{ marginLeft: "auto" }}>Delete</button>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
