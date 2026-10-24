"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { getToken, clearToken, api } from "@/lib/adminApi";
import { type Me } from "@/components/admin/UserMenu";
import JumpTo from "@/components/admin/JumpTo";
import NotificationBell from "@/components/admin/NotificationBell";
import GooeyNotifier from "@/components/admin/GooeyNotifier";
import DialogHost from "@/components/admin/DialogHost";
import { rolesCan, userRoles, ROLE_LABELS, type Area } from "@/lib/permissions";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon, FolderLibraryIcon, GridViewIcon, QuoteDownIcon, UserGroupIcon,
  News01Icon, File01Icon, KanbanIcon, Mail01Icon, UserMultipleIcon, Search01Icon, Settings02Icon,
  Target02Icon, LayoutTable01Icon, Invoice01Icon, InstagramIcon,
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
  { key: "projects", label: "Projects", icon: KanbanIcon, items: [
    { href: "/dashboard/kanban", label: "Project board", icon: KanbanIcon, area: "board" },
    { href: "/dashboard/renewals", label: "Renewals", icon: Invoice01Icon, area: "renewals" },
  ] },
  { key: "social", label: "Social media", icon: InstagramIcon, items: [
    { href: "/dashboard/social", label: "Content calendar", icon: InstagramIcon, area: "social" },
  ] },
  { key: "config", label: "Admin", icon: Settings02Icon, items: [
    { href: "/dashboard/seo", label: "SEO", icon: Search01Icon, area: "seo" },
    { href: "/dashboard/settings", label: "Settings & pixels", icon: Settings02Icon, area: "settings" },
    { href: "/dashboard/users", label: "Users", icon: UserMultipleIcon, area: "users" },
  ] },
];

const FLAT: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Decode the role baked into the JWT (authoritative — set at login), so the
    nav works even if /auth/me is slow or returns an unexpected shape. */
function roleFromToken(): string | undefined {
  try {
    const t = getToken();
    if (!t) return undefined;
    const payload = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload?.role;
  } catch { return undefined; }
}

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

  const [today, setToday] = useState("");
  const [tip, setTip] = useState<{ text: string; y: number } | null>(null); // rail tooltip (collapsed)
  const [me, setMe] = useState<Me>(null);
  // Roles come from /auth/me when available, unioned with the role in the JWT
  // (a reliable fallback so admins/users are never locked out of their nav).
  const roles = useMemo(() => {
    const set = new Set(userRoles(me));
    const tok = roleFromToken();
    if (tok) set.add(tok);
    return [...set];
  }, [me]);
  const rolesKey = roles.join(",");

  useEffect(() => { setCollapsed(localStorage.getItem("fv_admin_collapsed") === "1"); }, []);
  useEffect(() => { setToday(new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })); }, []);
  useEffect(() => { if (getToken()) api.me().then((r) => setMe(r?.user ?? r)).catch(() => {}); }, []);
  const toggleCollapsed = () => setCollapsed((c) => { localStorage.setItem("fv_admin_collapsed", c ? "0" : "1"); return !c; });

  const active = matchItem(pathname);
  /* Team members without the content area get a personal "My work" home. */
  const teamHome = roles.length > 0 && !rolesCan(roles, "content") && rolesCan(roles, "social");
  const labelOf = (it: NavItem) => (it.href === "/dashboard" && teamHome ? "My work" : it.label);
  const pageTitle = active ? labelOf(active) : "Dashboard";
  const crumb = NAV_GROUPS.find((g) => g.label && active && g.items.includes(active))?.label;
  const roleText = roles.map((r) => ROLE_LABELS[r] || r).join(" · ");

  /* Nav groups filtered to what these roles may access. */
  const groups = useMemo(() => {
    return NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((it) => rolesCan(roles, it.area)) }))
      .filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey]);

  /* Sidebar count badges: unread inbox messages, overdue calendar posts
     (a team member counts only posts assigned to them). Refreshed on
     navigation and every minute. */
  const [badges, setBadges] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!roles.length) return;
    let alive = true;
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const refresh = async () => {
      const next: Record<string, number> = {};
      if (rolesCan(roles, "contact")) {
        try { next["/dashboard/contact"] = (await api.listContact()).filter((m: { isRead?: boolean }) => !m.isRead).length; } catch { /* ignore */ }
      }
      if (rolesCan(roles, "social")) {
        try {
          const mine = Array.isArray((me as { socialClients?: unknown } | null)?.socialClients);
          const myId = (me as { id?: number } | null)?.id;
          next["/dashboard/social"] = (await api.list("social-posts")).filter((p: { status: string; postDate?: string | null; assigneeId?: number | null }) =>
            p.status !== "posted" && !!p.postDate && String(p.postDate).slice(0, 10) < today && (!mine || p.assigneeId === myId)).length;
        } catch { /* ignore */ }
      }
      if (alive) setBadges(next);
    };
    refresh();
    const t = setInterval(refresh, 60000);
    return () => { alive = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey, me, pathname]);

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

  const NavLink = ({ it }: { it: NavItem }) => {
    const isActive = it.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(it.href);
    return (
      <Link href={it.href} className={isActive ? "active" : ""} aria-current={isActive ? "page" : undefined} data-tip={labelOf(it)} data-tip-pos="right">
        <HugeiconsIcon icon={it.icon} size={19} strokeWidth={1.8} className="hgi" /><span className="adm-lbl">{labelOf(it)}</span>
        {!!badges[it.href] && <span className="adm-navbadge" aria-label={`${badges[it.href]} need attention`}>{badges[it.href] > 99 ? "99+" : badges[it.href]}</span>}
      </Link>
    );
  };

  return (
    <div className={"adm" + (open ? " open" : "") + (collapsed ? " collapsed" : "")}>
      <aside className="adm-side" aria-label="Dashboard menu"
        onMouseOver={(e) => {
          const el = collapsed ? (e.target as HTMLElement).closest<HTMLElement>("[data-tip]") : null;
          if (!el) { setTip(null); return; }
          const r = el.getBoundingClientRect();
          setTip({ text: el.dataset.tip || "", y: r.top + r.height / 2 });
        }}
        onMouseLeave={() => setTip(null)}>
        <div className="adm-brandrow">
          <Link href="/dashboard" className="brand" style={{ fontSize: 17 }}><Mark /> <span className="adm-lbl">Finvera</span></Link>
          <button className="adm-collapse" onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} data-tip={collapsed ? "Expand" : "Collapse"} data-tip-pos="right">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 4v16" /><path d={collapsed ? "M13 10l2 2-2 2" : "M15 10l-2 2 2 2"} /></svg>
          </button>
          <button className="adm-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <nav className="adm-nav">
          {!me && roles.length === 0 ? (
            <div className="adm-nav-skel">
              {Array.from({ length: 6 }).map((_, i) => <span key={i} className="skel skel-line" style={{ height: 34, margin: "4px 0", borderRadius: 10, display: "block" }} />)}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="adm-navsec">
                {g.label && <div className="adm-nav-label">{g.label}</div>}
                {g.items.map((it) => <NavLink key={it.href} it={it} />)}
              </div>
            ))
          )}
        </nav>

        <div className="adm-sidefoot">
          {me?.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="adm-sideav" src={me.avatar} alt="" />
            : <span className="adm-sideav">{(me?.name || "").split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase()}</span>}
          <div className="adm-lbl adm-sidewho">
            <b>{me?.name || "Signed in"}</b>
            <span>{roleText}</span>
          </div>
          <button className="adm-signout" onClick={logout} aria-label="Sign out" data-tip="Sign out" data-tip-pos="right">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
          </button>
        </div>
      </aside>

      {collapsed && tip && <div className="adm-railtip" style={{ top: tip.y }} role="tooltip">{tip.text}</div>}
      {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}
      <div className="adm-main has-chrome">
        <div className="adm-mobbar">
          <button className="adm-burger" onClick={() => setOpen((o) => !o)} aria-label="Open menu" aria-expanded={open}>
            <svg viewBox="0 0 24 24" width={18} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <span className="adm-mobtitle">{pageTitle}</span>
          <div className="adm-mobbar-right"><NotificationBell /></div>
        </div>

        <header className="adm-header">
          <nav className="ah-path" aria-label="Breadcrumb">
            {crumb && <><span className="ah-crumb">{crumb}</span><span className="ah-sep" aria-hidden="true">/</span></>}
            <span className="ah-title">{pageTitle}</span>
          </nav>
          <div className="ah-right">
            <JumpTo items={groups.flatMap((g) => g.items.map((it) => ({ href: it.href, label: labelOf(it), group: g.label })))} />
            {today && <span className="ah-date">{today}</span>}
            <NotificationBell announce />
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
      <GooeyNotifier />
      <DialogHost />
    </div>
  );
}
