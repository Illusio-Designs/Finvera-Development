"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import BackendStatus from "@/components/admin/BackendStatus";

const RESOURCES: [string, string, string][] = [
  ["projects", "Projects", "/dashboard/projects"],
  ["services", "Services", "/dashboard/services"],
  ["testimonials", "Testimonials", "/dashboard/testimonials"],
  ["team", "Team", "/dashboard/team"],
  ["blog", "Blog posts", "/dashboard/blog"],
];

const Ic = ({ d }: { d: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);

type Msg = { id: number; name: string; email: string; projectType?: string; createdAt: string; isRead: boolean };

export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const c: Record<string, number> = {};
      await Promise.all(RESOURCES.map(async ([r]) => { try { c[r] = (await api.list(r)).length; } catch { c[r] = 0; } }));
      setCounts(c);
      try { setMsgs(await api.listContact()); } catch { /* */ }
      setReady(true);
    })();
  }, []);

  const inbox = msgs.filter((m) => !m.isRead).length;
  const totalContent = RESOURCES.reduce((s, [r]) => s + (counts[r] || 0), 0);
  const maxCount = Math.max(1, ...RESOURCES.map(([r]) => counts[r] || 0));
  const fmt = (d: string) => { try { return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }); } catch { return ""; } };

  return (
    <>
      <div className="adm-top">
        <div><h1>Overview</h1><p>Here&apos;s the summary of your site content and activity.</p></div>
        <Link href="/" className="adm-btn ghost">View site ↗</Link>
      </div>

      <BackendStatus variant="card" />

      {/* Top stat cards */}
      <div className="dash-stats">
        <Link href="/dashboard/contact" className="dash-stat primary">
          <div className="dash-stat-head">
            <span className="dash-ic"><Ic d={<><path d="M4 4h16v12H5.2L4 17.5z" /><path d="M8 9h8M8 12h5" /></>} /></span>
            <div><b>Messages</b><small>Contact inbox</small></div>
          </div>
          <div className="dash-val">{ready ? msgs.length : "—"}</div>
          <div className="dash-foot"><span className="dash-chip">{inbox} unread</span><span className="dash-more">See details →</span></div>
        </Link>

        <Link href="/dashboard/projects" className="dash-stat">
          <div className="dash-stat-head">
            <span className="dash-ic"><Ic d={<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>} /></span>
            <div><b>Projects</b><small>Portfolio work</small></div>
          </div>
          <div className="dash-val">{ready ? (counts.projects ?? 0) : "—"}</div>
          <div className="dash-foot"><span className="dash-more">Manage →</span></div>
        </Link>

        <Link href="/dashboard/blog" className="dash-stat">
          <div className="dash-stat-head">
            <span className="dash-ic"><Ic d={<><path d="M4 4h16v16H4z" /><path d="M8 8h8M8 12h8M8 16h5" /></>} /></span>
            <div><b>Blog posts</b><small>Articles</small></div>
          </div>
          <div className="dash-val">{ready ? (counts.blog ?? 0) : "—"}</div>
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
                <span className="dash-bar-val">{ready ? (counts[r] ?? 0) : "—"}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="dash-panel">
          <div className="dash-panel-head"><h3>Recent messages</h3><Link href="/dashboard/contact" className="dash-chip soft">View all</Link></div>
          {!ready ? (
            <div className="adm-empty">Loading…</div>
          ) : msgs.length === 0 ? (
            <div className="adm-empty">No messages yet.</div>
          ) : (
            <table className="adm-table dash-activity">
              <tbody>
                {msgs.slice(0, 6).map((m) => (
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
