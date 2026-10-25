"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";
import DatePicker from "@/components/ui/DatePicker";
import { BoardSkeleton } from "@/components/admin/Skeleton";

type Stage = "planned" | "client" | "production" | "ready" | "posted";
type LogEntry = { id: string; userId?: number | null; minutes: number; note?: string; at: string };
type Post = {
  id: number; client: string; status: Stage;
  postDate?: string | null; postTime?: string | null; dueDate?: string | null;
  assigneeId?: number | null; estimateHours?: number | null;
  timeLog?: LogEntry[]; timerStart?: string | null; timerBy?: number | null;
  festive?: string; theme: string; topic?: string; format?: string; requirements?: string; reference?: string;
  dataStatus?: string; poc?: string; caption?: string; driveLink?: string; tags?: string; keywords?: string;
  channels?: string; remarks?: string; position?: number;
};
type Client = { id: number; name: string; color?: string };
type User = { id: number; name: string; avatar?: string | null };
type View = "board" | "schedule" | "calendar" | "mine";

const STAGES: { id: Stage; title: string; owner: string; color: string; bg: string; fg: string }[] = [
  { id: "planned", title: "Planned", owner: "Marketer · Graphic designer", color: "#6b7590", bg: "#eef0f4", fg: "#4b5466" },
  { id: "client", title: "Need from client", owner: "Marketer · Graphic designer", color: "#d97706", bg: "#fdf0dc", fg: "#9a4b06" },
  { id: "production", title: "In production", owner: "Video editor · Graphic designer", color: "#3e60ab", bg: "#e6ecf8", fg: "#2f55a4" },
  { id: "ready", title: "Ready to post", owner: "Social media", color: "#7c5cff", bg: "#efeaff", fg: "#5b35c9" },
  { id: "posted", title: "Posted", owner: "Social media", color: "#16a34a", bg: "#e4f5ea", fg: "#15703a" },
];
/* Who works on a post at each stage — same rule as the server. */
type Role = "marketer" | "video" | "graphic" | "social";
const ROLE_META: Record<Role, { label: string; fg: string; bg: string; does: string }> = {
  marketer: { label: "Marketer", fg: "#9a4b06", bg: "#fdf0dc", does: "Plans & shoots" },
  video: { label: "Video editor", fg: "#b0185a", bg: "#fbe6ef", does: "Edits the reel" },
  graphic: { label: "Graphic designer", fg: "#0f6b62", bg: "#dff3f0", does: "Designs it" },
  social: { label: "Social media", fg: "#2f55a4", bg: "#e6ecf8", does: "Posts it" },
};
const isReelish = (f?: string) => /reel|video|influencer/i.test(f || "");
const roleFor = (status: Stage, format?: string): Role =>
  (status === "ready" || status === "posted") ? "social" : !isReelish(format) ? "graphic" : status === "production" ? "video" : "marketer";
const CLIENT_COLORS = ["#3e60ab", "#0f766e", "#be185d", "#a16207", "#7c5cff", "#0369a1", "#c2410c", "#15803d"];
const FORMATS = ["Post", "Reel", "Carousel", "Video", "Story", "Influencer Reel"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/* Fields the drawer edits — time log + timer are written separately so a save never clobbers them. */
const EDITABLE: (keyof Post)[] = ["client", "status", "postDate", "postTime", "dueDate", "assigneeId", "estimateHours", "festive", "theme", "topic",
  "format", "requirements", "reference", "dataStatus", "poc", "caption", "driveLink", "tags", "keywords", "channels", "remarks"];

/* JSON columns can come back as strings on some MySQL setups — coerce. */
function toArr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.trim().startsWith("[")) { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } }
  return [];
}
const normPost = (p: Post): Post => ({
  ...p,
  postDate: p.postDate ? String(p.postDate).slice(0, 10) : null,
  dueDate: p.dueDate ? String(p.dueDate).slice(0, 10) : null,
  timeLog: toArr<LogEntry>(p.timeLog),
  estimateHours: p.estimateHours != null ? Number(p.estimateHours) : null,
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
function hm(min: number) { const t = Math.round(min || 0); const h = Math.floor(t / 60), m = t % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; }
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
function loggedMin(p: Post) {
  let m = toArr<LogEntry>(p.timeLog).reduce((a, e) => a + (Number(e.minutes) || 0), 0);
  if (p.timerStart) m += (Date.now() - new Date(p.timerStart).getTime()) / 60000;
  return m;
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
const HEADERS: [keyof Post | "date" | "day", RegExp][] = [
  ["date", /^date/], ["day", /^days?$/], ["festive", /festiv/], ["theme", /theme/], ["topic", /topic/],
  ["requirements", /requirement/], ["reference", /reference/], ["format", /reel|carousel|format|post type/],
  ["dataStatus", /data\s*status/], ["poc", /point of contact|^poc/], ["caption", /caption/], ["driveLink", /drive/],
  ["tags", /people|tag/], ["keywords", /keyword/], ["channels", /channel/], ["remarks", /remark/],
];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
function parseSheetDate(raw: string, dayName: string): string | null {
  const s = raw.trim(); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
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
  const get = (r: string[], k: string) => (col[k] !== undefined ? (r[col[k]] || "").trim() : "");
  const out: Partial<Post>[] = [];
  for (const r of rows.slice(h + 1)) {
    const postDate = parseSheetDate(get(r, "date"), get(r, "day"));
    const flat = (k: string) => get(r, k).replace(/\s*\n\s*/g, " ");
    const theme = flat("theme"), channels = get(r, "channels");
    if (!postDate || (!theme && !flat("topic") && !channels)) continue;
    const ds = flat("dataStatus").replace(/^\((.*)\)$/, "$1");
    const caption = get(r, "caption"), driveLink = get(r, "driveLink");
    const status: Stage = "planned"; // uploaded sheet rows start at the beginning of the pipeline
    const format = get(r, "format").replace(/caraousel/gi, "carousel").replace(/\s*[\\/]\s*/g, " / ")
      .toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase()).trim();
    out.push({
      client, status, postDate, theme: theme || "Untitled post", topic: flat("topic"), festive: flat("festive"), format,
      requirements: get(r, "requirements"), reference: get(r, "reference"), dataStatus: ds, poc: get(r, "poc"),
      caption, driveLink, tags: get(r, "tags"), keywords: get(r, "keywords"), channels, remarks: get(r, "remarks"),
    });
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
  const [logMin, setLogMin] = useState("");
  const [logNote, setLogNote] = useState("");
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [, setTick] = useState(0);
  const dragId = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    try {
      const [p, c, u, me] = await Promise.all([
        api.list("social-posts"), api.list("social-clients"),
        api.listUsers().catch(() => []), api.me().catch(() => null),
      ]);
      setPosts((Array.isArray(p) ? p : []).map(normPost));
      setClientRows(Array.isArray(c) ? c : []);
      setUsers(Array.isArray(u) ? u : []);
      setMeId((me?.user ?? me)?.id ?? null);
      const isLimited = Array.isArray((me?.user ?? me)?.socialClients);
      setLimited(isLimited);
      if (isLimited) setView((v) => (v === "board" ? "mine" : v));
      if (!isLimited) api.list("users").then((t) => setTeam(Array.isArray(t) ? t : [])).catch(() => {});
    } catch (e: any) { toast("Couldn't load the content calendar", "err", { description: e.message || "Check your connection and refresh the page." }); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    load();
    try { setView((localStorage.getItem("fv_social_view") as View) || "board"); setClient(localStorage.getItem("fv_social_client") || ""); } catch { /* ignore */ }
  }, []);
  useEffect(() => { const t = setInterval(() => setTick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
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

  /* ── writes ── */
  function patchLocal(id: number, patch: Partial<Post>) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setEditing((e) => (e?.id === id ? { ...e, ...patch } : e));
  }
  /* Team members see every post of their allotted brands but change only their own. */
  const canEdit = (p?: Partial<Post> | null) => !limited || (!!p && p.assigneeId === meId);
  const notYours = (p: Post) => toast("This post isn't yours to change", "warn", {
    description: `It's assigned to ${userById(p.assigneeId)?.name || "nobody yet"} — only they or an admin can change it.`,
  });
  async function moveTo(id: number, status: Stage) {
    const p = posts.find((x) => x.id === id);
    if (!p || p.status === status) return;
    if (!canEdit(p)) return notYours(p);
    patchLocal(id, { status });
    try {
      // The server hands the post to the next stage's role — show the new assignee straight away.
      const saved = await api.update("social-posts", id, { status });
      patchLocal(id, { assigneeId: saved?.assigneeId ?? null });
      const who = users.find((u) => u.id === saved?.assigneeId);
      const stageName = STAGES.find((s) => s.id === status)?.title || status;
      toast(status === "posted" ? "Marked as Posted" : `Moved to ${stageName}`, "ok", {
        description: who && who.id !== p.assigneeId ? `“${p.theme}” is now with ${who.name}.` : `“${p.theme}” · ${p.client}`,
      });
    }
    catch (e: any) { patchLocal(id, { status: p.status }); toast("Couldn't move the post", "err", { description: e.message || "It's back where it was — try again." }); }
  }
  const nextStage = (s: Stage) => STAGES[STAGES.findIndex((x) => x.id === s) + 1];
  async function savePost(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.client?.trim() || !editing?.theme?.trim()) return toast("Add a brand and a post theme", "warn", { description: "Both are needed before the post can be saved." });
    const body: Record<string, unknown> = {};
    for (const k of EDITABLE) body[k] = editing[k] === "" ? null : editing[k] ?? null;
    // A real post link on a post whose date has come means it's published.
    if (hasLiveLink(editing) && editing.postDate && String(editing.postDate).slice(0, 10) <= todayIso()) body.status = "posted";
    try {
      if (editing.id) await api.update("social-posts", editing.id, body);
      else await api.create("social-posts", { ...body, timeLog: [] });
      if (!limited && !clientRows.some((c) => c.name === editing.client)) await api.create("social-clients", { name: editing.client }).catch(() => {});
      if (editing.id) setViewId(editing.id);
      setEditing(null); toast(editing.id ? "Post updated" : "Post added", "ok", { description: `“${editing.theme}” · ${editing.client}` }); load();
    } catch (err: any) { toast("Couldn't save the post", "err", { description: err.message || "Your changes are still in the form — try again." }); }
  }
  async function deletePost() {
    if (!editing?.id) return;
    if (!(await dialog.confirm({ title: "Delete this post?", message: "Its time log is deleted too. This can't be undone.", danger: true, confirmText: "Delete" }))) return;
    await api.remove("social-posts", editing.id); setViewId(null); setEditing(null); toast("Post deleted", "ok", { description: `“${editing.theme}” was removed from ${editing.client}.` }); load();
  }
  async function addClient() {
    const name = (await dialog.prompt({ title: "New brand", placeholder: "e.g. Maharani by Rungta's", confirmText: "Add brand" }))?.trim();
    if (!name) return;
    if (clientNames.includes(name)) { setClient(name); return; }
    try {
      const c = await api.create("social-clients", { name, color: CLIENT_COLORS[clientNames.length % CLIENT_COLORS.length], position: clientRows.length });
      setClientRows((cs) => [...cs, c]); setClient(name); toast("Brand added", "ok", { description: `${name} is ready. Tick it for team members under Users.` });
    } catch (e: any) { toast("Couldn't add the brand", "err", { description: e.message }); }
  }
  const newPost = (patch: Partial<Post> = {}) => setEditing({ client, status: "planned", postDate: todayIso(), dueDate: weekBefore(todayIso()), timeLog: [], ...patch });

  /* ── time tracking ── */
  async function addLog(p: Post, minutes: number, note: string, extra: Partial<Post> = {}) {
    const entry: LogEntry = { id: uid(), userId: extra.timerStart === null ? p.timerBy ?? meId : meId, minutes: Math.max(1, Math.round(minutes)), note, at: new Date().toISOString() };
    const timeLog = [...toArr<LogEntry>(p.timeLog), entry];
    await api.update("social-posts", p.id, { timeLog, ...extra });
    patchLocal(p.id, { timeLog, ...extra });
  }
  async function toggleTimer(p: Post) {
    if (!canEdit(p)) return notYours(p);
    try {
      if (p.timerStart) {
        await addLog(p, (Date.now() - new Date(p.timerStart).getTime()) / 60000, "Timer session", { timerStart: null, timerBy: null });
        toast("Timer stopped", "ok", { description: `${hm((Date.now() - new Date(p.timerStart).getTime()) / 60000)} logged on “${p.theme}”.` });
      } else {
        const patch = { timerStart: new Date().toISOString(), timerBy: meId };
        await api.update("social-posts", p.id, patch); patchLocal(p.id, patch);
        toast("Timer started", "info", { description: `Tracking time on “${p.theme}”. Press Stop when you're done.`, sound: false });
      }
    } catch (e: any) { toast("Couldn't update the timer", "err", { description: e.message }); }
  }
  async function logManual(post: Post) {
    const p = posts.find((x) => x.id === post.id); const m = Number(logMin);
    if (!p || !(m > 0)) return toast("Enter the minutes worked", "warn", { description: "Type how many minutes you spent, then press Log." });
    try { await addLog(p, m, logNote.trim()); setLogMin(""); setLogNote(""); toast("Time logged", "ok", { description: `${hm(m)} on “${p.theme}”.` }); }
    catch (e: any) { toast("Couldn't log time", "err", { description: e.message }); }
  }
  async function removeLog(post: Post, entryId: string) {
    const p = posts.find((x) => x.id === post.id); if (!p) return;
    const timeLog = toArr<LogEntry>(p.timeLog).filter((e) => e.id !== entryId);
    try { await api.update("social-posts", p.id, { timeLog }); patchLocal(p.id, { timeLog }); }
    catch (e: any) { toast("Couldn't remove the time entry", "err", { description: e.message }); }
  }

  /* ── admin: why posts are waiting ── */
  const waiting = limited ? [] : posts.filter((p) => !p.assigneeId);
  const gaps = (() => {
    const out: { brand: string; role: Role; count: number }[] = [];
    for (const p of waiting) {
      const role = roleFor(p.status, p.format);
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
  async function importCsv(file?: File) {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const guess = client || (rows[0]?.find((c) => c.trim()) || "").trim().replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase());
    const name = (await dialog.prompt({ title: "Import posts for which brand?", defaultValue: guess, confirmText: "Next" }))?.trim();
    if (!name) return;
    if (limited && !clientNames.includes(name)) return dialog.alert({ title: "Not one of your brands", message: `You can import only into: ${clientNames.join(", ") || "no brands yet"}.` });
    const parsed = sheetToPosts(rows, name);
    if (!parsed.length) return dialog.alert({ title: "No posts found", message: "The CSV needs a header row with a “Post Theme” column and a “Date” column." });
    if (!(await dialog.confirm({ title: `Import ${parsed.length} posts for ${name}?`, message: "Rows already on the board (same date + post theme) are updated, keeping their stage and assignee. New rows go to Planned and to their maker — reels to a Marketer (then a Video editor at In production), posts and carousels to a Graphic designer.", confirmText: "Import" }))) return;
    try {
      const r = await api.importSocialPosts(parsed);
      const parts = [r.created ? `${r.created} added to Planned` : "", r.updated ? `${r.updated} updated` : ""].filter(Boolean).join(", ");
      toast(`Sheet uploaded · ${name}`, "ok", { description: `${parts || "Nothing new"}.${limited ? " You'll see the ones assigned to you." : ""}` });
      setClient(name); load();
    } catch (e: any) { toast("Import failed", "err", { description: e.message || "Check the file is a CSV saved from the media calendar sheet." }); }
  }

  /* ── small pieces ── */
  const timerText = (p: Post) => `${p.timerStart ? "● " : ""}${hm(loggedMin(p))}${p.estimateHours ? ` / ${p.estimateHours}h` : ""}`;
  const css = (v: Record<string, string>) => v as unknown as React.CSSProperties;
  const badge = (p: Post) => { const d = dueInfo(p); return d ? <span className="cal-badge" style={css({ "--bg": d.bg, "--fg": d.fg })}>{d.text}</span> : null; };
  const fmtChip = (f?: string) => { if (!f) return null; const [bg, fg] = formatColors(f); return <span className="cal-chip" style={css({ "--bg": bg, "--fg": fg })}>{f}</span>; };
  const stageChip = (s: Stage) => { const st = STAGES.find((x) => x.id === s)!; return <span className="cal-chip" style={css({ "--bg": st.bg, "--fg": st.fg })}>{st.title}</span>; };
  /* Assignee pill coloured by the role the post's stage calls for. */
  const whoPill = (p: Post, size: "sm" | "md" = "sm") => {
    const u = userById(p.assigneeId);
    if (!u) return <span className={"cal-who none " + size}>Unassigned</span>;
    const r = ROLE_META[roleFor(p.status, p.format)];
    return <span className={"cal-who " + size} style={css({ "--bg": r.bg, "--fg": r.fg })} title={`${u.name} · ${r.label}`}><i>{initials(u.name)}</i>{u.name}</span>;
  };
  const progress = (p: Post) => {
    const d = dueInfo(p);
    const color = d?.cls === "over" ? "#dc2626" : isDone(p) ? "#16a34a" : d?.cls === "soon" ? "#d97706" : "#3e60ab";
    return <span className="cal-bar"><i style={{ width: `${progressPct(p)}%`, background: color }} /></span>;
  };
  const startOf = (p: Post) => p.dueDate || weekBefore(p.postDate);

  /* Render helpers are plain functions (not components) so a re-render mid-drag never remounts the board. */
  function renderCard(p: Post) {
    return (
      <button type="button" key={p.id} className={"cal-card" + (canEdit(p) ? "" : " ro")} draggable={canEdit(p)}
        onDragStart={(e) => { dragId.current = p.id; e.currentTarget.classList.add("dragging"); }}
        onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
        onClick={() => setViewId(p.id)} aria-label={`${p.theme}, ${p.client}, ${dueInfo(p)?.text || ""}`}>
        <span className="cal-card-top">
          <i style={{ background: clientColor(p.client) }} /><span className="cal-brand">{p.client}</span>{fmtChip(p.format)}
        </span>
        <span className="cal-title">{p.theme || "Untitled post"}</span>
        {p.festive && <span className="cal-fest">{p.festive}</span>}
        {p.postDate && (
          <span className="cal-dates"><span>Start {fmtShort(startOf(p))}</span><span>Live {fmtShort(p.postDate)}{p.postTime ? ` · ${fmtTime(p.postTime)}` : ""}</span></span>
        )}
        {p.postDate && progress(p)}
        <span className="cal-card-foot">{whoPill(p)}{badge(p)}</span>
        {(loggedMin(p) > 0 || p.timerStart) && <span className={"cal-time" + (p.timerStart ? " run" : "")}>{timerText(p)} logged</span>}
      </button>
    );
  }

  function renderBoard() {
    return (
      <div className="cal-board-scroll">
        <div className="cal-board">
          {STAGES.map((s) => {
            const items = list.filter((p) => p.status === s.id);
            return (
              <section key={s.id} aria-label={s.title} className={"cal-col" + (overStage === s.id ? " over" : "")}
                onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
                onDragLeave={() => setOverStage((o) => (o === s.id ? null : o))}
                onDrop={() => { setOverStage(null); if (dragId.current != null) moveTo(dragId.current, s.id); dragId.current = null; }}>
                <div className="cal-col-head">
                  <span className="cal-col-title"><i style={{ background: s.color }} /><h2>{s.title}</h2><b>{items.length}</b></span>
                  <span className="cal-col-owner">{s.owner}</span>
                </div>
                {items.map(renderCard)}
                {!items.length && <div className="cal-col-empty">Nothing here</div>}
                {!limited && <button type="button" className="cal-add" onClick={() => newPost({ status: s.id })}>+ Add post</button>}
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

  function renderSchedule() {
    const groups = scheduleGroups(list);
    if (!groups.length) return <div className="cal-empty">Nothing open here. Every post in this view is posted.</div>;
    return (
      <div className="cal-sched">
        {groups.map(([name, hint, cls, items]) => (
          <section key={name} aria-label={name}>
            <div className="cal-group-head"><h2 className={cls}>{name}</h2><b>{items.length}</b><span>{hint}</span></div>
            <div className="cal-table-wrap">
              <table className="cal-table">
                <thead><tr><th>Goes live</th><th>Start work</th><th>Post</th><th>Stage</th><th>With</th><th>Timeline</th><th>Time</th></tr></thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.id}>
                      <td className="nw" data-label="Goes live"><b>{fmtDay(p.postDate)}</b><br /><span className="cal-muted">{fmtTime(p.postTime) || "—"}</span></td>
                      <td className="nw cal-muted" data-label="Start work">{p.postDate ? fmtShort(startOf(p)) : "—"}</td>
                      <td className="cal-tpost">
                        <button type="button" className="cal-link" onClick={() => setViewId(p.id)}>{p.theme}</button>
                        <span className="cal-sub"><i style={{ background: clientColor(p.client) }} />{p.client}{fmtChip(p.format)}</span>
                      </td>
                      <td data-label="Stage">{stageChip(p.status)}</td>
                      <td data-label="With">{whoPill(p)}</td>
                      <td data-label="Timeline">{badge(p)}</td>
                      <td className="nw" data-label="Time">
                        <span className="cal-timecell">
                          <b className={p.timerStart ? "run" : ""}>{hm(loggedMin(p))}</b>
                          {canEdit(p) && <button type="button" className={"cal-timer" + (p.timerStart ? " run" : "")} onClick={() => toggleTimer(p)}
                            aria-label={`${p.timerStart ? "Stop" : "Start"} timer on ${p.theme}`}>{p.timerStart ? "■ Stop" : "▶ Start"}</button>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    );
  }

  function renderCalendar() {
    const cm = month || calMonth || todayIso().slice(0, 7);
    const [y, mo] = cm.split("-").map(Number);
    const first = new Date(y, mo - 1, 1);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const daysIn = new Date(y, mo, 0).getDate();
    const total = Math.ceil((((first.getDay() + 6) % 7) + daysIn) / 7) * 7;
    const liveOn: Record<string, Post[]> = {}, startsOn: Record<string, Post[]> = {};
    for (const p of list) {
      if (p.postDate) (liveOn[p.postDate] ||= []).push(p);
      if (showStarts && p.postDate && !isDone(p)) (startsOn[startOf(p)] ||= []).push(p);
    }
    const cells: Date[] = [];
    for (let i = 0; i < total; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(d); }
    const shift = (n: number) => { setMonth(""); setCalMonth(iso(new Date(y, mo - 1 + n, 1)).slice(0, 7)); };
    const t = todayIso();
    const selLive = liveOn[calDay] || [], selStarts = startsOn[calDay] || [];
    return (
      <>
        <div className="cal-calhead">
          <button type="button" className="cal-icon" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <h2>{MONTHS[mo - 1]} {y}</h2>
          <button type="button" className="cal-icon" onClick={() => shift(1)} aria-label="Next month">›</button>
          <button type="button" className="cal-btn" onClick={() => { setMonth(""); setCalMonth(t.slice(0, 7)); setCalDay(t); }}>Today</button>
          <label className="cal-check"><input type="checkbox" checked={showStarts} onChange={(e) => setShowStarts(e.target.checked)} /> Show start-work days</label>
        </div>
        <div className="cal-legend">
          {STAGES.map((s) => <span key={s.id}><i style={{ background: s.bg, borderLeftColor: s.color }} />{s.title}</span>)}
          <span><i className="dash" />Start work (7 days before)</span>
        </div>
        <div className="cal-cal-wrap">
          <div className="cal-cal-scroll">
            <div className="cal-cal">
              {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
              {cells.map((d) => {
                const ds = iso(d), inMonth = d.getMonth() === mo - 1;
                const live = liveOn[ds] || [], starts = startsOn[ds] || [];
                const room = Math.max(0, 3 - live.length);
                const more = live.length + starts.length - Math.min(3, live.length) - Math.min(room, starts.length);
                return (
                  <button type="button" key={ds} onClick={() => setCalDay(ds)}
                    className={"cal-day" + (inMonth ? "" : " out") + (ds === t ? " today" : "") + (ds === calDay ? " sel" : "")}
                    aria-label={`${fmtDay(ds)}: ${live.length} going live, ${starts.length} starting`}>
                    <span className="cal-num"><b>{d.getDate()}</b></span>
                    {live.slice(0, 3).map((p) => {
                      const st = STAGES.find((s) => s.id === p.status)!;
                      return <span key={p.id} className="cal-ev" style={css({ "--bg": st.bg, "--fg": st.color })}>{p.postTime ? `${fmtTime(p.postTime).replace(":00", "").replace(" ", "").toLowerCase()} ` : ""}{p.theme}</span>;
                    })}
                    {starts.slice(0, room).map((p) => <span key={"s" + p.id} className="cal-ev start">Start · {p.theme}</span>)}
                    {more > 0 && <span className="cal-more">+{more} more</span>}
                    {(live.length > 0 || starts.length > 0) && (
                      <span className="cal-dots" aria-hidden="true">
                        {live.slice(0, 4).map((p) => <i key={p.id} style={{ background: STAGES.find((x) => x.id === p.status)!.color }} />)}
                        {starts.length > 0 && <i className="s" />}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <aside className="cal-agenda" aria-label="Selected day">
            <span className="cal-eyebrow">Selected day</span>
            <h3>{fmtDay(calDay)}</h3>
            {selLive.length > 0 && <span className="cal-agenda-h">Going live</span>}
            {selLive.map((p) => {
              const st = STAGES.find((s) => s.id === p.status)!;
              return (
                <button type="button" key={p.id} className="cal-agenda-item" style={css({ "--fg": st.color })} onClick={() => setViewId(p.id)}>
                  <span className="cal-agenda-meta"><span>{p.client}</span><b>{st.title}</b></span>
                  <b>{p.theme}</b>
                  <span className="cal-muted">{[fmtTime(p.postTime), p.format, userById(p.assigneeId)?.name && `with ${userById(p.assigneeId)!.name}`].filter(Boolean).join(" · ")}</span>
                </button>
              );
            })}
            {selStarts.length > 0 && <span className="cal-agenda-h">Work starts</span>}
            {selStarts.map((p) => (
              <button type="button" key={"s" + p.id} className="cal-agenda-item start" onClick={() => setViewId(p.id)}>
                <b>{p.theme}</b>
                <span className="cal-muted">Goes live {fmtShort(p.postDate)}{userById(p.assigneeId) ? ` · ${userById(p.assigneeId)!.name}` : ""}</span>
              </button>
            ))}
            {!selLive.length && !selStarts.length && <div className="cal-empty sm">Nothing planned this day.</div>}
            {!limited && <button type="button" className="cal-link" onClick={() => newPost({ postDate: calDay, dueDate: weekBefore(calDay) })}>+ Add a post on this day</button>}
          </aside>
        </div>
      </>
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
                const nx = nextStage(p.status);
                return (
                  <article key={p.id} className="cal-task">
                    <div className="cal-task-main">
                      <span className="cal-card-top">{fmtChip(p.format)}<span className="cal-brand">{p.client}</span>{badge(p)}</span>
                      <button type="button" className="cal-link big" onClick={() => setViewId(p.id)}>{p.theme}</button>
                      <span className="cal-muted">{stageChip(p.status)} Goes live {fmtDay(p.postDate)}{p.postTime ? ` · ${fmtTime(p.postTime)}` : ""}</span>
                      {p.postDate && progress(p)}
                    </div>
                    <div className="cal-task-actions">
                      <span className="cal-task-time"><span>Time spent</span><b className={p.timerStart ? "run" : ""}>{hm(loggedMin(p))}</b></span>
                      <button type="button" className={"cal-timer lg" + (p.timerStart ? " run" : "")} onClick={() => toggleTimer(p)}>{p.timerStart ? "■ Stop timer" : "▶ Start timer"}</button>
                      {nx && <button type="button" className="cal-primary" onClick={() => moveTo(p.id, nx.id)}>Done → {nx.title}</button>}
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
    const chain: Role[] = isReelish(p.format) ? ["marketer", "video", "social"] : ["graphic", "social"];
    const cur = chain.indexOf(roleFor(p.status, p.format));
    const assignee = userById(p.assigneeId);
    const nx = nextStage(p.status);
    let nextLabel = "";
    if (nx) {
      const nr = roleFor(nx.id, p.format);
      const changes = nr !== roleFor(p.status, p.format) || nx.id === "ready";
      const c = !limited && changes ? candidates(nr, p.client, nx.id === "ready" ? p.assigneeId : null) : [];
      nextLabel = `Move to ${nx.title}` + (changes ? ` → ${c.length === 1 ? c[0].name.split(" ")[0] : ROLE_META[nr].label}` : "");
    }
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
              const names = state === "now" ? (assignee ? [assignee.name] : []) : (!limited ? candidates(r, p.client).map((u) => u.name) : []);
              const meta = ROLE_META[r];
              return (
                <div key={r} className={"cal-step " + state}>
                  <i style={state === "now" ? css({ "--fg": meta.fg }) : undefined}>{state === "done" ? "✓" : i + 1}</i>
                  <span>
                    <b className={!names.length && state === "now" ? "missing" : ""}>{names.length ? names.join(", ") : state === "now" ? "Nobody yet — set up in Team" : meta.label}</b>
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
            <div><span>Time spent</span><b>{timerText(p)}</b></div>
            {p.poc && <div><span>Client contact</span><b>{p.poc}</b></div>}
            {p.dataStatus && <div><span>Data status</span><b>{p.dataStatus}</b></div>}
          </div>

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

          {canEdit(p) ? renderTime(p) : (
            <div className="cal-vsec"><h4>Time log</h4><span className="cal-muted">{hm(loggedMin(p))} logged in total.</span></div>
          )}

          {canEdit(p) ? (
            <div className="adm-drawer-actions cal-actions">
              {nx && <button type="button" className="cal-primary wide" onClick={() => moveTo(p.id, nx.id)}>{nextLabel}</button>}
              <div className="cal-row">
                <button type="button" className={"cal-timer lg grow" + (p.timerStart ? " run" : "")} onClick={() => toggleTimer(p)}>{p.timerStart ? "■ Stop timer" : "▶ Start timer"}</button>
                <button type="button" className="cal-btn lg grow" onClick={() => { setEditing({ ...p }); setViewId(null); }}>Edit post</button>
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

  /* Time log — shown on the details card and in the editor. */
  function renderTime(p: Post) {
    return (
      <div className="cal-vsec">
        <h4>Time log</h4>
        {p.timerStart && <p className="adm-hint">Timer running since {new Date(p.timerStart).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}{userById(p.timerBy) ? ` · ${userById(p.timerBy)!.name}` : ""}</p>}
        <div className="sm-logadd">
          <input type="number" min={1} step={5} value={logMin} onChange={(e) => setLogMin(e.target.value)} placeholder="Minutes" aria-label="Minutes worked" />
          <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="What was done (reel edit, caption…)" aria-label="Work note"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); logManual(p); } }} />
          <button type="button" className="cal-btn" onClick={() => logManual(p)}>Log</button>
        </div>
        <div className="sm-log">
          {toArr<LogEntry>(p.timeLog).slice().reverse().map((e) => (
            <div key={e.id} className="sm-logrow">
              <b>{hm(e.minutes)}</b>
              <span className="note">{e.note || "Work session"}</span>
              <span className="cal-muted">{[userById(e.userId)?.name, new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })].filter(Boolean).join(" · ")}</span>
              <button type="button" onClick={() => removeLog(p, e.id)} aria-label="Remove entry">×</button>
            </div>
          ))}
          {!toArr(p.timeLog).length && <span className="adm-hint">No time logged yet. Start the timer while you work, or log minutes by hand.</span>}
        </div>
      </div>
    );
  }

  /* Admin: Team & uploads — who covers each brand, and the sheet uploads. */
  function renderTeamPanel(ups: Upload[]) {
    const roles: Role[] = ["marketer", "video", "graphic", "social"];
    return (
      <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setUploads(null); }}>
        <div className="adm-drawer kb-drawer cal-view cal-wide" role="dialog" aria-modal="true" aria-label="Team & uploads">
          <div className="cal-vtop"><h2 style={{ margin: 0 }}>Team &amp; uploads</h2>
            <button type="button" className="cal-x" onClick={() => setUploads(null)} aria-label="Close">×</button></div>
          <p className="cal-lead">Posts go to someone automatically — but only to a person who has the role <b>and</b> the brand ticked. A gap means posts wait.</p>

          <div className="cal-vsec">
            <h4>Who covers each brand</h4>
            <div className="cal-table-wrap">
              <table className="cal-table cal-cover">
                <thead><tr><th>Brand</th>{roles.map((r) => <th key={r} style={{ color: ROLE_META[r].fg }}>{ROLE_META[r].label}</th>)}</tr></thead>
                <tbody>
                  {clientNames.map((b) => (
                    <tr key={b}>
                      <td><span className="cal-sub strong"><i style={{ background: clientColor(b) }} />{b}</span></td>
                      {roles.map((r) => {
                        const c = candidates(r, b);
                        const waitingHere = gaps.find((g) => g.brand === b && g.role === r)?.count || 0;
                        return c.length
                          ? <td key={r}>{c.map((u) => u.name).join(", ")}</td>
                          : <td key={r} className="gap"><b>Nobody</b>{waitingHere > 0 && <small>{waitingHere} waiting</small>}<a href="/dashboard/users">Assign</a></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
  const live = editing?.id ? posts.find((p) => p.id === editing.id) : undefined;
  const viewed = viewId != null ? posts.find((p) => p.id === viewId) : undefined;
  const set = (patch: Partial<Post>) => setEditing((e) => ({ ...e, ...patch }));
  const txt = (k: keyof Post) => String(editing?.[k] ?? "");
  const views: [View, string][] = limited ? [["mine", "My work"], ["schedule", "Schedule"], ["calendar", "Calendar"], ["board", "Board"]] : [["board", "Board"], ["schedule", "Schedule"], ["calendar", "Calendar"]];
  const activeView: View = !limited && view === "mine" ? "board" : view;

  // Editor: who the post goes to at its stage, and whether the start date is automatic.
  const edRole = editing ? roleFor((editing.status || "planned") as Stage, editing.format) : "graphic";
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
            ? "My work lists your posts. Board, Schedule and Calendar show everything for your brands — you can change only the posts assigned to you."
            : "Every brand's posts from plan to live link, with who has each one and when work starts."}</p>
        </div>
        <div className="cal-head-actions">
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { importCsv(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          <button type="button" className="cal-btn" onClick={() => fileRef.current?.click()}>Import sheet</button>
          {!limited && <button type="button" className="cal-btn" onClick={openUploads}>Team &amp; uploads</button>}
          {!limited && <button type="button" className="cal-btn" onClick={addClient}>+ Brand</button>}
          {!limited && <button type="button" className="cal-primary" onClick={() => newPost()}>+ New post</button>}
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

      {gaps.length > 0 && (
        <div className="cal-alert" role="status">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6A2 2 0 0 0 22 18L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
          <span>
            <b>{gaps.reduce((n, g) => n + g.count, 0)} posts are waiting</b> — {gaps.map((g, i) => (
              <span key={g.brand + g.role}>{i > 0 && "; "}{g.count} need a <b>{ROLE_META[g.role].label}</b> with <b>{g.brand}</b> ticked</span>
            ))}.
          </span>
          <button type="button" className="cal-link" onClick={openUploads}>See who covers what</button>
        </div>
      )}

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
          : "No posts yet. Add a brand and a post, or import a brand's media calendar (Excel → Save as CSV)."}</div>
      ) : activeView === "mine" ? renderMine() : activeView === "schedule" ? renderSchedule() : activeView === "calendar" ? renderCalendar() : renderBoard()}

      {viewed && !editing && renderDetails(viewed)}
      {uploads && renderTeamPanel(uploads)}

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
                <div className="adm-field" style={{ flex: 1 }}><label>Estimated hours</label>
                  <input type="number" min={0} step={0.25} value={editing.estimateHours ?? ""} onChange={(e) => set({ estimateHours: e.target.value === "" ? null : Number(e.target.value) })} placeholder="e.g. 2" /></div>
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
                <span className="cal-muted">At this stage it's for a <b style={{ color: ROLE_META[edRole].fg }}>{ROLE_META[edRole].label}</b>
                  {!limited && editing.client && (edCands.length ? ` — ${edCands.map((u) => u.name).join(", ")}` : " — nobody has this brand ticked yet")}.</span>
              </div>
              <div className="adm-field"><label>Assigned to</label>
                <Select value={editing.assigneeId ? String(editing.assigneeId) : ""} onChange={(v) => set({ assigneeId: v ? Number(v) : null })} ariaLabel="Assigned to"
                  options={[{ value: "", label: edAssignee ? "Unassigned" : "Pick automatically" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
                <span className="adm-hint">Changes by itself when the stage moves (Ready to post always goes to a different person than the maker). Pick someone here to override.</span></div>
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

            {live && renderTime(live)}

            <div className="adm-drawer-actions">
              <button className="cal-primary" type="submit">Save post</button>
              <button className="cal-btn" type="button" onClick={() => { if (editing.id) setViewId(editing.id); setEditing(null); }}>Cancel</button>
              {editing.id && <button className="cal-btn danger" type="button" onClick={deletePost} style={{ marginLeft: "auto" }}>Delete</button>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
