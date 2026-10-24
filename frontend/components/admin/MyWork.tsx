"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { DashSkeleton } from "@/components/admin/Skeleton";

/* Personal home for team members (marketer / video / graphic / social):
   only their own content-calendar work, not the site-wide admin stats. */

type LogEntry = { userId?: number | null; minutes: number; at: string };
type Post = {
  id: number; client: string; status: string; theme: string; format?: string;
  postDate?: string | null; postTime?: string | null; dueDate?: string | null;
  assigneeId?: number | null; timeLog?: LogEntry[] | string | null;
};

const STAGE: Record<string, string> = { planned: "Planned", client: "Need from client", production: "In production", ready: "Ready to post", posted: "Posted" };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const day = (s?: string | null) => (s ? String(s).slice(0, 10) : "");
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const diff = (a: string, b: string) => Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 864e5);
const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", o);
const logs = (p: Post): LogEntry[] => {
  const v = typeof p.timeLog === "string" ? (() => { try { return JSON.parse(p.timeLog as string); } catch { return []; } })() : p.timeLog;
  return Array.isArray(v) ? v : [];
};

function due(p: Post, t: string) {
  const live = day(p.postDate), start = day(p.dueDate) || (live ? addDays(live, -7) : "");
  if (live && live < t) return { cls: "over", text: `Overdue ${diff(live, t)}d`, rank: -1000 + diff(t, live) };
  if (start && start > t) { const d = diff(t, start); return { cls: d <= 2 ? "soon" : "wait", text: `Starts in ${d}d`, rank: 100 + d }; }
  if (!live) return { cls: "wait", text: "No date", rank: 999 };
  const d = diff(t, live);
  return { cls: d <= 3 ? "soon" : "live", text: d === 0 ? "Goes live today" : `Goes live in ${d}d`, rank: d };
}

export default function MyWork() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [me, setMe] = useState<{ id?: number; name?: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, p] = await Promise.all([api.me().catch(() => null), api.list("social-posts").catch(() => [])]);
        const u = m?.user ?? m;
        setMe(u);
        setPosts((Array.isArray(p) ? p : []).filter((x: Post) => x.assigneeId === u?.id));
      } finally { setReady(true); }
    })();
  }, []);

  if (!ready) return <DashSkeleton />;

  const t = iso(new Date());
  const weekEnd = addDays(t, 7);
  const open = posts.filter((p) => p.status !== "posted");
  const withDue = open.map((p) => ({ p, d: due(p, t) })).sort((a, b) => a.d.rank - b.d.rank);
  const overdue = withDue.filter((x) => x.d.cls === "over").length;
  const workNow = open.filter((p) => { const live = day(p.postDate), start = day(p.dueDate) || (live ? addDays(live, -7) : ""); return start && start <= t && (!live || live >= t); }).length;
  const startingSoon = open.filter((p) => { const s = day(p.dueDate); return s > t && s <= weekEnd; }).length;
  const monday = addDays(t, -((new Date().getDay() + 6) % 7));
  const minutes = posts.flatMap(logs).filter((e) => e.userId === me?.id && day(e.at) >= monday).reduce((s, e) => s + (Number(e.minutes) || 0), 0);
  const hours = minutes ? `${Math.round((minutes / 60) * 10) / 10}h` : "0h";
  const brands = new Set(open.map((p) => p.client)).size;

  const week = open.flatMap((p) => {
    const ev: { date: string; text: string }[] = [];
    const s = day(p.dueDate), live = day(p.postDate);
    if (s >= t && s <= weekEnd) ev.push({ date: s, text: `Start “${p.theme}” · ${p.client}` });
    if (live >= t && live <= weekEnd) ev.push({ date: live, text: `“${p.theme}” goes live${p.postTime ? ` at ${p.postTime}` : ""}` });
    return ev;
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);

  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (me?.name || "").split(/\s+/)[0];

  return (
    <div className="mw">
      <div className="adm-top">
        <div>
          <h1>{hello}{first ? `, ${first}` : ""}</h1>
          <p>{open.length ? `You have ${open.length} post${open.length === 1 ? "" : "s"} on your plate across ${brands} brand${brands === 1 ? "" : "s"}.` : "Nothing is assigned to you right now."}</p>
        </div>
        <Link href="/dashboard/social" className="adm-btn primary">Open content calendar</Link>
      </div>

      <div className="mw-kpis">
        <div className="mw-kpi"><span>Overdue</span><b className={overdue ? "over" : ""}>{overdue}</b><small>Go-live date passed</small></div>
        <div className="mw-kpi"><span>Work on now</span><b className="now">{workNow}</b><small>Inside the 7-day window</small></div>
        <div className="mw-kpi"><span>Starting this week</span><b>{startingSoon}</b><small>Start date in the next 7 days</small></div>
        <div className="mw-kpi"><span>Hours logged</span><b>{hours}</b><small>This week</small></div>
      </div>

      <div className="mw-grid">
        <section className="mw-card">
          <div className="mw-head"><h2>My queue</h2><Link href="/dashboard/social">Open calendar</Link></div>
          {withDue.length === 0 ? <p className="mw-empty">All clear. New posts for your brands will show up here when they reach your stage.</p> : withDue.slice(0, 8).map(({ p, d }) => (
            <Link key={p.id} href="/dashboard/social" className="mw-row">
              <span className="mw-main">
                <b>{p.theme}</b>
                <small>{[p.client, p.format, p.postDate ? `Live ${fmt(day(p.postDate), { day: "numeric", month: "short" })}${p.postTime ? `, ${p.postTime}` : ""}` : ""].filter(Boolean).join(" · ")}</small>
              </span>
              <span className="mw-stage">{STAGE[p.status] || p.status}</span>
              <span className={"mw-due " + d.cls}>{d.text}</span>
            </Link>
          ))}
        </section>
        <section className="mw-card">
          <div className="mw-head"><h2>This week</h2></div>
          {week.length === 0 ? <p className="mw-empty">No start or go-live dates in the next 7 days.</p> : week.map((e, i) => (
            <div key={i} className="mw-day">
              <span className="mw-date"><small>{fmt(e.date, { weekday: "short" }).toUpperCase()}</small><b>{fmt(e.date, { day: "numeric" })}</b></span>
              <span>{e.text}</span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
