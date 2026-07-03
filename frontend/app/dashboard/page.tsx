"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import BackendStatus from "@/components/admin/BackendStatus";

const RESOURCES = [
  ["projects", "Projects", "/dashboard/projects"],
  ["services", "Services", "/dashboard/services"],
  ["testimonials", "Testimonials", "/dashboard/testimonials"],
  ["team", "Team", "/dashboard/team"],
  ["blog", "Blog posts", "/dashboard/blog"],
];

export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [inbox, setInbox] = useState(0);

  useEffect(() => {
    (async () => {
      const c: Record<string, number> = {};
      await Promise.all(RESOURCES.map(async ([r]) => { try { c[r] = (await api.list(r)).length; } catch { c[r] = 0; } }));
      setCounts(c);
      try { setInbox((await api.listContact()).filter((m: any) => !m.isRead).length); } catch { /* */ }
    })();
  }, []);

  return (
    <>
      <div className="adm-top">
        <div><h1>Dashboard</h1><p>Welcome back — here&apos;s what&apos;s on your site.</p></div>
        <Link href="/" className="adm-btn ghost">View site ↗</Link>
      </div>

      <BackendStatus variant="card" />

      <div className="adm-cards">
        {RESOURCES.map(([r, label]) => (
          <Link key={r} href={`/admin/${r}`} className="adm-stat">
            <b>{counts[r] ?? "—"}</b><span>{label}</span>
          </Link>
        ))}
        <Link href="/dashboard/contact" className="adm-stat">
          <b>{inbox || 0}</b><span>Unread messages</span>
        </Link>
      </div>

      <div className="adm-panel" style={{ padding: 22 }}>
        <h3 style={{ marginBottom: 12 }}>Quick actions</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link href="/dashboard/projects" className="adm-btn primary">Add a project</Link>
          <Link href="/dashboard/blog" className="adm-btn ghost">Write a blog post</Link>
          <Link href="/dashboard/seo" className="adm-btn ghost">Edit SEO</Link>
          <Link href="/dashboard/settings" className="adm-btn ghost">Analytics &amp; pixels</Link>
        </div>
      </div>
    </>
  );
}
