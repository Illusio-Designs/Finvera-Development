"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { DashSkeleton } from "@/components/admin/Skeleton";
import MyWork from "@/components/admin/MyWork";
import SocialKpis from "@/components/admin/SocialKpis";
import { rolesCan, userRoles } from "@/lib/permissions";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, FolderLibraryIcon, News01Icon } from "@hugeicons/core-free-icons";

const RESOURCES: [string, string, string][] = [
  ["projects", "Projects", "/dashboard/projects"],
  ["services", "Services", "/dashboard/services"],
  ["testimonials", "Testimonials", "/dashboard/testimonials"],
  ["team", "Team", "/dashboard/team"],
  ["blog", "Blog posts", "/dashboard/blog"],
];

type Msg = { id: number; name: string; email: string; projectType?: string; createdAt: string; isRead: boolean };
type Lead = { id: number; stage: string; value?: number };
const OPEN_STAGES = ["new", "contacted", "qualified", "proposal"];

export default function Dashboard() {
  const [roles, setRoles] = useState<string[] | null>(null);
  useEffect(() => { api.me().then((r) => setRoles(userRoles(r?.user ?? r))).catch(() => setRoles([])); }, []);
  if (roles === null) return <DashSkeleton />;
  if (roles.length && !rolesCan(roles, "content") && rolesCan(roles, "social")) return <MyWork />;
  return <Overview admin={roles.includes("admin")} />;
}

function Overview({ admin }: { admin: boolean }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [msgs, setMsgs] = useState<Msg[]>([]);     // newest 6
  const [msgTotal, setMsgTotal] = useState(0);
  const [inbox, setInbox] = useState(0);           // unread
  const [stages, setStages] = useState<Record<string, { count: number; value: number }>>({});
  const [leadTotal, setLeadTotal] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // One small call with just the numbers this page shows.
        const o = await api.overview();
        setCounts(o.counts || {});
        if (o.contact) { setMsgs(o.contact.recent || []); setMsgTotal(o.contact.total); setInbox(o.contact.unread); }
        if (o.leads) { setStages(o.leads.byStage || {}); setLeadTotal(o.leads.total); }
      } catch (e) {
        if ((e as { status?: number })?.status !== 404) { setReady(true); return; }
        // Older backend without /overview: count from the full lists, side by side.
        const c: Record<string, number> = {};
        const [, m, l] = await Promise.all([
          Promise.all(RESOURCES.map(async ([r]) => { try { c[r] = (await api.list(r)).length; } catch { c[r] = 0; } })),
          api.listContact().catch(() => [] as Msg[]),
          api.list("leads").catch(() => [] as Lead[]),
        ]);
        setCounts(c);
        const ms: Msg[] = Array.isArray(m) ? m : [];
        setMsgs(ms.slice(0, 6)); setMsgTotal(ms.length); setInbox(ms.filter((x) => !x.isRead).length);
        const by: Record<string, { count: number; value: number }> = {};
        for (const x of (Array.isArray(l) ? l : []) as Lead[]) { const s = (by[x.stage] ||= { count: 0, value: 0 }); s.count++; s.value += Number(x.value) || 0; }
        setStages(by); setLeadTotal(Array.isArray(l) ? l.length : 0);
      }
      setReady(true);
    })();
  }, []);

  // Lead KPIs
  const stageCount = (st: string) => stages[st]?.count || 0;
  const stageValue = (st: string) => stages[st]?.value || 0;
  const openPipeline = OPEN_STAGES.reduce((s, st) => s + stageValue(st), 0);
  const openCount = OPEN_STAGES.reduce((s, st) => s + stageCount(st), 0);
  const wonCount = stageCount("won");
  const lostCount = stageCount("lost");
  const decided = wonCount + lostCount;
  const winRate = decided ? Math.round((wonCount / decided) * 100) : 0;
  const inr = (n: number) => (n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`);
  const totalContent = RESOURCES.reduce((s, [r]) => s + (counts[r] || 0), 0);
  const maxCount = Math.max(1, ...RESOURCES.map(([r]) => counts[r] || 0));
  const fmt = (d: string) => { try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return ""; } };

  return (
    <>
      <div className="adm-top">
        <div><h1>Overview</h1><p>Here&apos;s the summary of your site content and activity.</p></div>
      </div>

      {!ready ? <DashSkeleton /> : (
      <>
      {/* Top stat cards */}
      <div className="dash-stats">
        <Link href="/dashboard/contact" className="dash-stat primary">
          <div className="dash-stat-head">
            <span className="dash-ic"><HugeiconsIcon icon={Mail01Icon} size={20} strokeWidth={1.8} className="hgi" /></span>
            <div><b>Messages</b><small>Contact inbox</small></div>
          </div>
          <div className="dash-val">{msgTotal}</div>
          <div className="dash-foot"><span className="dash-chip">{inbox} unread</span><span className="dash-more">See details →</span></div>
        </Link>

        <Link href="/dashboard/projects" className="dash-stat">
          <div className="dash-stat-head">
            <span className="dash-ic"><HugeiconsIcon icon={FolderLibraryIcon} size={20} strokeWidth={1.8} className="hgi" /></span>
            <div><b>Projects</b><small>Portfolio work</small></div>
          </div>
          <div className="dash-val">{counts.projects ?? 0}</div>
          <div className="dash-foot"><span className="dash-more">Manage →</span></div>
        </Link>

        <Link href="/dashboard/blog" className="dash-stat">
          <div className="dash-stat-head">
            <span className="dash-ic"><HugeiconsIcon icon={News01Icon} size={20} strokeWidth={1.8} className="hgi" /></span>
            <div><b>Blog posts</b><small>Articles</small></div>
          </div>
          <div className="dash-val">{counts.blog ?? 0}</div>
          <div className="dash-foot"><span className="dash-more">Write →</span></div>
        </Link>
      </div>

      {/* Chart + recent activity */}
      <div className="dash-split">
        <div className="dash-panel">
          <div className="dash-panel-head"><h3>Content breakdown</h3><span className="dash-chip soft">{totalContent} items</span></div>
          <div className="dash-bars">
            {RESOURCES.map(([r, label, href]) => (
              <Link href={href} key={r} className="dash-bar-row">
                <span className="dash-bar-label">{label}</span>
                <span className="dash-bar-track"><span className="dash-bar-fill" style={{ width: `${((counts[r] || 0) / maxCount) * 100}%` }} /></span>
                <span className="dash-bar-val">{counts[r] ?? 0}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head"><h3>Recent messages</h3><Link href="/dashboard/contact" className="dash-chip soft">View all</Link></div>
          {msgs.length === 0 ? (
            <div className="adm-empty">No messages yet.</div>
          ) : (
            <table className="adm-table dash-activity">
              <tbody>
                {msgs.map((m) => (
                  <tr key={m.id}>
                    <td><span className="dash-av">{m.name.slice(0, 2).toUpperCase()}</span></td>
                    <td><b>{m.name}</b><small>{m.email}</small></td>
                    <td className="dash-date">{fmt(m.createdAt)}</td>
                    <td><span className={"adm-badge " + (m.isRead ? "published" : "draft")}>{m.isRead ? "Read" : "New"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </>
      )}

      {ready && leadTotal > 0 && (
        <div className="adm-panel" style={{ padding: 22, marginBottom: 18 }}>
          <div className="dash-panel-head" style={{ marginBottom: 16 }}>
            <h3>Leads pipeline</h3>
            <Link href="/dashboard/leads" className="dash-chip soft">Open leads →</Link>
          </div>
          <div className="lead-kpis">
            <div className="lead-kpi"><span className="lk-label">Open pipeline</span><b className="lk-val">{inr(openPipeline)}</b><span className="lk-sub">{openCount} active leads</span></div>
            <div className="lead-kpi"><span className="lk-label">Won</span><b className="lk-val">{wonCount}</b><span className="lk-sub">{inr(stageValue("won"))} closed</span></div>
            <div className="lead-kpi"><span className="lk-label">Win rate</span><b className="lk-val">{winRate}%</b><span className="lk-sub">{wonCount} won · {lostCount} lost</span></div>
            <div className="lead-kpi"><span className="lk-label">Total leads</span><b className="lk-val">{leadTotal}</b><span className="lk-sub">across all stages</span></div>
          </div>
          <div className="lead-stagebar">
            {["new", "contacted", "qualified", "proposal", "won", "lost"].map((st) => (
              <span key={st} className={"adm-badge " + st}>{st} {stageCount(st)}</span>
            ))}
          </div>
        </div>
      )}

      {admin && <SocialKpis mode="team" />}

      <div className="adm-panel" style={{ padding: 22 }}>
        <h3 style={{ marginBottom: 12 }}>Quick actions</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/dashboard/projects" className="adm-btn primary">Add a project</Link>
          <Link href="/dashboard/blog" className="adm-btn ghost">Write a blog post</Link>
          <Link href="/dashboard/kanban" className="adm-btn ghost">Open boards</Link>
          <Link href="/dashboard/settings" className="adm-btn ghost">Analytics &amp; pixels</Link>
        </div>
      </div>
    </>
  );
}
