"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";

/* A team member's own content-calendar work (marketer / video / graphic /
   social): used by the dashboard home to put "my work" first. One request:
   light card fields of the posts assigned to me. */

export type Post = {
  id: number; client: string; status: string; theme: string; format?: string;
  postDate?: string | null; postTime?: string | null; dueDate?: string | null;
  assigneeId?: number | null;
};

const STAGE: Record<string, string> = { planned: "Planned", client: "Need from client", production: "In production", approval: "Pending approval", ready: "Ready to post", posted: "Posted" };
/* India date (YYYY-MM-DD). */
export const istIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const day = (s?: string | null) => (s ? String(s).slice(0, 10) : "");
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diff = (a: string, b: string) => Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 864e5);
const fmt = (s: string, o: Intl.DateTimeFormatOptions) => new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });

function due(p: Post, t: string) {
  const live = day(p.postDate), start = day(p.dueDate) || (live ? addDays(live, -7) : "");
  if (live && live < t) return { cls: "red", text: `Overdue ${diff(live, t)}d`, rank: -1000 + diff(t, live) };
  if (start && start > t) { const d = diff(t, start); return { cls: d <= 2 ? "amber" : "grey", text: `Starts in ${d}d`, rank: 100 + d }; }
  if (!live) return { cls: "grey", text: "No date", rank: 999 };
  const d = diff(t, live);
  return { cls: d <= 3 ? "amber" : "blue", text: d === 0 ? "Goes live today" : `Goes live in ${d}d`, rank: d };
}

export type MyWorkData = ReturnType<typeof summarise>;
function summarise(posts: Post[]) {
  const t = istIso();
  const weekEnd = addDays(t, 7);
  const open = posts.filter((p) => p.status !== "posted");
  const queue = open.map((p) => ({ p, d: due(p, t) })).sort((a, b) => a.d.rank - b.d.rank);
  return {
    open: open.length,
    brands: new Set(open.map((p) => p.client)).size,
    overdue: queue.filter((x) => x.d.cls === "red").length,
    workNow: open.filter((p) => { const live = day(p.postDate), start = day(p.dueDate) || (live ? addDays(live, -7) : ""); return start && start <= t && (!live || live >= t); }).length,
    startingSoon: open.filter((p) => { const s = day(p.dueDate); return s > t && s <= weekEnd; }).length,
    goingLive: open.filter((p) => { const l = day(p.postDate); return l >= t && l <= weekEnd; }).length,
    queue,
  };
}

/** My assigned posts (card fields) → queue + counts. `meId` null = not known yet. */
export function useMyWork(meId: number | null | undefined, enabled: boolean) {
  const [data, setData] = useState<MyWorkData | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!enabled || meId == null) return;
    setError("");
    try {
      const p = await api.listSocialPosts({ fields: "card", mine: "1" });
      setData(summarise((Array.isArray(p) ? p : []).filter((x: Post) => x.assigneeId === meId)));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your work"); }
  }, [meId, enabled]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}

/* "My queue" rows (most urgent first). */
export function MyQueue({ data, limit = 7 }: { data: MyWorkData; limit?: number }) {
  if (!data.queue.length) {
    return <div className="sh-empty"><b>All clear</b><span>New posts for your brands will show up here when they reach your stage.</span></div>;
  }
  return (
    <div className="td-queue">
      {data.queue.slice(0, limit).map(({ p, d }) => (
        <Link key={p.id} href={`/dashboard/social?post=${p.id}`} className="td-qrow">
          <span className="td-qmain">
            <b>{p.theme}</b>
            <small>{[p.client, p.format, p.postDate ? `Live ${fmt(day(p.postDate), { day: "numeric", month: "short" })}${p.postTime ? `, ${p.postTime}` : ""}` : ""].filter(Boolean).join(" · ")}</small>
          </span>
          <span className="sh-pill grey td-qstage">{STAGE[p.status] || p.status}</span>
          <span className={"sh-pill " + d.cls}>{d.text}</span>
        </Link>
      ))}
    </div>
  );
}
