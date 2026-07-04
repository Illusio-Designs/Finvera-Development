"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { getToken, clearToken, api } from "@/lib/adminApi";
import BackendStatus from "@/components/admin/BackendStatus";
import UserMenu, { type Me } from "@/components/admin/UserMenu";
import Toaster from "@/components/admin/Toaster";
import DialogHost from "@/components/admin/DialogHost";

const NAV: [string, string, React.ReactNode][] = [
  ["/dashboard", "Dashboard", <path key="a" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />],
  ["/dashboard/projects", "Projects", <><rect key="a" x="3" y="3" width="18" height="18" rx="3" /><path key="b" d="M3 9h18" /></>],
  ["/dashboard/services", "Services", <><rect key="a" x="3" y="3" width="7" height="7" rx="1" /><rect key="b" x="14" y="3" width="7" height="7" rx="1" /><rect key="c" x="3" y="14" width="7" height="7" rx="1" /><rect key="d" x="14" y="14" width="7" height="7" rx="1" /></>],
  ["/dashboard/testimonials", "Testimonials", <path key="a" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />],
  ["/dashboard/team", "Team", <><path key="a" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle key="b" cx="9" cy="7" r="4" /><path key="c" d="M23 21v-2a4 4 0 0 0-3-3.87" /></>],
  ["/dashboard/blog", "Blog", <><path key="a" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path key="b" d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>],
  ["/dashboard/pages", "Pages", <><path key="a" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path key="b" d="M14 2v6h6M8 13h8M8 17h6" /></>],
  ["/dashboard/kanban", "Project board", <><rect key="a" x="3" y="3" width="18" height="18" rx="2" /><path key="b" d="M9 3v18M15 3v10" /></>],
  ["/dashboard/contact", "Contact inbox", <><rect key="a" x="2" y="4" width="20" height="16" rx="2" /><path key="b" d="M22 7l-10 6L2 7" /></>],
  ["/dashboard/users", "Users", <><path key="a" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle key="b" cx="9" cy="7" r="4" /><path key="c" d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>],
  ["/dashboard/seo", "SEO", <><circle key="a" cx="11" cy="11" r="8" /><path key="b" d="M21 21l-4.3-4.3" /></>],
  ["/dashboard/settings", "Settings & pixels", <><circle key="a" cx="12" cy="12" r="3" /><path key="b" d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H8a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V8a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>],
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const [today, setToday] = useState("");
  const [me, setMe] = useState<Me>(null);
  useEffect(() => { setCollapsed(localStorage.getItem("fv_admin_collapsed") === "1"); }, []);
  useEffect(() => { setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })); }, []);
  useEffect(() => { if (getToken()) api.me().then(setMe).catch(() => {}); }, []);
  const toggleCollapsed = () => setCollapsed((c) => { localStorage.setItem("fv_admin_collapsed", c ? "0" : "1"); return !c; });

  const pageTitle = [...NAV]
    .filter(([href]) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)))
    .sort((a, b) => (b[0] as string).length - (a[0] as string).length)[0]?.[1] || "Dashboard";

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    setReady(true);
  }, [pathname, router]);

  useEffect(() => { setOpen(false); }, [pathname]);

  if (!ready) return <div style={{ minHeight: "100vh", background: "#070910" }} />;

  const logout = () => { clearToken(); router.replace("/login"); };

  return (
    <div className={"adm" + (open ? " open" : "") + (collapsed ? " collapsed" : "")}>
      <aside className="adm-side">
        <div className="adm-brandrow">
          <Link href="/dashboard" className="brand" style={{ fontSize: 17 }}><Mark /> <span className="adm-lbl">Finvera</span></Link>
          <button className="adm-collapse" onClick={toggleCollapsed} aria-label="Collapse sidebar" data-tip={collapsed ? "Expand" : "Collapse"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} /></svg>
          </button>
        </div>
        <div className="adm-nav-label">Manage</div>
        {NAV.map(([href, label, icon]) => {
          const active = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "active" : ""} data-tip={label} data-tip-pos="right">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{icon}</svg><span className="adm-lbl">{label}</span>
            </Link>
          );
        })}
        <div className="spacer" />
      </aside>

      {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}
      <div className="adm-main has-chrome">
        <div className="adm-mobbar">
          <button className="adm-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <svg viewBox="0 0 24 24" width={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <Link href="/dashboard" className="brand" style={{ fontSize: 16 }}><Mark /> Finvera</Link>
          <div className="adm-mobbar-right"><UserMenu me={me} onLogout={logout} /></div>
        </div>

        <header className="adm-header">
          <div>
            <div className="ah-crumb">Manage</div>
            <div className="ah-title">{pageTitle}</div>
          </div>
          <div className="ah-right">
            {today && <span className="ah-date">{today}</span>}
            <BackendStatus variant="dot" />
            <UserMenu me={me} onLogout={logout} />
          </div>
        </header>

        <div className="adm-content">{children}</div>

        <footer className="adm-footer">
          <span>© 2026 Finvera Solutions LLP. All rights reserved.</span>
          <div className="af-links">
            <Link href="/privacy" target="_blank">Privacy</Link>
            <Link href="/terms" target="_blank">Terms</Link>
          </div>
        </footer>
      </div>
      <Toaster />
      <DialogHost />
    </div>
  );
}
