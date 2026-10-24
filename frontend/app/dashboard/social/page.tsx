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
type View = "board" | "schedule" | "calendar";

const STAGES: { id: Stage; title: string; hint: string; color: string }[] = [
  { id: "planned", title: "Planned", hint: "Idea on the calendar", color: "#8a93aa" },
  { id: "client", title: "Need from client", hint: "Waiting on photos, video or approval", color: "#ea580c" },
  { id: "production", title: "In production", hint: "Material in hand, being made", color: "#3e60ab" },
  { id: "ready", title: "Ready to post", hint: "Creative + caption done", color: "#7c5cff" },
  { id: "posted", title: "Posted", hint: "Live, links added", color: "#16a34a" },
];
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
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const daysFrom = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
function fmtDay(d?: string | null) {
  if (!d) return "No date";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
function hm(min: number) { const t = Math.round(min || 0); const h = Math.floor(t / 60), m = t % 60; return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`; }
function formatColor(f?: string) {
  const s = (f || "").toLowerCase();
  if (s.includes("influencer")) return "#ea580c";
  if (s.includes("reel")) return "#db2777";
  if (s.includes("carousel")) return "#a16207";
  if (s.includes("video")) return "#9333ea";
  if (s.includes("story")) return "#0f766e";
  if (s.includes("post")) return "#0891b2";
  return "#8a93aa";
}
const isDone = (p: Post) => p.status === "posted";
const deadline = (p: Post) => p.dueDate || p.postDate || "";
function dueInfo(p: Post) {
  if (isDone(p) || !deadline(p)) return null;
  const days = daysFrom(todayIso(), deadline(p));
  const what = p.dueDate ? "Work due" : "Goes live";
  if (days < 0) return { cls: "over", text: `Overdue ${-days}d`, days };
  if (days === 0) return { cls: "soon", text: `${what} today`, days };
  return { cls: days <= 3 ? "soon" : "", text: `${what} in ${days}d`, days };
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
    const status: Stage = "posted"; // an uploaded sheet is past work — everything in it is already live
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
function Avatar({ user, size = 22 }: { user?: User | null; size?: number }) {
  const s = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  // eslint-disable-next-line @next/next/no-img-element
  if (user?.avatar) return <img className="kb-av" src={user.avatar} alt={user.name} style={s} title={user.name} />;
  return <span className="kb-av kb-av-i" style={s} title={user?.name}>{initials(user?.name)}</span>;
}

export default function SocialCalendar() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [clientRows, setClientRows] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  // Brand access set by an admin: false = every brand (admin), true = only assigned brands.
  const [limited, setLimited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState("");
  const [view, setView] = useState<View>("board");
  const [month, setMonth] = useState("");
  const [format, setFormat] = useState("");
  const [who, setWho] = useState("");
  const [query, setQuery] = useState("");
  const [calMonth, setCalMonth] = useState("");
  const [editing, setEditing] = useState<Partial<Post> | null>(null);
  const [viewId, setViewId] = useState<number | null>(null); // read-only details card
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
      setLimited(Array.isArray((me?.user ?? me)?.socialClients));
    } catch (e: any) { toast(e.message || "Couldn't load the social calendar", "err"); }
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

  /* ── writes ── */
  function patchLocal(id: number, patch: Partial<Post>) {
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setEditing((e) => (e?.id === id ? { ...e, ...patch } : e));
  }
  async function moveTo(id: number, status: Stage) {
    const p = posts.find((x) => x.id === id);
    if (!p || p.status === status) return;
    patchLocal(id, { status });
    try {
      // The server hands the post to the next stage's role — show the new assignee straight away.
      const saved = await api.update("social-posts", id, { status });
      patchLocal(id, { assigneeId: saved?.assigneeId ?? null });
      const who = users.find((u) => u.id === saved?.assigneeId);
      // Team members only see their own posts — one handed to someone else leaves their board.
      if (limited && saved?.assigneeId !== meId) { setPosts((ps) => ps.filter((x) => x.id !== id)); setViewId((v) => (v === id ? null : v)); }
      toast(status === "posted" ? "Marked as posted 🎉" : who && who.id !== p.assigneeId ? `Moved · now with ${who.name}` : "Moved");
    }
    catch (e: any) { patchLocal(id, { status: p.status }); toast(e.message || "Couldn't move the post", "err"); }
  }
  async function savePost(e: React.FormEvent) {
    e.preventDefault();
    if (!editing?.client?.trim() || !editing?.theme?.trim()) return toast("Client and post theme are required", "err");
    const body: Record<string, unknown> = {};
    for (const k of EDITABLE) body[k] = editing[k] === "" ? null : editing[k] ?? null;
    if (editing.channels?.trim()) body.status = "posted";
    try {
      if (editing.id) await api.update("social-posts", editing.id, body);
      else await api.create("social-posts", { ...body, timeLog: [] });
      if (!limited && !clientRows.some((c) => c.name === editing.client)) await api.create("social-clients", { name: editing.client }).catch(() => {});
      if (editing.id) setViewId(editing.id);
      setEditing(null); toast("Post saved"); load();
    } catch (err: any) { toast(err.message || "Couldn't save the post", "err"); }
  }
  async function deletePost() {
    if (!editing?.id) return;
    if (!(await dialog.confirm({ title: "Delete this post?", message: "Its time log is deleted too. This can't be undone.", danger: true, confirmText: "Delete" }))) return;
    await api.remove("social-posts", editing.id); setViewId(null); setEditing(null); toast("Post deleted"); load();
  }
  async function addClient() {
    const name = (await dialog.prompt({ title: "New client", placeholder: "e.g. Maharani by Rungta's", confirmText: "Add client" }))?.trim();
    if (!name) return;
    if (clientNames.includes(name)) { setClient(name); return; }
    try {
      const c = await api.create("social-clients", { name, color: CLIENT_COLORS[clientNames.length % CLIENT_COLORS.length], position: clientRows.length });
      setClientRows((cs) => [...cs, c]); setClient(name); toast("Client added");
    } catch (e: any) { toast(e.message || "Couldn't add the client", "err"); }
  }

  /* ── time tracking ── */
  async function addLog(p: Post, minutes: number, note: string, extra: Partial<Post> = {}) {
    const entry: LogEntry = { id: uid(), userId: extra.timerStart === null ? p.timerBy ?? meId : meId, minutes: Math.max(1, Math.round(minutes)), note, at: new Date().toISOString() };
    const timeLog = [...toArr<LogEntry>(p.timeLog), entry];
    await api.update("social-posts", p.id, { timeLog, ...extra });
    patchLocal(p.id, { timeLog, ...extra });
  }
  async function toggleTimer(p: Post) {
    try {
      if (p.timerStart) {
        await addLog(p, (Date.now() - new Date(p.timerStart).getTime()) / 60000, "Timer session", { timerStart: null, timerBy: null });
        toast("Time logged");
      } else {
        const patch = { timerStart: new Date().toISOString(), timerBy: meId };
        await api.update("social-posts", p.id, patch); patchLocal(p.id, patch);
      }
    } catch (e: any) { toast(e.message || "Couldn't update the timer", "err"); }
  }
  async function logManual(post: Post) {
    const p = posts.find((x) => x.id === post.id); const m = Number(logMin);
    if (!p || !(m > 0)) return toast("Enter the minutes worked", "err");
    try { await addLog(p, m, logNote.trim()); setLogMin(""); setLogNote(""); toast("Time logged"); }
    catch (e: any) { toast(e.message || "Couldn't log time", "err"); }
  }
  async function removeLog(post: Post, entryId: string) {
    const p = posts.find((x) => x.id === post.id); if (!p) return;
    const timeLog = toArr<LogEntry>(p.timeLog).filter((e) => e.id !== entryId);
    try { await api.update("social-posts", p.id, { timeLog }); patchLocal(p.id, { timeLog }); }
    catch (e: any) { toast(e.message || "Couldn't remove the entry", "err"); }
  }

  /* ── import ── */
  async function importCsv(file?: File) {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const guess = client || (rows[0]?.find((c) => c.trim()) || "").trim().replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase());
    const name = (await dialog.prompt({ title: "Import posts for which client?", defaultValue: guess, confirmText: "Next" }))?.trim();
    if (!name) return;
    if (limited && !clientNames.includes(name)) return dialog.alert({ title: "Not one of your brands", message: `You can import only into: ${clientNames.join(", ") || "no brands yet"}.` });
    const parsed = sheetToPosts(rows, name);
    if (!parsed.length) return dialog.alert({ title: "No posts found", message: "The CSV needs a header row with a “Post Theme” column and a “Date” column." });
    if (!(await dialog.confirm({ title: `Import ${parsed.length} posts for ${name}?`, message: "Uploaded posts are added as Posted and assigned to your Social media team.", confirmText: "Import" }))) return;
    try {
      const r = await api.importSocialPosts(parsed);
      if (limited) toast("Imported posts go to whoever they're assigned to — you'll see the ones assigned to you", "ok");
      toast(`Imported ${r.created} posts`); setClient(name); load();
    } catch (e: any) { toast(e.message || "Import failed", "err"); }
  }

  /* ── pieces ── */
  const timerText = (p: Post) => `${p.timerStart ? "● " : ""}${hm(loggedMin(p))}${p.estimateHours ? ` / ${p.estimateHours}h` : ""}`;
  const dueChip = (p: Post) => { const d = dueInfo(p); return d ? <span className={"kbc-renew " + d.cls}>{d.text}</span> : null; };

  /* Render helpers are plain functions (not components) so a re-render mid-drag never remounts the board. */
  function renderCard(p: Post) {
    const assignee = userById(p.assigneeId);
    const logged = loggedMin(p);
    return (
      <div key={p.id} className="kb-card sm-card" draggable style={{ ["--cc" as string]: clientColor(p.client) } as React.CSSProperties}
        onDragStart={(e) => { dragId.current = p.id; e.currentTarget.classList.add("dragging"); }}
        onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
        onClick={() => setViewId(p.id)}>
        <div className="sm-card-top">
          <span className="sm-date">{fmtDay(p.postDate)}{p.postTime && ` · ${fmtTime(p.postTime)}`}</span>
          {p.format && <span className="sm-fmt" style={{ ["--fc" as string]: formatColor(p.format) } as React.CSSProperties}>{p.format}</span>}
        </div>
        {!client && <div className="sm-cname" style={{ color: clientColor(p.client) }}>{p.client}</div>}
        <h4>{p.theme || "Untitled post"}</h4>
        {p.festive && <div className="sm-fest">🎉 {p.festive}</div>}
        {p.topic && <p className="kb-desc">{p.topic}</p>}
        <div className="kbc-foot">
          <div className="kbc-meta">
            {dueChip(p)}
            {(logged > 0 || p.estimateHours || p.timerStart) && <span className={"sm-time" + (p.timerStart ? " run" : "")}>⏱ {timerText(p)}</span>}
          </div>
          {assignee && <Avatar user={assignee} size={24} />}
        </div>
        <div className="sm-flags">
          <span className={p.caption ? "on" : ""}>{p.caption ? "✓" : "○"} Caption</span>
          <span className={p.driveLink ? "on" : ""}>{p.driveLink ? "✓" : "○"} Creative</span>
          <span className={p.channels ? "on" : ""}>{p.channels ? "✓" : "○"} Live</span>
        </div>
      </div>
    );
  }

  function renderBoard() {
    return (
      <div className="kb">
        {STAGES.map((s) => {
          const items = list.filter((p) => p.status === s.id);
          return (
            <div key={s.id} className={"kb-col" + (overStage === s.id ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setOverStage(s.id); }}
              onDragLeave={() => setOverStage((o) => (o === s.id ? null : o))}
              onDrop={() => { setOverStage(null); if (dragId.current != null) moveTo(dragId.current, s.id); dragId.current = null; }}>
              <div className="kb-col-head">
                <span className="sm-dot" style={{ background: s.color }} />
                <span className="t">{s.title}</span>
                <span className="count">{items.length}</span>
              </div>
              <div className="kb-col-sub">{s.hint}</div>
              <div className="kb-cards">{items.map(renderCard)}</div>
              <button className="kb-addcard" onClick={() => setEditing({ client, status: s.id, postDate: todayIso(), timeLog: [] })}>+ Add post</button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderSchedule() {
    const t = todayIso(), wk = addDays(t, 7);
    const open = list.filter((p) => !isDone(p));
    const groups: [string, string, Post[]][] = ([
      ["Overdue", "over", open.filter((p) => deadline(p) && deadline(p) < t)],
      ["Today", "soon", open.filter((p) => deadline(p) === t)],
      ["Next 7 days", "", open.filter((p) => deadline(p) > t && deadline(p) <= wk)],
      ["Later", "", open.filter((p) => deadline(p) > wk)],
      ["No date", "", open.filter((p) => !deadline(p))],
    ] as [string, string, Post[]][]).filter((g) => g[2].length);
    if (!groups.length) return <div className="adm-panel"><div className="adm-empty">Nothing open here. Every post in this view is posted.</div></div>;
    return (
      <div className="sm-sched">
        {groups.map(([name, cls, items]) => (
          <section key={name}>
            <h3 className={"sm-gh " + cls}>{name} <span>{items.length}</span></h3>
            <div className="adm-panel sm-scroll">
              <table className="adm-table">
                <thead><tr>
                  <th>Goes live</th><th>Work due</th>{!client && <th>Client</th>}<th>Post</th><th>Stage</th><th>Assigned</th><th>Deadline</th><th>Time</th><th />
                </tr></thead>
                <tbody>
                  {items.map((p) => {
                    const st = STAGES.find((s) => s.id === p.status)!;
                    return (
                      <tr key={p.id}>
                        <td className="sm-nowrap">{fmtDay(p.postDate)}<br /><span className="sm-muted">{fmtTime(p.postTime) || "—"}</span></td>
                        <td className="sm-nowrap">{p.dueDate ? fmtDay(p.dueDate) : <span className="sm-muted">—</span>}</td>
                        {!client && <td><span className="sm-cpill" style={{ ["--cc" as string]: clientColor(p.client) } as React.CSSProperties}>{p.client}</span></td>}
                        <td><button className="sm-link" onClick={() => setViewId(p.id)}>{p.theme}</button>{p.format && <div className="sm-muted">{p.format}</div>}</td>
                        <td><span className="sm-stage" style={{ ["--sc" as string]: st.color } as React.CSSProperties}>{st.title}</span></td>
                        <td>{userById(p.assigneeId)?.name || <span className="sm-muted">Unassigned</span>}</td>
                        <td>{dueChip(p)}</td>
                        <td className={"sm-nowrap sm-time" + (p.timerStart ? " run" : "")}>{timerText(p)}</td>
                        <td><button className={"adm-btn ghost sm-timerbtn" + (p.timerStart ? " run" : "")} onClick={() => toggleTimer(p)}>{p.timerStart ? "Stop" : "Start"}</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    );
  }

  function renderCalendar() {
    const cm = month || calMonth || (list.find((p) => !isDone(p) && (p.postDate || "") >= todayIso())?.postDate || list[list.length - 1]?.postDate || todayIso()).slice(0, 7);
    const [y, mo] = cm.split("-").map(Number);
    const first = new Date(y, mo - 1, 1);
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const byDay: Record<string, Post[]> = {};
    for (const p of list) if (p.postDate) (byDay[p.postDate] ||= []).push(p);
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (i >= 35 && d.getMonth() !== mo - 1) break; cells.push(d); }
    const shift = (n: number) => { setMonth(""); setCalMonth(iso(new Date(y, mo - 1 + n, 1)).slice(0, 7)); };
    const t = todayIso();
    return (
      <>
        <div className="sm-calhead">
          <button className="adm-btn ghost" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
          <h3>{MONTHS[mo - 1]} {y}</h3>
          <button className="adm-btn ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
          <button className="adm-btn ghost" onClick={() => { setMonth(""); setCalMonth(t.slice(0, 7)); }}>This month</button>
          <span className="sm-legend">{STAGES.map((s) => <span key={s.id}><i style={{ background: s.color }} />{s.title}</span>)}</span>
        </div>
        <div className="sm-scroll">
          <div className="sm-cal">
            {DOW.map((d) => <div key={d} className="sm-dow">{d}</div>)}
            {cells.map((d) => {
              const ds = iso(d), inMonth = d.getMonth() === mo - 1;
              return (
                <div key={ds} className={"sm-day" + (inMonth ? "" : " out") + (ds === t ? " today" : "")}>
                  <div className="sm-num"><b>{d.getDate()}</b>
                    {inMonth && <button onClick={() => setEditing({ client, status: "planned", postDate: ds, timeLog: [] })} aria-label={`Add post on ${ds}`}>+</button>}
                  </div>
                  {(byDay[ds] || []).map((p) => (
                    <button key={p.id} className="sm-ev" style={{ ["--sc" as string]: STAGES.find((s) => s.id === p.status)!.color } as React.CSSProperties}
                      title={`${p.client} · ${p.theme}`} onClick={() => setViewId(p.id)}>
                      {p.postTime && <b>{fmtTime(p.postTime)} </b>}{p.theme}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  /* Read-only details card — what a team member sees when they open a post. */
  function renderDetails(p: Post) {
    const st = STAGES.find((s) => s.id === p.status)!;
    const assignee = userById(p.assigneeId);
    const urls = (t?: string) => (t || "").match(/https?:\/\/[^\s]+/g) || [];
    const linkChips = (t?: string) => urls(t).map((u) => (
      <a key={u} className="sm-vlink" href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^https?:\/\/(www\.)?/, "").split(/[/?#]/)[0]} ↗</a>
    ));
    const section = (label: string, body?: React.ReactNode) => (body ? <div className="sm-vsec"><h4>{label}</h4>{body}</div> : null);
    const text = (v?: string | null) => (v && v.trim() ? <p className="sm-pre">{v.trim()}</p> : null);
    const copyCaption = async () => {
      try { await navigator.clipboard.writeText(p.caption || ""); toast("Caption copied"); }
      catch { toast("Couldn't copy — select the text instead", "err"); }
    };
    return (
      <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewId(null); }}>
        <div className="adm-drawer kb-drawer sm-view" role="dialog" aria-modal="true" aria-label={p.theme}>
          <div className="sm-vtop">
            <span className="sm-cpill" style={{ ["--cc" as string]: clientColor(p.client) } as React.CSSProperties}>{p.client}</span>
            <span className="sm-stage" style={{ ["--sc" as string]: st.color } as React.CSSProperties}>{st.title}</span>
            {p.format && <span className="sm-fmt" style={{ ["--fc" as string]: formatColor(p.format) } as React.CSSProperties}>{p.format}</span>}
            <button type="button" className="sm-x" onClick={() => setViewId(null)} aria-label="Close">×</button>
          </div>
          <h2>{p.theme}</h2>
          {p.festive && <div className="sm-fest">🎉 {p.festive}</div>}
          {p.topic && <p className="sm-vlead">{p.topic}</p>}

          <div className="sm-vgrid">
            <div><span>Goes live</span><b>{fmtDay(p.postDate)}{p.postTime && ` · ${fmtTime(p.postTime)}`}</b></div>
            <div><span>Work due</span><b>{p.dueDate ? fmtDay(p.dueDate) : "—"}</b>{dueChip(p)}</div>
            <div><span>Assigned to</span><b className="sm-who">{assignee ? <><Avatar user={assignee} size={22} />{assignee.name}</> : "Unassigned"}</b></div>
            <div><span>Move to stage</span>
              <Select value={p.status} onChange={(v) => moveTo(p.id, v as Stage)} ariaLabel="Move to stage" options={STAGES.map((s) => ({ value: s.id, label: s.title }))} /></div>
            <div><span>Estimated time</span><b>{p.estimateHours ? `${p.estimateHours}h` : "—"}</b></div>
            <div><span>Client contact</span><b>{p.poc || "—"}</b></div>
          </div>

          <div className="sm-flags sm-vflags">
            <span className={p.caption ? "on" : ""}>{p.caption ? "✓" : "○"} Caption</span>
            <span className={p.driveLink ? "on" : ""}>{p.driveLink ? "✓" : "○"} Creative</span>
            <span className={p.channels ? "on" : ""}>{p.channels ? "✓" : "○"} Live</span>
          </div>

          {section("Caption & hashtags", p.caption && <>
            {text(p.caption)}
            <button type="button" className="adm-btn ghost sm-timerbtn" onClick={copyCaption}>Copy caption</button>
          </>)}
          {section("Creative (Drive)", urls(p.driveLink).length > 0 && <div className="sm-vlinks">{linkChips(p.driveLink)}</div>)}
          {section("Live links", urls(p.channels).length > 0 && <div className="sm-vlinks">{linkChips(p.channels)}</div>)}
          {section("Client requirements", text(p.requirements))}
          {section("Data status", text(p.dataStatus))}
          {section("Reference", urls(p.reference).length > 0 ? <div className="sm-vlinks">{linkChips(p.reference)}</div> : text(p.reference))}
          {section("People to tag", text(p.tags))}
          {section("Keywords", text(p.keywords))}
          {section("Remarks", text(p.remarks))}

          {renderTime(p)}

          <div className="adm-drawer-actions">
            <button type="button" className="adm-btn primary" onClick={() => { setEditing({ ...p }); setViewId(null); }}>Edit post</button>
            <button type="button" className="adm-btn ghost" onClick={() => setViewId(null)}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  /* Time tracking — shown on the details card and in the editor. */
  function renderTime(p: Post) {
    return (
      <>
                <h3 className="sm-sec">Time spent <span className={"sm-time" + (p.timerStart ? " run" : "")}>{timerText(p)}</span>
                  <button type="button" className={"adm-btn ghost sm-timerbtn" + (p.timerStart ? " run" : "")} onClick={() => toggleTimer(p)}>
                    {p.timerStart ? "Stop timer" : "Start timer"}
                  </button>
                </h3>
                {p.timerStart && <p className="adm-hint">Running since {new Date(p.timerStart).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}{userById(p.timerBy) ? ` · ${userById(p.timerBy)!.name}` : ""}</p>}
                <div className="sm-logadd">
                  <input type="number" min={1} step={5} value={logMin} onChange={(e) => setLogMin(e.target.value)} placeholder="Minutes" aria-label="Minutes worked" />
                  <input value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder="What was done (reel edit, caption…)" aria-label="Work note"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); logManual(p); } }} />
                  <button type="button" className="adm-btn ghost" onClick={() => logManual(p)}>Log</button>
                </div>
                <div className="sm-log">
                  {toArr<LogEntry>(p.timeLog).slice().reverse().map((e) => (
                    <div key={e.id} className="sm-logrow">
                      <b>{hm(e.minutes)}</b>
                      <span className="note">{e.note || "Work session"}</span>
                      <span className="sm-muted">{[userById(e.userId)?.name, new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })].filter(Boolean).join(" · ")}</span>
                      <button type="button" onClick={() => removeLog(p, e.id)} aria-label="Remove entry">×</button>
                    </div>
                  ))}
                  {!toArr(p.timeLog).length && <span className="adm-hint">No time logged yet. Start the timer while you work, or log minutes by hand.</span>}
                </div>
              </>
    );
  }

  if (loading) return (
    <>
      <div className="adm-top"><div><h1>Social media calendar</h1><p>Loading posts…</p></div></div>
      <BoardSkeleton cols={5} />
    </>
  );

  const t = todayIso(), wk = addDays(t, 7);
  const openList = list.filter((p) => !isDone(p));
  const summary: [string, string | number, string][] = [
    ["Posts", list.length, ""],
    ["Posted", list.filter(isDone).length, "ok"],
    ["Overdue", openList.filter((p) => deadline(p) && deadline(p) < t).length, "over"],
    ["Due next 7 days", openList.filter((p) => deadline(p) >= t && deadline(p) <= wk).length, "soon"],
    ["Time logged", hm(list.reduce((a, p) => a + loggedMin(p), 0)), ""],
    ["Time planned", `${list.reduce((a, p) => a + (Number(p.estimateHours) || 0), 0)}h`, ""],
  ];
  const live = editing?.id ? posts.find((p) => p.id === editing.id) : undefined;
  const viewed = viewId != null ? posts.find((p) => p.id === viewId) : undefined;
  const set = (patch: Partial<Post>) => setEditing((e) => ({ ...e, ...patch }));
  const txt = (k: keyof Post) => String(editing?.[k] ?? "");

  return (
    <>
      <div className="adm-top">
        <div>
          <h1>Social media calendar</h1>
          <p>{limited
            ? "Your assigned posts — when you move one to the next stage it passes to the next person."
            : "Every client’s posts from plan to live link, with post times, deadlines, owners and time spent."}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { importCsv(e.target.files?.[0]); e.currentTarget.value = ""; }} />
          <button className="adm-btn ghost" onClick={() => fileRef.current?.click()}>Import sheet (CSV)</button>
          {!limited && <button className="adm-btn ghost" onClick={addClient}>+ Client</button>}
          <button className="adm-btn primary" onClick={() => setEditing({ client, status: "planned", postDate: todayIso(), timeLog: [] })}>+ Post</button>
        </div>
      </div>

      <div className="sm-clients" role="tablist" aria-label="Clients">
        {[{ name: "", label: "All clients" }, ...clientNames.map((n) => ({ name: n, label: n }))].map(({ name, label }) => {
          const items = posts.filter((p) => !name || p.client === name);
          const late = items.filter((p) => (dueInfo(p)?.days ?? 0) < 0).length;
          return (
            <button key={name || "all"} role="tab" aria-selected={client === name} className={"sm-ctab" + (client === name ? " active" : "")}
              onClick={() => { setClient(name); setMonth(""); setCalMonth(""); }}>
              {name && <i style={{ background: clientColor(name) }} />}
              {label}<span className="n">{items.length}</span>{late > 0 && <span className="late">{late} late</span>}
            </button>
          );
        })}
      </div>

      <div className="sm-sum">
        {summary.map(([k, v, cls]) => <div key={k} className={"sm-tile " + cls}><span>{k}</span><b>{v}</b></div>)}
      </div>

      <div className="sm-bar">
        <div className="sm-seg" role="group" aria-label="View">
          {(["board", "schedule", "calendar"] as View[]).map((v) => (
            <button key={v} aria-pressed={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{v[0].toUpperCase() + v.slice(1)}</button>
          ))}
        </div>
        <div className="sm-filter"><Select value={month} onChange={(v) => { setMonth(v); setCalMonth(""); }} ariaLabel="Month"
          options={[{ value: "", label: "All months" }, ...months.map((m) => ({ value: m, label: `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}` }))]} /></div>
        <div className="sm-filter"><Select value={format} onChange={setFormat} ariaLabel="Format"
          options={[{ value: "", label: "All formats" }, ...formats.map((f) => ({ value: f, label: f }))]} /></div>
        <div className="sm-filter"><Select value={who} onChange={setWho} ariaLabel="Assigned to"
          options={[{ value: "", label: "Everyone" }, { value: "none", label: "Unassigned" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} /></div>
        <label className="adm-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
          <input placeholder="Search theme, topic, caption…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {!posts.length ? (
        <div className="adm-panel"><div className="adm-empty">{limited && !clientNames.length
          ? "No brands assigned to you yet. Ask an admin to give you access under Users → Social media brands."
          : limited ? "Nothing is assigned to you right now. New posts appear here when they reach your stage."
          : "No posts yet. Add a client and a post, or import a client’s media calendar (Excel → Save as CSV)."}</div></div>
      ) : view === "schedule" ? renderSchedule() : view === "calendar" ? renderCalendar() : renderBoard()}

      {viewed && !editing && renderDetails(viewed)}

      {editing && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="adm-drawer kb-drawer" onSubmit={savePost}>
            <h2>{editing.id ? editing.theme || "Edit post" : "New post"}</h2>
            <p className="sub">{editing.client || "Choose a client"}</p>

            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Client</label>
                {limited ? (
                  <Select value={txt("client")} onChange={(v) => set({ client: v })} ariaLabel="Client" placeholder="Choose a brand"
                    options={clientNames.map((n) => ({ value: n, label: n }))} />
                ) : (
                  <>
                    <input list="sm-clients" value={txt("client")} onChange={(e) => set({ client: e.target.value })} required placeholder="Client name" />
                    <datalist id="sm-clients">{clientNames.map((n) => <option key={n} value={n} />)}</datalist>
                  </>
                )}</div>
              <div className="adm-field" style={{ flex: 1 }}><label>Stage</label>
                <Select value={editing.status || "planned"} onChange={(v) => set({ status: v as Stage })} ariaLabel="Stage"
                  options={STAGES.map((s) => ({ value: s.id, label: s.title }))} /></div>
            </div>

            <h3 className="sm-sec">Schedule & time</h3>
            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Post date</label>
                <DatePicker value={txt("postDate").slice(0, 10)} onChange={(v) => set({ postDate: v })} placeholder="Goes live on" /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Post time</label>
                <input type="time" value={txt("postTime")} onChange={(e) => set({ postTime: e.target.value })} /></div>
            </div>
            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Work due by</label>
                <DatePicker value={txt("dueDate").slice(0, 10)} onChange={(v) => set({ dueDate: v })} placeholder="Creative deadline" /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Estimated hours</label>
                <input type="number" min={0} step={0.25} value={editing.estimateHours ?? ""} onChange={(e) => set({ estimateHours: e.target.value === "" ? null : Number(e.target.value) })} placeholder="e.g. 2" /></div>
            </div>
            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Assigned to</label>
                <Select value={editing.assigneeId ? String(editing.assigneeId) : ""} onChange={(v) => set({ assigneeId: v ? Number(v) : null })} ariaLabel="Assigned to"
                  options={[{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
                <span className="adm-hint">Set automatically when the stage changes: reels → Marketer, posts & carousels → Graphic designer, Ready to post → Social media. Pick someone here to override.</span></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Client contact</label>
                <input value={txt("poc")} onChange={(e) => set({ poc: e.target.value })} placeholder="Point of contact" /></div>
            </div>

            <h3 className="sm-sec">Content</h3>
            <div className="adm-field"><label>Post theme</label>
              <input value={txt("theme")} onChange={(e) => set({ theme: e.target.value })} required placeholder="e.g. Customer Review" /></div>
            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Format</label>
                <input list="sm-formats" value={txt("format")} onChange={(e) => set({ format: e.target.value })} placeholder="Post / Reel / Carousel" />
                <datalist id="sm-formats">{FORMATS.map((f) => <option key={f} value={f} />)}</datalist></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Day / festival</label>
                <input value={txt("festive")} onChange={(e) => set({ festive: e.target.value })} placeholder="e.g. Diwali" /></div>
            </div>
            <div className="adm-field"><label>Post topic</label>
              <textarea value={txt("topic")} onChange={(e) => set({ topic: e.target.value })} /></div>
            <div className="adm-field"><label>Client requirements</label>
              <textarea value={txt("requirements")} onChange={(e) => set({ requirements: e.target.value })} /></div>
            <div className="adm-field"><label>Data status</label>
              <input value={txt("dataStatus")} onChange={(e) => set({ dataStatus: e.target.value })} placeholder="We have / Required from client" /></div>
            <div className="adm-field"><label>Caption & hashtags</label>
              <textarea rows={6} value={txt("caption")} onChange={(e) => set({ caption: e.target.value })} /></div>
            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Post Drive link</label>
                <input value={txt("driveLink")} onChange={(e) => set({ driveLink: e.target.value })} placeholder="https://drive.google.com/…" /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Reference link</label>
                <input value={txt("reference")} onChange={(e) => set({ reference: e.target.value })} placeholder="https://" /></div>
            </div>
            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>People to tag</label>
                <input value={txt("tags")} onChange={(e) => set({ tags: e.target.value })} /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Keywords</label>
                <input value={txt("keywords")} onChange={(e) => set({ keywords: e.target.value })} /></div>
            </div>
            <div className="adm-field"><label>Channel links</label>
              <textarea value={txt("channels")} onChange={(e) => set({ channels: e.target.value })} placeholder={"Instagram https://…\nFacebook https://…"} />
              <span className="adm-hint">Adding links moves the post to Posted when you save.</span></div>
            <div className="adm-field"><label>Remarks</label>
              <textarea value={txt("remarks")} onChange={(e) => set({ remarks: e.target.value })} /></div>
            {(() => {
              const urls = [editing.driveLink, editing.reference, editing.channels].join(" ").match(/https?:\/\/[^\s]+/g) || [];
              return urls.length > 0 && (
                <div className="sm-links">{urls.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}…</a>)}</div>
              );
            })()}

            {live && renderTime(live)}

            <div className="adm-drawer-actions">
              <button className="adm-btn primary" type="submit">Save</button>
              <button className="adm-btn ghost" type="button" onClick={() => { if (editing.id) setViewId(editing.id); setEditing(null); }}>Cancel</button>
              {editing.id && <button className="adm-btn ghost" type="button" onClick={deletePost} style={{ marginLeft: "auto" }}>Delete</button>}
            </div>
          </form>
        </div>
      )}
    </>
  );
}
