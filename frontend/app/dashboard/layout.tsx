"use client";
import "./shell.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { getToken, clearToken, clearApiMemo, api } from "@/lib/adminApi";
import UserMenu, { type Me } from "@/components/admin/UserMenu";
import InstallApp from "@/components/admin/InstallApp";
import { registerWorker, syncPush, disablePush } from "@/lib/push";
import { visibleInterval } from "@/lib/visibleInterval";
import NotificationBell from "@/components/admin/NotificationBell";
import GooeyNotifier from "@/components/admin/GooeyNotifier";
import DialogHost from "@/components/admin/DialogHost";
import CommandPalette, { type PaletteItem } from "@/components/admin/shell/CommandPalette";
import { ShellContext, type Badges } from "@/components/admin/shell/ShellContext";
import { NAV_GROUPS, QUICK_ACTIONS, SUB_PAGES, matchItem, groupOf, type NavItem } from "@/components/admin/shell/nav";
import { rolesCan, userRoles, ROLE_LABELS } from "@/lib/permissions";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Menu01Icon, Cancel01Icon, SidebarLeft01Icon } from "@hugeicons/core-free-icons";

const COLLAPSE_KEY = "fv_admin_collapsed";

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

/* Today's date in India for the top bar, e.g. "Tue, 3 Nov". */
const istShort = () => new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

/* App shell: sidebar (collapsible on desktop, a drawer on phones), top bar
   with breadcrumb, command palette, notifications and the account menu.
   The layout stays mounted across page changes, so /auth/me is fetched once
   and the badge poll keeps running — nothing refetches on navigation. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);          // phone drawer
  const [collapsed, setCollapsed] = useState(false); // desktop rail
  const [palette, setPalette] = useState(false);
  const [mac, setMac] = useState(false);
  const [today, setToday] = useState("");
  const [tip, setTip] = useState<{ text: string; y: number } | null>(null); // rail tooltip (collapsed)
  const [me, setMe] = useState<Me>(null);
  const [meDone, setMeDone] = useState(false);
  // Roles come from /auth/me when available, unioned with the role in the JWT
  // (a reliable fallback so admins/users are never locked out of their nav).
  const roles = useMemo(() => {
    const set = new Set(userRoles(me));
    const tok = roleFromToken();
    if (tok) set.add(tok);
    return [...set];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, ready]);
  const rolesKey = roles.join(",");

  useEffect(() => { try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* storage blocked */ } }, []);
  useEffect(() => { setToday(istShort()); setMac(/Mac|iPhone|iPad/.test(navigator.platform)); }, []);
  useEffect(() => {
    if (getToken()) api.me().then((r) => setMe(r?.user ?? r)).catch(() => {}).finally(() => setMeDone(true));
    else setMeDone(true);
  }, []);
  /* My account page saved the profile → refresh the name/avatar shown here. */
  useEffect(() => {
    const onMe = (e: Event) => setMe((m) => ({ ...(m || {}), ...((e as CustomEvent).detail || {}) }));
    window.addEventListener("fv-me", onMe);
    return () => window.removeEventListener("fv-me", onMe);
  }, []);
  /* Push notifications: start the service worker, keep this device's
     subscription linked to whoever is signed in, and refresh the bell and
     sidebar badges the moment a push arrives while the app is open. */
  useEffect(() => {
    if (!getToken() || !("serviceWorker" in navigator)) return;
    registerWorker().then(() => syncPush());
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type !== "fv-push") return;
      window.dispatchEvent(new Event("fv-push"));
      window.dispatchEvent(new Event("fv-badges"));
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* storage blocked */ }
    return !c;
  });

  const active = matchItem(pathname);
  const sub = SUB_PAGES.find((p) => pathname === p.href || pathname.startsWith(p.href + "/"));
  const navActive = active || (sub ? matchItem(sub.parent) : undefined); // highlighted in the sidebar
  /* Team members without the content area get a personal "My work" home. */
  const teamHome = roles.length > 0 && !rolesCan(roles, "content") && rolesCan(roles, "social");
  const labelOf = useCallback((it: NavItem) => (it.href === "/dashboard" && teamHome ? "My work" : it.label), [teamHome]);
  const roleText = roles.map((r) => ROLE_LABELS[r] || r).join(" · ");

  /* Breadcrumb: group / page (/ sub-page). */
  const crumbs: { label: string; href?: string }[] = [];
  const grp = groupOf(navActive);
  if (grp) crumbs.push({ label: grp });
  if (sub && navActive) crumbs.push({ label: labelOf(navActive), href: navActive.href }, { label: sub.label });
  else crumbs.push({ label: navActive ? labelOf(navActive) : "Dashboard" });

  /* Nav groups filtered to what these roles may access. */
  const groups = useMemo(() => NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => rolesCan(roles, it.area)) }))
    .filter((g) => g.items.length > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [rolesKey]);

  const paletteItems = useMemo<PaletteItem[]>(() => [
    ...groups.flatMap((g) => g.items.map((it) => ({ group: "Pages" as const, label: labelOf(it), sub: g.label, href: it.href, icon: it.icon }))),
    ...QUICK_ACTIONS.filter((a) => rolesCan(roles, a.area)).map((a) => ({ group: "Actions" as const, label: a.label, sub: a.sub, href: a.href, icon: a.icon })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [groups, labelOf, rolesKey]);

  /* Ctrl/⌘ K opens the palette (rich-text editors keep it for "add link"). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.defaultPrevented || t?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(false); setPalette((p) => !p); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* Sidebar count badges: unread inbox messages, overdue calendar posts
     (a team member counts only posts assigned to them), lead follow-ups due
     today + overdue. One small /badges call every 2 minutes while the tab is
     visible, straight away when you come back to the tab, and shortly after
     an "fv-badges" event (debounced, so a burst of saves makes one request).
     Older backends without /badges fall back to counting from the full lists. */
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [badgeData, setBadgeData] = useState<Badges | null>(null);
  const badgesApi = useRef(true); // false once /badges 404s (older backend)
  // Only the fallback counting needs `me` (to count "mine"); /badges is scoped by the server.
  const legacyMe = badgesApi.current ? null : me;
  useEffect(() => {
    if (!roles.length) return;
    let alive = true;
    const canContact = rolesCan(roles, "contact"), canSocial = rolesCan(roles, "social");
    const canLeads = rolesCan(roles, "leads");
    if (!canContact && !canSocial && !canLeads) return;
    const legacy = async () => {
      const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
      const next: Record<string, number> = {};
      if (canContact) {
        try { next["/dashboard/contact"] = (await api.listContact()).filter((m: { isRead?: boolean }) => !m.isRead).length; } catch { /* ignore */ }
      }
      if (canSocial) {
        try {
          const mine = Array.isArray((legacyMe as { socialClients?: unknown } | null)?.socialClients);
          const myId = (legacyMe as { id?: number } | null)?.id;
          next["/dashboard/social"] = (await api.listSocialPosts({ fields: "card" })).filter((p: { status: string; postDate?: string | null; assigneeId?: number | null }) =>
            p.status !== "posted" && !!p.postDate && String(p.postDate).slice(0, 10) < today && (!mine || p.assigneeId === myId)).length;
        } catch { /* ignore */ }
      }
      return next;
    };
    const refresh = async () => {
      if (document.hidden) return;
      let next: Record<string, number>;
      if (badgesApi.current) {
        try {
          const b = (await api.badges()) as Badges;
          next = {};
          if (canContact) next["/dashboard/contact"] = Number(b?.inboxUnread) || 0;
          if (canSocial) next["/dashboard/social"] = Number(b?.socialOverdue) || 0;
          if (canLeads) next["/dashboard/leads"] = (Number(b?.leadsFollowUpToday) || 0) + (Number(b?.leadsFollowUpOverdue) || 0);
          if (alive) setBadgeData(b);
        } catch (e) {
          // Endpoint not deployed yet → stop asking for it this session.
          if ((e as { status?: number })?.status === 404) badgesApi.current = false;
          next = await legacy();
        }
      } else next = await legacy();
      if (alive) setBadges(next);
    };
    refresh();
    const stop = visibleInterval(refresh, 120000);
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const soon = () => { if (debounce) clearTimeout(debounce); debounce = setTimeout(refresh, 1500); };
    window.addEventListener("fv-badges", soon);
    return () => { alive = false; stop(); if (debounce) clearTimeout(debounce); window.removeEventListener("fv-badges", soon); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey, legacyMe]);

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

  useEffect(() => { setOpen(false); setPalette(false); }, [pathname]);

  /* Phone drawer: Escape closes it; the page behind doesn't scroll. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  const shell = useMemo(() => ({ me, roles, rolesReady: meDone, badges: badgeData }), [me, roles, meDone, badgeData]);

  if (!ready) return <div style={{ minHeight: "100vh", background: "#f4f6fb" }} />;

  // Signing out stops this device getting the previous person's notifications.
  // Ends this session on the server too (errors ignored — we sign out locally either way).
  const logout = async () => {
    await disablePush();
    try { await api.logout(); } catch { /* ignore */ }
    clearToken(); clearApiMemo(); router.replace("/login");
  };

  const isOn = (it: NavItem) => navActive === it;

  return (
    <ShellContext.Provider value={shell}>
      <div className={"adm sh" + (open ? " open" : "") + (collapsed ? " collapsed sh-col" : "")}>
        <aside className={"sh-side" + (open ? " open" : "")} aria-label="Main menu"
          onMouseOver={(e) => {
            const el = collapsed ? (e.target as HTMLElement).closest<HTMLElement>("[data-tip]") : null;
            if (!el) { setTip(null); return; }
            const r = el.getBoundingClientRect();
            setTip({ text: el.dataset.tip || "", y: r.top + r.height / 2 });
          }}
          onMouseLeave={() => setTip(null)}>
          <div className="sh-logo">
            <Link href="/dashboard" className="sh-brand" aria-label="Finvera dashboard"><Mark className="sh-mk" /><span className="sh-nm">Finvera</span></Link>
            <button type="button" className="sh-icb sm sh-colbtn" onClick={toggleCollapsed} aria-label={collapsed ? "Expand menu" : "Collapse menu"} aria-pressed={collapsed} data-tip={collapsed ? "Expand menu" : "Collapse menu"}>
              <HugeiconsIcon icon={SidebarLeft01Icon} size={18} strokeWidth={1.8} className="hgi" />
            </button>
            <button type="button" className="sh-icb sm sh-x" onClick={() => setOpen(false)} aria-label="Close menu">
              <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} className="hgi" />
            </button>
          </div>

          <nav className="sh-navs" aria-label="Pages">
            {!meDone && roles.length === 0 ? (
              Array.from({ length: 7 }).map((_, i) => <span key={i} className="skel skel-line" style={{ height: 34, margin: "4px 0", borderRadius: 10 }} />)
            ) : groups.map((g) => (
              <div key={g.key} className="sh-sec">
                {g.label && <div className="sh-grp">{g.label}</div>}
                {g.items.map((it) => {
                  const on = isOn(it), n = badges[it.href] || 0;
                  return (
                    <Link key={it.href} href={it.href} className={"sh-nav" + (on ? " on" : "")} aria-current={on ? "page" : undefined} data-tip={labelOf(it)}>
                      <HugeiconsIcon icon={it.icon} size={19} strokeWidth={1.8} className="hgi" />
                      <span className="sh-t">{labelOf(it)}</span>
                      {n > 0 && <>
                        <span className={"sh-bdg " + (it.href === "/dashboard/leads" ? "amber" : "red")} aria-label={`${n} need attention`}>{n > 99 ? "99+" : n}</span>
                        <i className="sh-dotb" aria-hidden="true" />
                      </>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <InstallApp />
          <UserMenu me={me} roleText={roleText} canUsers={rolesCan(roles, "users")} canSettings={rolesCan(roles, "settings")}
            onLogout={logout} onPalette={() => { setOpen(false); setPalette(true); }} mac={mac} />
        </aside>

        {collapsed && tip && <div className="adm-railtip sh-railtip" style={{ top: tip.y }} role="tooltip">{tip.text}</div>}
        <div className={"sh-scrim" + (open ? " on" : "")} onClick={() => setOpen(false)} aria-hidden="true" />

        <div className="sh-main">
          <header className="sh-top">
            <button type="button" className="sh-icb sh-burger" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
              <HugeiconsIcon icon={Menu01Icon} size={19} strokeWidth={1.8} className="hgi" />
            </button>
            <nav className="sh-crumb" aria-label="Breadcrumb">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <span key={i} className={last ? "sh-crumb-cur" : "sh-pre"}>
                    {last ? <b aria-current="page">{c.label}</b> : c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
                    {!last && <span className="sh-sep" aria-hidden="true">/</span>}
                  </span>
                );
              })}
            </nav>
            <button type="button" className="sh-jump" onClick={() => setPalette(true)} aria-label="Jump to a page" aria-haspopup="dialog">
              <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.8} className="hgi" />
              <span>Jump to a page…</span>
              <kbd>{mac ? "⌘ K" : "Ctrl K"}</kbd>
            </button>
            {today && <span className="sh-today">{today}</span>}
            <NotificationBell />
          </header>

          <main className="adm-content sh-page" id="main">{children}</main>

          <footer className="sh-footer">
            <span>© 2026 Finvera Solutions LLP</span>
            <span className="sh-footer-links">
              <Link href="/privacy" target="_blank">Privacy</Link>
              <Link href="/terms" target="_blank">Terms</Link>
            </span>
          </footer>
        </div>
        <CommandPalette open={palette} onClose={() => setPalette(false)} items={paletteItems} />
        <GooeyNotifier />
        <DialogHost />
      </div>
    </ShellContext.Provider>
  );
}
