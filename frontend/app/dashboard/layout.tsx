"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { getToken, clearToken, api } from "@/lib/adminApi";
import UserMenu, { type Me } from "@/components/admin/UserMenu";
import Toaster from "@/components/admin/Toaster";
import DialogHost from "@/components/admin/DialogHost";
import { rolesCan, userRoles, type Area } from "@/lib/permissions";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon, FolderLibraryIcon, GridViewIcon, QuoteDownIcon, UserGroupIcon,
  News01Icon, File01Icon, KanbanIcon, Mail01Icon, UserMultipleIcon, Search01Icon, Settings02Icon,
  Target02Icon, LayoutTable01Icon,
} from "@hugeicons/core-free-icons";

type Icon = typeof DashboardSquare01Icon;
type NavItem = { href: string; label: string; icon: Icon; area: Area | null };
type NavGroup = { key: string; label: string | null; icon?: Icon; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  { key: "overview", label: null, items: [
    { href: "/dashboard", label: "Dashboard", icon: DashboardSquare01Icon, area: null },
  ] },
  { key: "content", label: "Content", icon: LayoutTable01Icon, items: [
    { href: "/dashboard/projects", label: "Projects", icon: FolderLibraryIcon, area: "content" },
    { href: "/dashboard/services", label: "Services", icon: GridViewIcon, area: "content" },
    { href: "/dashboard/testimonials", label: "Testimonials", icon: QuoteDownIcon, area: "content" },
    { href: "/dashboard/team", label: "Team", icon: UserGroupIcon, area: "content" },
    { href: "/dashboard/blog", label: "Blog", icon: News01Icon, area: "content" },
    { href: "/dashboard/pages", label: "Pages", icon: File01Icon, area: "content" },
    { href: "/dashboard/content", label: "Site content", icon: LayoutTable01Icon, area: "content" },
  ] },
  { key: "sales", label: "Sales", icon: Target02Icon, items: [
    { href: "/dashboard/leads", label: "Leads", icon: Target02Icon, area: "leads" },
    { href: "/dashboard/contact", label: "Contact inbox", icon: Mail01Icon, area: "contact" },
  ] },
  { key: "board", label: null, items: [
    { href: "/dashboard/kanban", label: "Project board", icon: KanbanIcon, area: "board" },
  ] },
  { key: "config", label: "Configuration", icon: Settings02Icon, items: [
    { href: "/dashboard/seo", label: "SEO", icon: Search01Icon, area: "seo" },
    { href: "/dashboard/settings", label: "Settings & pixels", icon: Settings02Icon, area: "settings" },
  ] },
  { key: "admin", label: null, items: [
    { href: "/dashboard/users", label: "Users", icon: UserMultipleIcon, area: "users" },
  ] },
];

const FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Longest-prefix nav match for the current path. */
function matchItem(pathname: string): NavItem | undefined {
  return [...FLAT]
    .filter((n) => (n.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const [today, setToday] = useState("");
  const [me, setMe] = useState<Me>(null);
  const roles = userRoles(me);
  const rolesKey = roles.join(",");

  useEffect(() => { setCollapsed(localStorage.getItem("fv_admin_collapsed") === "1"); }, []);
  useEffect(() => { setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })); }, []);
  useEffect(() => { if (getToken()) api.me().then((r) => setMe(r?.user ?? r)).catch(() => {}); }, []);
  const toggleCollapsed = () => setCollapsed((c) => { localStorage.setItem("fv_admin_collapsed", c ? "0" : "1"); return !c; });

  const active = matchItem(pathname);
  const pageTitle = active?.label || "Dashboard";

  /* Nav groups filtered to what these roles may access. */
  const groups = useMemo(() => {
    return NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((it) => rolesCan(roles, it.area)) }))
      .filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey]);

  /* Open the group that contains the active route by default. */
  const activeHref = active?.href;
  useEffect(() => {
    const g = NAV_GROUPS.find((grp) => grp.label && grp.items.some((it) => it.href === activeHref));
    if (g) setOpenGroups((prev) => (prev.includes(g.key) ? prev : [...prev, g.key]));
  }, [activeHref]);

  useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    setReady(true);
  }, [pathname, router]);

  /* Route guard — bounce to the dashboard if the roles can't see this page. */
  useEffect(() => {
    if (!roles.length) return;
    if (active && !rolesCan(roles, active.area)) router.replace("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey, active, router]);

  useEffect(() => { setOpen(false); }, [pathname]);

  /* Close the mobile menu on outside-click / Escape. */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest(".adm-side") || t.closest(".adm-burger")) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ready) return <div style={{ minHeight: "100vh", background: "#070910" }} />;

  const logout = () => { clearToken(); router.replace("/login"); };
  const toggleGroup = (k: string) => setOpenGroups((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const NavLink = ({ it }: { it: NavItem }) => {
    const isActive = it.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(it.href);
    return (
      <Link href={it.href} className={isActive ? "active" : ""} data-tip={it.label} data-tip-pos="right">
        <HugeiconsIcon icon={it.icon} size={19} strokeWidth={1.8} className="hgi" /><span className="adm-lbl">{it.label}</span>
      </Link>
    );
  };

  return (
    <div className={"adm" + (open ? " open" : "") + (collapsed ? " collapsed" : "")}>
      <aside className="adm-side">
        <div className="adm-brandrow">
          <Link href="/dashboard" className="brand" style={{ fontSize: 17 }}><Mark /> <span className="adm-lbl">Finvera</span></Link>
          <button className="adm-collapse" onClick={toggleCollapsed} aria-label="Collapse sidebar" data-tip={collapsed ? "Expand" : "Collapse"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} /></svg>
          </button>
        </div>

        {!me ? (
          <div className="adm-nav-skel">
            {Array.from({ length: 6 }).map((_, i) => <span key={i} className="skel skel-line" style={{ height: 34, margin: "4px 0", borderRadius: 10, display: "block" }} />)}
          </div>
        ) : collapsed ? (
          /* Icon-only mode — flatten groups */
          <>{groups.flatMap((g) => g.items).map((it) => <NavLink key={it.href} it={it} />)}</>
        ) : (
          groups.map((g) => {
            if (!g.label) return <div key={g.key}>{g.items.map((it) => <NavLink key={it.href} it={it} />)}</div>;
            const isOpen = openGroups.includes(g.key);
            const hasActive = g.items.some((it) => (it.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(it.href)));
            return (
              <div key={g.key} className={"adm-navgroup" + (isOpen ? " open" : "") + (hasActive ? " has-active" : "")}>
                <button type="button" className="adm-navgroup-h" onClick={() => toggleGroup(g.key)} aria-expanded={isOpen}>
                  {g.icon && <HugeiconsIcon icon={g.icon} size={18} strokeWidth={1.8} className="hgi" />}
                  <span className="adm-lbl">{g.label}</span>
                  <svg className="adm-navgroup-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <div className="adm-navgroup-items">
                  <div>{g.items.map((it) => <NavLink key={it.href} it={it} />)}</div>
                </div>
              </div>
            );
          })
        )}
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
