"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { getToken, clearToken, api } from "@/lib/adminApi";
import UserMenu, { type Me } from "@/components/admin/UserMenu";
import Toaster from "@/components/admin/Toaster";
import DialogHost from "@/components/admin/DialogHost";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon, FolderLibraryIcon, GridViewIcon, QuoteDownIcon, UserGroupIcon,
  News01Icon, File01Icon, KanbanIcon, Mail01Icon, UserMultipleIcon, Search01Icon, Settings02Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";

const NAV: [string, string, typeof DashboardSquare01Icon][] = [
  ["/dashboard", "Dashboard", DashboardSquare01Icon],
  ["/dashboard/projects", "Projects", FolderLibraryIcon],
  ["/dashboard/services", "Services", GridViewIcon],
  ["/dashboard/testimonials", "Testimonials", QuoteDownIcon],
  ["/dashboard/team", "Team", UserGroupIcon],
  ["/dashboard/blog", "Blog", News01Icon],
  ["/dashboard/pages", "Pages", File01Icon],
  ["/dashboard/kanban", "Project board", KanbanIcon],
  ["/dashboard/leads", "Leads", Target02Icon],
  ["/dashboard/contact", "Contact inbox", Mail01Icon],
  ["/dashboard/users", "Users", UserMultipleIcon],
  ["/dashboard/seo", "SEO", Search01Icon],
  ["/dashboard/settings", "Settings & pixels", Settings02Icon],
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
              <HugeiconsIcon icon={icon} size={19} strokeWidth={1.8} className="hgi" /><span className="adm-lbl">{label}</span>
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
