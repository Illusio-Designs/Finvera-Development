"use client";
import { useDisclosure } from "@/lib/useDisclosure";
import "./shell.css";
import "@/components/admin/workspace-tokens.css";
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
import { NAV_GROUPS, QUICK_ACTIONS, EXTRA_PAGES, matchItem, groupOf, groupFor, type NavItem } from "@/components/admin/shell/nav";
import { rolesCan, userRoles, ROLE_LABELS } from "@/lib/permissions";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Menu01Icon, Cancel01Icon, SidebarLeft01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

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
  const [open, setOpen] = useDisclosure(false);          // phone drawer
  const [collapsed, setCollapsed] = useDisclosure(false); // desktop rail
  const [palette, setPalette] = useDisclosure(false);
  const [mac, setMac] = useState(false);
  const [today, setToday] = useState("");
  const [tip, setTip] = useState<{ text: string; y: number } | null>(null); // rail tooltip (collapsed)
  const [me, setMe] = useState<Me>(null);
  const [meDone, setMeDone] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
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
  const activeGroup = groupFor(active);
  const personal = active?.href === "/dashboard/account";
  const teamHome = roles.length > 0 && !rolesCan(roles, "content") && rolesCan(roles, "social");
  const labelOf = useCallback((item: NavItem) => item.href === "/dashboard" && teamHome ? "My work" : item.label, [teamHome]);
  const roleText = roles.map((role) => ROLE_LABELS[role] || role).join(" · ");
  const groups = useMemo(() => NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => rolesCan(roles, item.area)) })).filter((group) => group.items.length), [rolesKey]);
  const currentGroup = groups.find((group) => group.key === activeGroup?.key) || groups[0];
  const context = personal ? { label: "Personal", eyebrow: "Your own space", description: "Your profile and sign-in security." } : currentGroup;
  const mainItems = personal ? EXTRA_PAGES : currentGroup?.items.filter((item) => !item.collection) || [];
  const collectionItems = personal ? [] : currentGroup?.items.filter((item) => item.collection) || [];
  const crumbs: { label: string; href?: string }[] = [];
  const groupLabel = groupOf(active);
  if (groupLabel) crumbs.push({ label: groupLabel });
  if (active?.collection) crumbs.push({ label: "Site sections", href: "/dashboard/content" });
  crumbs.push({ label: active ? labelOf(active) : "Overview" });
  const paletteItems = useMemo<PaletteItem[]>(() => [
    ...groups.flatMap((group) => group.items.map((item) => ({ group: "Pages" as const, label: labelOf(item), sub: item.collection ? `${group.label} · Site sections` : group.label, href: item.href, icon: item.icon }))),
    ...QUICK_ACTIONS.filter((action) => rolesCan(roles, action.area)).map((action) => ({ group: "Actions" as const, label: action.label, sub: action.sub, href: action.href, icon: action.icon })),
  ], [groups, labelOf, rolesKey]);
  useEffect(() => { if (active?.collection) setSectionsOpen(true); }, [active?.href, active?.collection]);
  useEffect(() => {
    sidebarRef.current?.querySelector<HTMLElement>('.sh-nav[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname, sectionsOpen, collapsed]);

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
          next["/dashboard/social"] = (await api.listSocialPosts({ fields: "card" })).filter((post: { status: string; postDate?: string | null; postTime?: string | null; assigneeId?: number | null }) =>
            post.status !== "posted" && !!post.postDate && +new Date(`${String(post.postDate).slice(0, 10)}T${post.postTime || "10:00"}:00+05:30`) < Date.now() && (!mine || post.assigneeId === myId)).length;
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

  /* Mobile navigation is a modal drawer: trap focus, restore the trigger and
     keep the underlying page stationary while the two navigation levels open. */
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const sidebar = sidebarRef.current;
    const frame = requestAnimationFrame(() => sidebar?.querySelector<HTMLElement>('button,a[href]')?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('.adm-confirm') || document.querySelector('.sh-userpop')) return;
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab" || !sidebar) return;
      const elements = Array.from(sidebar.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')).filter((element) => element.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { cancelAnimationFrame(frame); document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; (previous?.isConnected ? previous : burgerRef.current)?.focus(); };
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

  const renderPage = (item: NavItem) => {
    const on = active === item, count = badges[item.href] || 0;
    return <Link key={item.href} href={item.href} className={"sh-nav" + (on ? " on" : "")} aria-current={on ? "page" : undefined}>
      <HugeiconsIcon icon={item.icon} size={19} strokeWidth={1.8} className="hgi" />
      <span className="sh-t">{labelOf(item)}{item.description && <small>{item.description}</small>}</span>
      {count > 0 && <span className={"sh-bdg " + (item.href === "/dashboard/leads" ? "amber" : "red")} aria-label={`${count} need attention`}>{count > 99 ? "99+" : count}</span>}
    </Link>;
  };
  const revealPages = () => { setCollapsed(false); try { localStorage.setItem(COLLAPSE_KEY, "0"); } catch { /* storage blocked */ } };

  return (
    <ShellContext.Provider value={shell}>
      <div className={"adm sh" + (open ? " open" : "") + (collapsed ? " collapsed sh-col" : "")}>
        <aside ref={sidebarRef} id="finvera-sidebar" className={"sh-side" + (open ? " open" : "")} aria-label="Workspace navigation"
          onMouseOver={(event) => {
            const element = (event.target as HTMLElement).closest<HTMLElement>("[data-tip]");
            if (!element) { setTip(null); return; }
            const rect = element.getBoundingClientRect(); setTip({ text: element.dataset.tip || "", y: rect.top + rect.height / 2 });
          }} onMouseLeave={() => setTip(null)}>
          <div className="sh-workspace-rail">
            <Link href="/dashboard" className="sh-rail-brand" aria-label="Finvera dashboard"><Mark className="sh-mk" /></Link>
            <nav className="sh-workspaces" aria-label="Workspace areas">
              {!meDone && !roles.length ? Array.from({ length: 5 }).map((_, index) => <span key={index} className="skel" style={{ width: 42, height: 42, borderRadius: 14 }} />) : groups.map((group) => {
                const on = !personal && group.key === currentGroup?.key;
                const count = group.items.reduce((sum, item) => sum + (badges[item.href] || 0), 0);
                return <Link key={group.key} href={group.items[0].href} onClick={revealPages} className={"sh-workspace" + (on ? " on" : "")} aria-label={group.label} data-tip={group.label}>
                  <span className="sh-workspace-icon"><HugeiconsIcon icon={group.icon} size={22} strokeWidth={1.8} className="hgi" />{count > 0 && <i className="sh-space-dot" aria-label={`${count} need attention`} />}</span>
                  <span>{group.shortLabel}</span>
                </Link>;
              })}
            </nav>
            <InstallApp className="sh-rail-install" />
            <button type="button" className="sh-icb plain sh-colbtn" onClick={toggleCollapsed} aria-label={collapsed ? "Expand menu" : "Collapse menu"} aria-pressed={collapsed} data-tip={collapsed ? "Expand menu" : "Collapse menu"}><HugeiconsIcon icon={SidebarLeft01Icon} size={19} strokeWidth={1.8} className="hgi" /></button>
            <div className={"sh-rail-account" + (personal ? " current" : "")}><UserMenu me={me} roleText={roleText} canUsers={rolesCan(roles, "users")} canSettings={rolesCan(roles, "settings")} onLogout={logout} onPalette={() => { setOpen(false); setPalette(true); }} mac={mac} /></div>
          </div>
          <div className="sh-page-panel">
            <div className="sh-logo"><Link href="/dashboard" className="sh-wordmark">Finvera<small>The workspace</small></Link><button type="button" className="sh-icb plain sm sh-x" onClick={() => setOpen(false)} aria-label="Close menu"><HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} className="hgi" /></button></div>
            <div className="sh-space-heading"><span>{context?.eyebrow || "Your workspace"}</span><h2>{context?.label || "Workspace"}</h2><p>{context?.description || "Every page, within reach."}</p></div>
            <nav className="sh-navs" aria-label={personal ? "Personal pages" : `${currentGroup?.label || "Workspace"} pages`}>
              {!meDone && !roles.length ? Array.from({ length: 4 }).map((_, index) => <span key={index} className="skel skel-line" style={{ height: 40, margin: "4px 0", borderRadius: 12 }} />) : <>
                {mainItems.map(renderPage)}
                {collectionItems.length > 0 && <div className="sh-collections"><button type="button" className="sh-collection-toggle" onClick={() => setSectionsOpen((value) => !value)} aria-expanded={sectionsOpen} aria-controls="sh-site-sections">Site sections<HugeiconsIcon icon={ArrowDown01Icon} size={15} strokeWidth={1.8} className="hgi" /></button>{sectionsOpen && <div id="sh-site-sections" className="sh-collection-links">{collectionItems.map(renderPage)}</div>}</div>}
                {!personal && currentGroup?.key === "home" && rolesCan(roles, "social") && <div className="sh-continue"><span>Pick up where you left off</span>{renderPage(NAV_GROUPS.find((group) => group.key === "social")!.items[0])}</div>}
              </>}
            </nav>
            <div className="sh-page-panel-foot"><span>Every page. Within reach.</span><button type="button" className="sh-find-page" onClick={() => { setOpen(false); setPalette(true); }} aria-label="Find any page"><HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} className="hgi" /><b>Find a page</b><kbd>{mac ? "⌘ K" : "Ctrl K"}</kbd></button></div>
          </div>
        </aside>

        {collapsed && tip && <div className="adm-railtip sh-railtip" style={{ top: tip.y }} role="tooltip">{tip.text}</div>}
        <div className={"sh-scrim" + (open ? " on" : "")} onClick={() => setOpen(false)} aria-hidden="true" />

        <div className="sh-main">
          <header className="sh-top">
            <button type="button" className="sh-icb sh-burger" onClick={() => setOpen(true)} ref={burgerRef} aria-label="Open menu" aria-expanded={open} aria-controls="finvera-sidebar">
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
              <span>Search the workspace</span>
              <kbd>{mac ? "⌘ K" : "Ctrl K"}</kbd>
            </button>
            {today && <span className="sh-today">{today}</span>}
            <NotificationBell />
          </header>

          <main className="adm-content sh-page fw-surface" id="main">{children}</main>

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
