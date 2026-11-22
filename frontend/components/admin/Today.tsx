"use client";
import { DisclosureSummary, WorkspaceHero } from "@/components/admin/Workspace";
import { useDisclosure } from "@/lib/useDisclosure";
import { useResourceState } from "@/lib/useResourceState";
import PageLoading from "@/components/admin/PageLoading";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import "./today.css";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon, Alert02Icon, CheckmarkCircle02Icon, Clock01Icon, RepeatIcon, UserAdd01Icon, Target02Icon,
  Calendar03Icon, Add01Icon, ArrowRight01Icon, ArrowDown01Icon, Upload01Icon, News01Icon, Briefcase01Icon,
  Refresh01Icon, CallIcon, Search01Icon, Settings02Icon,
} from "@hugeicons/core-free-icons";
import { api, type Overview, type Today as TodayData, type TodayNeed } from "@/lib/adminApi";
import { useShell } from "@/components/admin/shell/ShellContext";
import { initials, type Icon } from "@/components/admin/shell/nav";
import { useMyWork, MyQueue, istIso } from "@/components/admin/MyWork";
import SocialKpis from "@/components/admin/SocialKpis";
import { rolesCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { visibleInterval } from "@/lib/visibleInterval";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function useSource<T>(run: () => Promise<T>, enabled: boolean, key: string) {
  const { data, error, setData, setError } = useResourceState<T | null>(null, false);
  const runRef = useRef(run);
  runRef.current = run;
  const load = useCallback(async () => {
    try { setData(await runRef.current()); setError(""); }
    catch (e) { setError(msg(e)); }
  }, [setData, setError]);
  useEffect(() => { if (enabled) load(); else { setData(null); setError(""); } }, [enabled, key, load, setData, setError]);
  useEffect(() => {
    if (!enabled) return;
    const stop = visibleInterval(load, 120000);
    window.addEventListener("fv-badges", load);
    return () => { stop(); window.removeEventListener("fv-badges", load); };
  }, [enabled, key, load]);
  return { data, error, reload: load, setData: (fn: (d: T) => T) => setData(previous => previous ? fn(previous) : previous) };
}

/* ── formatting ── */
const IST = "Asia/Kolkata";
const inrShort = (n: number) => {
  n = Number(n) || 0;
  if (n >= 1e7) return `₹${+(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${+(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `₹${+(n / 1e3).toFixed(1)}k`;
  return `₹${n}`;
};
const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
const dayFmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
const dateFmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: IST });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const AV = ["#3e60ab", "#e0567a", "#0e7490", "#6d4fe0", "#ea580c", "#334155", "#be185d", "#2563eb"];
const avColor = (s: string) => AV[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

const STAGES = [
  { id: "new", name: "New", c: "var(--td-muted)" },
  { id: "contacted", name: "Contacted", c: "var(--td-brand)" },
  { id: "qualified", name: "Qualified", c: "var(--td-violet)" },
  { id: "proposal", name: "Proposal", c: "var(--td-amber)" },
  { id: "won", name: "Won", c: "var(--td-green)" },
  { id: "lost", name: "Lost", c: "var(--td-red)" },
];
const OPEN_STAGES = ["new", "contacted", "qualified", "proposal"];

/* ── small pieces ── */
const Ic = ({ i, size = 18 }: { i: Icon; size?: number }) => <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} className="hgi" />;

function CardError({ text, onRetry }: { text: string; onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  return (
    <div className="sh-empty err" role="alert">
      <Ic i={Alert02Icon} size={20} />
      <b>Couldn&apos;t load this</b>
      <span>{text}</span>
      <button type="button" className="sh-btn sm" disabled={retrying} onClick={async () => {
        setRetrying(true);
        try { await onRetry(); } finally { setRetrying(false); }
      }}><Ic i={Refresh01Icon} size={15} />{retrying ? "Trying again…" : "Try again"}</button>
    </div>
  );
}
type Need = {
  key: string; tone: "red" | "violet" | "amber" | "blue"; icon: Icon; title: string; postId?: number;
  pill?: { text: string; tone: string }; meta?: string;
  action?: { label: string; href: string } | { label: string; run: () => Promise<void>; primary?: boolean };
};

function NeedRow({ n }: { n: Need }) {
  const [busy, setBusy] = useState(false);
  const a = n.action;
  return (
    <div className="td-need">
      <span className={"td-box " + n.tone}><Ic i={n.icon} size={20} /></span>
      <div className="td-need-tx">
        <b>{n.title}</b>
        {(n.pill || n.meta) && <div className="td-meta">{n.pill && <span className={"sh-pill nodot " + n.pill.tone}>{n.pill.text}</span>}{n.meta && <span className="td-meta-t">{n.meta}</span>}</div>}
      </div>
      {a && ("href" in a
        ? <Link href={a.href} className="sh-btn sm">{a.label}<Ic i={ArrowRight01Icon} size={15} /></Link>
        : <button type="button" className={"sh-btn sm" + (a.primary ? " pri" : "")} disabled={busy}
          onClick={async () => { setBusy(true); try { await a.run(); } finally { setBusy(false); } }}>
          {busy ? "Working…" : a.label}<Ic i={ArrowRight01Icon} size={15} />
        </button>)}
    </div>
  );
}

function PublishingWeek({ data }: { data: TodayData }) {
  const max = Math.max(1, ...data.week.map((day) => day.total));
  return (
    <>
      <ul className="td-week-chart" aria-label="Posts by go-live date in India time" role="list">
        {data.week.map(({ day, total, ready }) => (
          <li key={day} className="td-week-day" aria-current={day === data.today ? "date" : undefined}>
            <span className="td-visually-hidden">
              {dayFmt(day, { weekday: "long", day: "numeric", month: "long" })},
              {" "}{plural(total, "post")}, {ready} ready or live
            </span>
            <div className="td-week-pillar" aria-hidden="true">
              <b>{total}</b>
              {total > 0 && (
                <div className="td-week-bar" style={{ height: `calc(var(--td-week-bar-height) * ${total / max})` }}>
                  {total > ready && <span className="td-week-pending" style={{ flexGrow: total - ready }} />}
                  {ready > 0 && <span className="td-week-ready" style={{ flexGrow: ready }} />}
                </div>
              )}
            </div>
            <time dateTime={day} aria-hidden="true">
              {dayFmt(day, { weekday: "short" })}<strong>{Number(day.slice(8, 10))}</strong>
            </time>
          </li>
        ))}
      </ul>
      <div className="td-week-legend">
        <span><i className="td-week-ready" />Ready or live</span>
        <span><i className="td-week-pending" />Not ready</span>
      </div>
    </>
  );
}

function Performance({ mode }: { mode: "team" | "me" }) {
  const [opened, setOpened] = useState(false);
  return (
    <details className="sh-card td-performance" id="performance"
      onToggle={(event) => { if (event.currentTarget.open) setOpened(true); }}>
      <DisclosureSummary>{mode === "team" ? "Social media performance" : "My performance"}</DisclosureSummary>
      {opened && <SocialKpis mode={mode} />}
    </details>
  );
}

/* ── Create menu ── */
function CreateMenu({ items }: { items: { label: string; href: string; icon: Icon }[] }) {
  const [open, setOpen] = useDisclosure(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (!items.length) return null;
  return (
    <div className="td-create" ref={ref}>
      <button type="button" className="sh-btn pri" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Ic i={Add01Icon} size={17} />Create<Ic i={ArrowDown01Icon} size={15} />
      </button>
      {open && (
        <div className="sh-pop td-createpop" role="menu">
          <div className="sh-menu">
            {items.map((it) => <Link key={it.label} href={it.href} role="menuitem" onClick={() => setOpen(false)}><Ic i={it.icon} />{it.label}</Link>)}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Today() {
  const { me, roles, rolesReady } = useShell();
  const rolesKey = roles.join(",");
  const can = (a: Parameters<typeof rolesCan>[1]) => rolesCan(roles, a);
  const isAdmin = roles.includes("admin");
  const canSocial = can("social"), canContact = can("contact"), canLeads = can("leads"), canContent = can("content"), canRenewals = can("renewals");
  const teamHome = roles.length > 0 && !canContent && canSocial;
  const ready = rolesReady;

  const today = useSource<TodayData>(() => api.today(), ready && canSocial, rolesKey);
  const ov = useSource<Overview>(() => api.overview(), ready && (canContent || canContact || canLeads), rolesKey);
  const mine = useMyWork(me?.id ?? null, ready && teamHome);

  /* Greeting + date in India time. */
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); }, []);
  const hour = now ? Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: IST }).format(now)) : 12;
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (me?.name || "").trim().split(/\s+/)[0];
  const todayIso = today.data?.today || istIso();

  const t = today.data, o = ov.data;

  /* ── retry a failed auto-post ── */
  const retry = useCallback(async (n: TodayNeed) => {
    try {
      await api.retryJob(n.id);
      toast("Trying again now", "ok", { description: `${n.client || ""}${n.platform ? ` · ${n.platform === "instagram" ? "Instagram" : n.platform === "facebook" ? "Facebook" : n.platform}` : ""}`.replace(/^ · /, "") || undefined });
      today.setData((d) => ({ ...d, needsYou: d.needsYou.filter((x) => !(x.kind === "failed" && x.id === n.id)) }));
      window.dispatchEvent(new Event("fv-badges"));
    } catch (e) { toast("Couldn't retry it", "err", { description: msg(e) }); }
  }, [today]);

  /* Keep actionable items in priority order. */
  const needs = useMemo<Need[]>(() => {
    const out: Need[] = [];
    const items = t?.needsYou || [];
    for (const n of items.filter((x) => x.kind === "failed")) {
      const retryable = n.status === "failed" || n.status === "missed";
      out.push({
        key: `f${n.id}`, postId: n.postId, tone: "red", icon: Alert02Icon, title: n.title,
        pill: { text: n.status === "check" ? "Check it posted" : n.status === "missed" ? "Missed" : "Failed", tone: n.status === "check" ? "amber" : "red" },
        meta: n.sub,
        action: retryable ? { label: "Retry now", run: () => retry(n), primary: true } : { label: "Check post", href: n.link },
      });
    }
    const appr = items.filter((x) => x.kind === "approval");
    const apprCount = isAdmin ? Math.max(appr.length, t?.counts.approvals || 0) : appr.length;
    if (apprCount === 1 && appr[0]) {
      const a = appr[0];
      out.push({ key: `a${a.id}`, postId: a.postId ?? a.id, tone: "violet", icon: CheckmarkCircle02Icon, title: a.title.replace(/^Approve: /, "Approve “") + (a.title.startsWith("Approve: ") ? "”" : ""), pill: { text: "Pending approval", tone: "violet" }, meta: a.sub, action: { label: "Review", href: a.link } });
    } else if (apprCount > 0) {
      const brands = [...new Set(appr.map((x) => x.client).filter(Boolean))];
      out.push({
        key: "appr", tone: "violet", icon: CheckmarkCircle02Icon, title: `${plural(apprCount, "post is", "posts are")} waiting for your approval`,
        pill: appr[0] ? { text: appr[0].sub.split(" · ").pop() || "Pending approval", tone: "violet" } : { text: "Pending approval", tone: "violet" },
        meta: brands.join(", "), action: { label: "Review posts", href: appr.length === 1 ? appr[0].link : "/dashboard/social" },
      });
    }
    const overdue = teamHome ? 0 : t?.counts.overdue || 0;
    if (overdue > 0) {
      out.push({
        key: "late", tone: "amber", icon: Clock01Icon,
        title: `${plural(overdue, "post")} past the go-live date`,
        meta: "Overdue",
      });
    }
    for (const n of items.filter((x) => x.kind === "atRisk")) {
      out.push({ key: `r${n.id}`, postId: n.postId ?? n.id, tone: "amber", icon: Clock01Icon, title: n.title, pill: { text: "At risk", tone: "amber" }, meta: n.sub, action: { label: "Open post", href: n.link } });
    }
    for (const l of (o?.leads?.due || []).slice(0, 3)) {
      const d = String(l.nextFollowUpAt || "").slice(0, 10);
      const late = d && d < todayIso ? daysBetween(d, todayIso) : 0;
      out.push({
        key: `l${l.id}`, tone: late ? "red" : "blue", icon: CallIcon, title: `Follow up · ${l.name}${l.company ? `, ${l.company}` : ""}`,
        pill: { text: late ? `${plural(late, "day")} overdue` : "Due today", tone: late ? "red" : "amber" },
        meta: l.followUpNote || (l.value ? `Est. ${inr(l.value)}` : l.stage), action: { label: "Follow up", href: `/dashboard/leads?lead=${l.id}` },
      });
    }
    const dueTotal = (o?.leads?.followUpToday || 0) + (o?.leads?.followUpOverdue || 0);
    const dueShown = Math.min(3, o?.leads?.due?.length || 0);
    if (dueTotal > dueShown) {
      out.push({ key: "lmore", tone: "blue", icon: Target02Icon, title: `${plural(dueTotal - dueShown, "more lead follow-up", "more lead follow-ups")} due`, meta: "Today and overdue", action: { label: "Open leads", href: "/dashboard/leads" } });
    }
    for (const n of items.filter((x) => x.kind === "renewal").slice(0, 2)) {
      const d = n.renewalDate || "";
      const late = d && d < todayIso ? daysBetween(d, todayIso) : 0;
      const inDays = d && d > todayIso ? daysBetween(todayIso, d) : 0;
      out.push({
        key: `n${n.id}`, tone: late ? "red" : "amber", icon: RepeatIcon, title: n.title,
        pill: { text: late ? `${plural(late, "day")} overdue` : d === todayIso ? "Due today" : `In ${plural(inDays, "day")}`, tone: late ? "red" : "amber" },
        meta: n.sub.split(" · ").filter((s) => !/due /.test(s)).join(" · "), action: { label: "Open renewals", href: n.link },
      });
    }
    const dueIds = new Set((o?.leads?.due || []).map((l) => l.id));
    for (const l of (o?.leads?.fresh || []).filter((x) => !dueIds.has(x.id)).slice(0, 2)) {
      out.push({
        key: `nl${l.id}`, tone: "blue", icon: UserAdd01Icon, title: `New lead · ${l.name}${l.company ? `, ${l.company}` : ""}`,
        pill: { text: l.source || "New", tone: "blue" }, meta: l.value ? `Est. ${inr(l.value)}` : undefined, action: { label: "Open lead", href: `/dashboard/leads?lead=${l.id}` },
      });
    }
    return out;
  }, [t, o, isAdmin, teamHome, todayIso, retry]);

  const createItems = [
    canContent && { label: "New case study", href: "/dashboard/projects", icon: Briefcase01Icon },
    canContent && { label: "Write a blog post", href: "/dashboard/blog", icon: News01Icon },
    canLeads && { label: "Add a lead", href: "/dashboard/leads", icon: Target02Icon },
    canSocial && { label: "Import a content sheet", href: "/dashboard/social", icon: Upload01Icon },
    canRenewals && { label: "Add a renewal", href: "/dashboard/renewals", icon: RepeatIcon },
  ].filter(Boolean) as { label: string; href: string; icon: Icon }[];

  const bare = ready && !canSocial && !canContact && !canLeads && !canContent;
  const showNeeds = (canSocial && t) || (canLeads && o);
  const showWeek = canSocial && t;
  const showMessages = canContact && o;
  const showPipeline = canLeads && o;
  const showContent = canContent && o;
  const alertPostIds = new Set(needs.map((need) => need.postId));
  const queue = mine.data?.queue.filter(({ p }) => !alertPostIds.has(p.id)) || [];

  const by = o?.leads?.byStage || {};
  const stageRows = STAGES.map((s) => ({ ...s, n: by[s.id]?.count || 0, v: by[s.id]?.value || 0 }));
  const pipelineValue = OPEN_STAGES.reduce((sum, stage) => sum + (by[stage]?.value || 0), 0);
  const closedLeads = (by.won?.count || 0) + (by.lost?.count || 0);
  const winRate = closedLeads ? Math.round(((by.won?.count || 0) / closedLeads) * 100) : null;
  const content = [
    { key: "projects", label: "Portfolio" },
    { key: "services", label: "Services" },
    { key: "testimonials", label: "Testimonials" },
    { key: "team", label: "Website team" },
    { key: "blog", label: "Blog posts" },
  ].map((item) => ({ ...item, count: o?.counts?.[item.key] || 0 }));
  const contentMax = Math.max(1, ...content.map((item) => item.count));
  const unread = o?.contact?.unread || 0;
  const isLoading = !ready || (canSocial && !t && !today.error) ||
    ((canContent || canContact || canLeads) && !o && !ov.error) || (teamHome && !mine.data && !mine.error);
  const date = now?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: IST });

  return (
    <div className="td">
      <WorkspaceHero eyebrow={date || "Overview"} title={teamHome ? "My work" : "Dashboard"}
        description={first && now ? `${hello}, ${first}.` : undefined}
        actions={ready && createItems.length ? <CreateMenu items={createItems} /> : undefined} />

      {isLoading ? <PageLoading label="Loading your workspace…" variant="panel" count={3} /> : bare ? (
        <section className="sh-card" aria-labelledby="td-pages">
          <div className="sh-card-h"><h2 id="td-pages">Your pages</h2></div>
          <div className="td-links">
            {can("seo") && <Link href="/dashboard/seo" className="sh-btn"><Ic i={Search01Icon} size={17} />SEO</Link>}
            {can("settings") && <Link href="/dashboard/settings" className="sh-btn"><Ic i={Settings02Icon} size={17} />Settings &amp; pixels</Link>}
            {canRenewals && <Link href="/dashboard/renewals" className="sh-btn"><Ic i={RepeatIcon} size={17} />Renewals</Link>}
            <Link href="/dashboard/account" className="sh-btn">My account</Link>
          </div>
        </section>
      ) : (
        <>
          {canSocial && !t && today.error && <CardError text={`Content calendar: ${today.error}`} onRetry={today.reload} />}
          {(canContent || canContact || canLeads) && !o && ov.error && (
            <CardError text={`Website overview: ${ov.error}`} onRetry={ov.reload} />
          )}
          {(showNeeds || teamHome || showWeek || showMessages) && <div className="td-home-grid">
            {(showNeeds || teamHome) && <div className="td-home-column">
              {showNeeds && <section className="sh-card" aria-labelledby="td-needs">
                <div className="sh-card-h">
                  <h2 id="td-needs">Needs attention</h2>
                </div>
                {needs.length > 0 ? (
                  <div className="td-needs">{needs.map((need) => <NeedRow key={need.key} n={need} />)}</div>
                ) : (
                  <div className="sh-empty"><Ic i={CheckmarkCircle02Icon} size={20} /><b>No urgent items</b></div>
                )}
              </section>}
              {teamHome && (
                <section className="sh-card" aria-labelledby="td-queue">
                  <div className="sh-card-h"><h2 id="td-queue">My queue
                    {!!mine.data?.overdue && <small>{plural(mine.data.overdue, "assigned post")} past the go-live date</small>}
                  </h2><Link href="/dashboard/social?assigned=me" className="sh-link">View assigned posts<Ic i={ArrowRight01Icon} size={15} /></Link></div>
                  {mine.error && !mine.data ? <CardError text={mine.error} onRetry={mine.reload} />
                    : <MyQueue queue={queue} emptyText={mine.data?.queue.length ? "Your assigned posts are listed under Needs attention." : undefined} />}
                </section>
              )}
            </div>}
            {(showWeek || showMessages) && <div className="td-home-column">
              {showWeek && (
                <section className="sh-card" aria-labelledby="td-week">
                  <div className="sh-card-h">
                    <h2 id="td-week">Publishing this week
                      <small>{dayFmt(showWeek.weekFrom, { day: "numeric", month: "short" })} – {dayFmt(showWeek.weekTo, { day: "numeric", month: "short" })}{showWeek.counts.goingLiveWeek > 0 && ` · ${plural(showWeek.counts.goingLiveWeek, "post")}`}</small>
                    </h2>
                    <Link href="/dashboard/social" className="sh-link">Open calendar<Ic i={ArrowRight01Icon} size={15} /></Link>
                  </div>
                  {showWeek.counts.goingLiveWeek > 0 ? <PublishingWeek data={showWeek} /> : (
                    <div className="sh-empty"><Ic i={Calendar03Icon} size={20} /><b>No posts scheduled to go live</b></div>
                  )}
                </section>
              )}
              {showMessages && (
                <section className="sh-card" aria-labelledby="td-msgs">
                  <div className="sh-card-h">
                    <h2 id="td-msgs">Recent messages{unread > 0 && <small>{unread} unread</small>}</h2>
                    <Link href="/dashboard/contact" className="sh-link">Open inbox<Ic i={ArrowRight01Icon} size={15} /></Link>
                  </div>
                  {!showMessages.contact?.recent.length ? <div className="sh-empty"><Ic i={Mail01Icon} size={20} /><b>No messages yet</b></div>
                      : <div>{showMessages.contact.recent.slice(0, 4).map((m) => (
                        <Link key={m.id} href={`/dashboard/contact?msg=${m.id}`} className="td-msg">
                          <span className="sh-av" style={{ background: avColor(m.name), width: 32, height: 32, fontSize: 11 }}>{initials(m.name)}</span>
                          <span className="td-msg-tx"><b>{m.name}</b><small>{[m.projectType, m.message || m.email].filter(Boolean).join(" · ")}</small></span>
                          {m.isRead ? <small className="td-msg-d">{dateFmt(m.createdAt)}</small> : <span className="sh-pill blue">New</span>}
                        </Link>
                      ))}</div>}
                </section>
              )}
            </div>}
          </div>}

          {(showPipeline || showContent) && <div className="td-home-grid">
            {showPipeline && (
              <section className="sh-card" aria-labelledby="td-leads">
                <div className="sh-card-h">
                  <h2 id="td-leads">Leads pipeline
                    {!!showPipeline.leads?.total && <small>{inr(pipelineValue)} in open leads{winRate == null ? "" : ` · ${winRate}% win rate`}</small>}
                  </h2>
                  <Link href="/dashboard/leads" className="sh-link">Open leads<Ic i={ArrowRight01Icon} size={15} /></Link>
                </div>
                {!showPipeline.leads?.total ? <div className="sh-empty"><Ic i={Target02Icon} size={20} /><b>No leads yet</b></div>
                    : <dl className="td-stages">
                      {stageRows.map((s) => (
                        <div key={s.id} className="td-stg">
                          <dt><i style={{ background: s.c }} />{s.name}</dt>
                          <dd><b>{s.n}<span className="td-visually-hidden"> leads</span></b><span>{inrShort(s.v)}</span></dd>
                        </div>
                      ))}
                    </dl>}
              </section>
            )}
            {showContent && (
              <section className="sh-card" aria-labelledby="td-content">
                <div className="sh-card-h">
                  <h2 id="td-content">Website content
                    <small>{plural(content.reduce((sum, item) => sum + item.count, 0), "item")}</small>
                  </h2>
                </div>
                <div className="td-bars">{content.map((item) => (
                    <Link key={item.key} href={`/dashboard/${item.key}`} className="td-barrow">
                      <span>{item.label}</span>
                      <span className="td-track" aria-hidden="true"><i style={{ width: `${(item.count / contentMax) * 100}%` }} /></span>
                      <b>{item.count}</b>
                    </Link>
                  ))}</div>
              </section>
            )}
          </div>}
          {(isAdmin || teamHome) && <Performance mode={isAdmin ? "team" : "me"} />}
        </>
      )}
    </div>
  );
}
