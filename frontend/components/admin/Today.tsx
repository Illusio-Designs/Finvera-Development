"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon, Alert02Icon, CheckmarkCircle02Icon, RupeeIcon, Clock01Icon, RepeatIcon, UserAdd01Icon, Target02Icon,
  Calendar03Icon, Add01Icon, ArrowRight01Icon, ArrowDown01Icon, Upload01Icon, News01Icon, Briefcase01Icon, Rocket01Icon,
  Task01Icon, Refresh01Icon, CallIcon, LayoutTable01Icon, Search01Icon, Settings02Icon,
} from "@hugeicons/core-free-icons";
import { api, type Overview, type Today as TodayData, type TodayNeed } from "@/lib/adminApi";
import { useShell } from "@/components/admin/shell/ShellContext";
import { initials, type Icon } from "@/components/admin/shell/nav";
import { useMyWork, MyQueue, istIso } from "@/components/admin/MyWork";
import SocialKpis from "@/components/admin/SocialKpis";
import { rolesCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";

/* Dashboard home ("Today"). Two requests at most, side by side:
   GET /api/today (social area) and GET /api/overview (content / contact /
   leads), each skipped when the roles can't see it. A team member also
   loads their own assigned posts (light card fields) to see their work
   first. Each card shows its own skeleton, empty state and error. */

type Src<T> = { data: T | null; error: string; loading: boolean };
const idle = <T,>(): Src<T> => ({ data: null, error: "", loading: false });
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

function useSource<T>(run: () => Promise<T>, enabled: boolean, key: string) {
  const [s, setS] = useState<Src<T>>(idle<T>());
  const runRef = useRef(run);
  runRef.current = run;
  const load = useCallback(async () => {
    setS((p) => ({ ...p, loading: true, error: "" }));
    try { const data = await runRef.current(); setS({ data, error: "", loading: false }); }
    catch (e) { setS((p) => ({ ...p, error: msg(e), loading: false })); }
  }, []);
  useEffect(() => { if (enabled) load(); else setS(idle<T>()); }, [enabled, key, load]);
  return { ...s, reload: load, setData: (fn: (d: T) => T) => setS((p) => (p.data ? { ...p, data: fn(p.data) } : p)) };
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

function CardError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="sh-empty err" role="alert">
      <Ic i={Alert02Icon} size={20} />
      <b>Couldn&apos;t load this</b>
      <span>{text}</span>
      <button type="button" className="sh-btn sm" onClick={onRetry}><Ic i={Refresh01Icon} size={15} />Try again</button>
    </div>
  );
}
const SkelRows = ({ n = 4, h = 44 }: { n?: number; h?: number }) => (
  <div aria-busy="true" aria-label="Loading" style={{ display: "grid", gap: 14 }}>
    {Array.from({ length: n }).map((_, i) => (
      <div key={i} style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <span className="skel" style={{ width: h - 4, height: h - 4, borderRadius: 12, flex: "none" }} />
        <span style={{ flex: 1, display: "grid", gap: 7 }}>
          <span className="skel skel-line" style={{ width: `${70 - i * 8}%` }} />
          <span className="skel skel-line" style={{ width: `${45 - i * 4}%`, height: 10 }} />
        </span>
      </div>
    ))}
  </div>
);

/* ── KPI card ── */
type Kpi = { key: string; label: string; icon: Icon; tone: "red" | "violet" | "blue" | "amber" | "green"; href: string; value?: string | number; sub?: string; loading?: boolean; error?: boolean };
function KpiCard({ k, hero }: { k: Kpi; hero: boolean }) {
  return (
    <Link href={k.href} className={"td-kpi " + (hero ? "td-hero" : k.tone)} aria-busy={k.loading || undefined}>
      <span className="td-k"><span className="td-kic"><Ic i={k.icon} size={17} /></span>{k.label}</span>
      {k.loading ? <span className="skel" style={{ width: 70, height: 34, borderRadius: 9, margin: "6px 0 4px", opacity: hero ? 0.5 : 1 }} />
        : <span className="td-v">{k.error ? "—" : k.value}</span>}
      {k.loading ? <span className="skel skel-line" style={{ width: "70%", height: 10, opacity: hero ? 0.5 : 1 }} />
        : <span className="td-s">{k.error ? "Couldn't load" : k.sub}</span>}
    </Link>
  );
}

/* ── Needs you ── */
type Need = {
  key: string; tone: "red" | "violet" | "amber" | "blue" | "green"; icon: Icon; title: string;
  pill?: { text: string; tone: string }; meta?: string;
  action: { label: string; href: string } | { label: string; run: () => Promise<void>; primary?: boolean };
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
      {"href" in a
        ? <Link href={a.href} className="sh-btn sm">{a.label}<Ic i={ArrowRight01Icon} size={15} /></Link>
        : <button type="button" className={"sh-btn sm" + (a.primary ? " pri" : "")} disabled={busy}
          onClick={async () => { setBusy(true); try { await a.run(); } finally { setBusy(false); } }}>
          {busy ? "Working…" : a.label}<Ic i={ArrowRight01Icon} size={15} />
        </button>}
    </div>
  );
}

/* ── This-week chart (Mon–Sun, today highlighted) ── */
function WeekChart({ week, today }: { week: TodayData["week"]; today: string }) {
  const router = useRouter();
  const open = () => router.push("/dashboard/social");
  const W = 560, H = 200, pl = 26, pb = 34, pt = 22, bw = 46, gap = (W - pl - 7 * bw) / 7;
  const max = Math.max(4, ...week.map((w) => w.total));
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  const label = week.map((w) => `${dayFmt(w.day, { weekday: "long" })}: ${w.total} (${w.ready} ready)`).join("; ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Posts going live each day this week. ${label}`} className="td-chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W} y1={y(t)} y2={y(t)} stroke="var(--td-line)" strokeDasharray={t ? "3 4" : undefined} />
          <text x={pl - 8} y={y(t) + 4} textAnchor="end">{t}</text>
        </g>
      ))}
      {week.map((w, i) => {
        const x = pl + gap / 2 + i * (bw + gap);
        const making = Math.max(0, w.total - w.ready);
        const yr = y(w.ready), ym = y(w.total);
        const isT = w.day === today;
        return (
          <g key={w.day} className="td-day" role="link" tabIndex={0} onClick={open}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
            aria-label={`${dayFmt(w.day, { weekday: "long", day: "numeric", month: "long" })}: ${plural(w.total, "post")}, ${w.ready} ready. Open the calendar`}>
              {isT && <rect x={x - 6} y={pt - 14} width={bw + 12} height={H - pb - pt + 14} rx={12} fill="var(--td-brand-soft)" />}
              <rect x={x - 4} y={pt - 14} width={bw + 8} height={H - pb - pt + 14} fill="transparent" />
              {w.ready > 0 && <rect x={x} y={yr} width={bw} height={y(0) - yr} rx={8} fill="var(--td-brand)" />}
              {making > 0 && <rect x={x + 1} y={ym + 1} width={bw - 2} height={Math.max(2, yr - ym - 3)} rx={8} fill="var(--td-amber-bg)" stroke="var(--td-amber)" strokeDasharray="4 3" />}
              {w.total > 0 && <text className="lbl" x={x + bw / 2} y={ym - 6} textAnchor="middle">{w.total}</text>}
              <text x={x + bw / 2} y={H - 14} textAnchor="middle" className={isT ? "now" : undefined}>{isT ? "Today" : dayFmt(w.day, { weekday: "short" })}</text>
              <text x={x + bw / 2} y={H - 1} textAnchor="middle">{Number(w.day.slice(8, 10))}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* Mounts SocialKpis only when it scrolls near the screen (saves a request). */
function LazyKpis({ mode }: { mode: "team" | "me" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || show) return;
    if (!("IntersectionObserver" in window)) { setShow(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, [show]);
  return <div ref={ref} className="td-kpis-perf" id="performance">{show ? <SocialKpis mode={mode} /> : <div className="sh-card"><SkelRows n={2} /></div>}</div>;
}

/* ── Create menu ── */
function CreateMenu({ items }: { items: { label: string; href: string; icon: Icon }[] }) {
  const [open, setOpen] = useState(false);
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

  /* ── Needs you (most urgent first) ── */
  const needs = useMemo<Need[]>(() => {
    const out: Need[] = [];
    const items = t?.needsYou || [];
    for (const n of items.filter((x) => x.kind === "failed")) {
      const retryable = n.status === "failed" || n.status === "missed";
      out.push({
        key: `f${n.id}`, tone: "red", icon: Alert02Icon, title: n.title,
        pill: { text: n.status === "check" ? "Check it posted" : n.status === "missed" ? "Missed" : "Failed", tone: n.status === "check" ? "amber" : "red" },
        meta: n.sub,
        action: retryable ? { label: "Retry now", run: () => retry(n), primary: true } : { label: "Check post", href: n.link },
      });
    }
    const appr = items.filter((x) => x.kind === "approval");
    const apprCount = isAdmin ? Math.max(appr.length, t?.counts.approvals || 0) : appr.length;
    if (apprCount === 1 && appr[0]) {
      const a = appr[0];
      out.push({ key: `a${a.id}`, tone: "violet", icon: CheckmarkCircle02Icon, title: a.title.replace(/^Approve: /, "Approve “") + (a.title.startsWith("Approve: ") ? "”" : ""), pill: { text: "Pending approval", tone: "violet" }, meta: a.sub, action: { label: "Review", href: a.link } });
    } else if (apprCount > 1) {
      const brands = [...new Set(appr.map((x) => x.client).filter(Boolean))];
      out.push({
        key: "appr", tone: "violet", icon: CheckmarkCircle02Icon, title: `${apprCount} posts are waiting for your approval`,
        pill: appr[0] ? { text: appr[0].sub.split(" · ").pop() || "Pending approval", tone: "violet" } : { text: "Pending approval", tone: "violet" },
        meta: brands.join(", "), action: { label: `Review ${apprCount}`, href: appr.length === 1 ? appr[0].link : "/dashboard/social" },
      });
    }
    const overdue = teamHome ? mine.data?.overdue || 0 : t?.counts.overdue || 0;
    if (overdue > 0) {
      out.push({
        key: "late", tone: "amber", icon: Clock01Icon,
        title: teamHome ? `${plural(overdue, "of your posts is", "of your posts are")} past the go-live date` : `${plural(overdue, "post")} past the go-live date`,
        pill: { text: "Overdue", tone: "amber" }, meta: "Not posted yet", action: { label: "Open calendar", href: "/dashboard/social" },
      });
    }
    for (const n of items.filter((x) => x.kind === "atRisk")) {
      out.push({ key: `r${n.id}`, tone: "amber", icon: Clock01Icon, title: n.title, pill: { text: "At risk", tone: "amber" }, meta: n.sub, action: { label: "Open post", href: n.link } });
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
    const unread = o?.contact?.unread || 0;
    if (unread > 0) {
      const un = (o?.contact?.recent || []).filter((m) => !m.isRead);
      out.push({
        key: "inbox", tone: "blue", icon: Mail01Icon, title: `${plural(unread, "unread message")} in the contact inbox`,
        meta: un.length ? `From ${[...new Set(un.map((m) => m.name))].join(", ")}` : undefined,
        action: { label: "Read", href: unread === 1 && un[0] ? `/dashboard/contact?msg=${un[0].id}` : "/dashboard/contact" },
      });
    }
    return out;
  }, [t, o, isAdmin, teamHome, mine.data, todayIso, retry]);

  /* ── KPIs: the four most useful for these roles ── */
  const kpis = useMemo<Kpi[]>(() => {
    const L = (s: Src<unknown>) => ({ loading: s.loading && !s.data, error: !!s.error && !s.data });
    const list: Kpi[] = [];
    if (teamHome) {
      const m = { loading: !mine.data && !mine.error, error: !!mine.error && !mine.data };
      const d = mine.data;
      list.push(
        { key: "now", label: "Work on now", icon: Task01Icon, tone: "blue", href: "/dashboard/social", value: d?.workNow ?? 0, sub: d ? (d.open ? `${plural(d.open, "open post")} across ${plural(d.brands, "brand")}` : "Nothing assigned right now") : "", ...m },
        { key: "late", label: "Overdue", icon: Alert02Icon, tone: "red", href: "/dashboard/social", value: d?.overdue ?? 0, sub: "Go-live date passed", ...m },
        { key: "start", label: "Starting this week", icon: Rocket01Icon, tone: "amber", href: "/dashboard/social", value: d?.startingSoon ?? 0, sub: "Start date in the next 7 days", ...m },
        { key: "live", label: "Going live this week", icon: Calendar03Icon, tone: "violet", href: "/dashboard/social", value: d?.goingLive ?? 0, sub: "Go-live in the next 7 days", ...m },
      );
      return list;
    }
    if (canContact) {
      const un = (o?.contact?.recent || []).find((m) => !m.isRead);
      list.push({ key: "unread", label: "Unread messages", icon: Mail01Icon, tone: "blue", href: "/dashboard/contact", value: o?.contact?.unread ?? 0, sub: o?.contact?.unread ? (un ? `Latest from ${un.name}, ${dateFmt(un.createdAt)}` : "In the contact inbox") : "Inbox zero", ...L(ov) });
    }
    if (canSocial) {
      list.push({ key: "late", label: "Overdue posts", icon: Alert02Icon, tone: "red", href: "/dashboard/social", value: t?.counts.overdue ?? 0, sub: "Past their date, not posted", ...L(today) });
      list.push({ key: "appr", label: "Waiting for approval", icon: CheckmarkCircle02Icon, tone: "violet", href: "/dashboard/social", value: t?.counts.approvals ?? 0, sub: isAdmin ? "Sent to you by the team" : "In Pending approval", ...L(today) });
    }
    if (canLeads) {
      const by = o?.leads?.byStage || {};
      const pipe = OPEN_STAGES.reduce((s, k) => s + (by[k]?.value || 0), 0);
      const openN = OPEN_STAGES.reduce((s, k) => s + (by[k]?.count || 0), 0);
      const fu = (o?.leads?.followUpToday || 0) + (o?.leads?.followUpOverdue || 0);
      list.push({ key: "pipe", label: "Leads pipeline", icon: RupeeIcon, tone: "blue", href: "/dashboard/leads", value: inrShort(pipe), sub: `${plural(openN, "open lead")} · ${fu ? `${plural(fu, "follow-up")} due` : `${by.won?.count || 0} won`}`, ...L(ov) });
      list.push({ key: "fu", label: "Follow-ups due", icon: CallIcon, tone: "amber", href: "/dashboard/leads", value: fu, sub: `${o?.leads?.followUpOverdue || 0} overdue · ${o?.leads?.followUpToday || 0} today`, ...L(ov) });
    }
    if (canSocial) {
      list.push({ key: "week", label: "Going live this week", icon: Calendar03Icon, tone: "blue", href: "/dashboard/social", value: t?.counts.goingLiveWeek ?? 0, sub: t ? `${t.counts.scheduledWeek} ready · ${Math.max(0, t.counts.goingLiveWeek - t.counts.scheduledWeek)} still being made` : "", ...L(today) });
      list.push({ key: "ontime", label: "On time this month", icon: CheckmarkCircle02Icon, tone: "green", href: "#performance", value: t?.counts.onTimeMonthPct == null ? "—" : `${t.counts.onTimeMonthPct}%`, sub: "Posts finished by their due date", ...L(today) });
    }
    if (canContent) {
      const c = o?.counts || {};
      list.push({ key: "content", label: "Website items", icon: LayoutTable01Icon, tone: "blue", href: "/dashboard/projects", value: Object.values(c).reduce((a, b) => a + (Number(b) || 0), 0), sub: `${c.projects || 0} projects · ${c.blog || 0} blog posts`, ...L(ov) });
    }
    return list.slice(0, 4);
  }, [teamHome, mine.data, mine.error, canContact, canSocial, canLeads, canContent, isAdmin, o, t, ov, today]);

  const createItems = [
    canContent && { label: "New project", href: "/dashboard/projects", icon: Briefcase01Icon },
    canContent && { label: "Write a blog post", href: "/dashboard/blog", icon: News01Icon },
    canLeads && { label: "Add a lead", href: "/dashboard/leads", icon: Target02Icon },
    canSocial && { label: "Import a content sheet", href: "/dashboard/social", icon: Upload01Icon },
    canRenewals && { label: "Add a renewal", href: "/dashboard/renewals", icon: RepeatIcon },
  ].filter(Boolean) as { label: string; href: string; icon: Icon }[];

  const needsLoading = !ready || (canSocial && today.loading && !t) || ((canContact || canLeads) && ov.loading && !o) || (teamHome && !mine.data && !mine.error);
  const needsErr = [canSocial && today.error && !t ? today : null, (canContact || canLeads) && ov.error && !o ? ov : null].filter(Boolean) as { error: string; reload: () => void }[];
  const weekTotal = t?.counts.goingLiveWeek ?? 0;
  const subline = [
    needsLoading ? null : needs.length ? `${plural(needs.length, "thing needs", "things need")} you today` : "Nothing needs you right now",
    canSocial && t ? `${plural(weekTotal, "post goes", "posts go")} live this week` : null,
  ].filter(Boolean).join(" · ");

  /* Nothing to show for this role (e.g. SEO): a short list of their pages. */
  const bare = ready && !canSocial && !canContact && !canLeads && !canContent;

  const by = o?.leads?.byStage || {};
  const stageRows = STAGES.map((s) => ({ ...s, n: by[s.id]?.count || 0, v: by[s.id]?.value || 0 }));
  const totalV = stageRows.reduce((a, s) => a + s.v, 0);
  const won = by.won?.count || 0, lost = by.lost?.count || 0;
  const content = (["projects", "services", "testimonials", "team", "blog"] as const).map((k) => ({ k, label: k === "blog" ? "Blog posts" : k[0].toUpperCase() + k.slice(1), n: o?.counts?.[k] || 0 }));
  const cmax = Math.max(1, ...content.map((c) => c.n));

  return (
    <div className="td">
      <div className="td-hello">
        <div className="td-hello-tx">
          <div className="td-eyebrow">{now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: IST }) : " "}</div>
          <h1>{hello}{first ? `, ${first}` : ""}</h1>
          <p>{subline || " "}</p>
        </div>
        <div className="td-acts">
          {canSocial && <Link href="/dashboard/social" className="sh-btn"><Ic i={Calendar03Icon} size={17} />Open calendar</Link>}
          <CreateMenu items={createItems} />
        </div>
      </div>

      {!ready ? (
        <div className="td-kpis">{[0, 1, 2, 3].map((i) => <KpiCard key={i} hero={i === 0} k={{ key: String(i), label: " ", icon: Task01Icon, tone: "blue", href: "#", loading: true }} />)}</div>
      ) : kpis.length > 0 && (
        <div className="td-kpis">{kpis.map((k, i) => <KpiCard key={k.key} k={k} hero={i === 0} />)}</div>
      )}

      {bare ? (
        <section className="sh-card">
          <div className="sh-card-h"><h2>Your pages<small>Jump straight to your work</small></h2></div>
          <div className="td-links">
            {can("seo") && <Link href="/dashboard/seo" className="sh-btn"><Ic i={Search01Icon} size={17} />SEO</Link>}
            {can("settings") && <Link href="/dashboard/settings" className="sh-btn"><Ic i={Settings02Icon} size={17} />Settings &amp; pixels</Link>}
            {can("renewals") && <Link href="/dashboard/renewals" className="sh-btn"><Ic i={RepeatIcon} size={17} />Renewals</Link>}
          </div>
        </section>
      ) : (
        <div className="td-grid">
          <div className="td-col">
            <section className="sh-card" aria-labelledby="td-needs">
              <div className="sh-card-h"><h2 id="td-needs">Needs you<small>{needsLoading ? "Checking…" : needs.length ? `${plural(needs.length, "item")} · most urgent first` : "Nothing waiting on you"}</small></h2></div>
              {needsLoading ? <SkelRows n={4} /> : (
                <>
                  {needsErr.map((s, i) => <div key={i} style={{ marginBottom: 12 }}><CardError text={s.error} onRetry={s.reload} /></div>)}
                  {needs.length > 0 ? <div className="td-needs">{needs.map((n) => <NeedRow key={n.key} n={n} />)}</div>
                    : !needsErr.length && <div className="sh-empty"><Ic i={CheckmarkCircle02Icon} size={20} /><b>All clear</b><span>Nothing needs you right now. New approvals, failed posts and follow-ups show up here.</span></div>}
                </>
              )}
            </section>

            {teamHome && (
              <section className="sh-card" aria-labelledby="td-queue">
                <div className="sh-card-h"><h2 id="td-queue">My queue<small>Posts assigned to you, most urgent first</small></h2><Link href="/dashboard/social" className="sh-link">Open calendar<Ic i={ArrowRight01Icon} size={15} /></Link></div>
                {mine.error && !mine.data ? <CardError text={mine.error} onRetry={mine.reload} /> : !mine.data ? <SkelRows n={4} h={36} /> : <MyQueue data={mine.data} />}
              </section>
            )}

            {canSocial && (
              <section className="sh-card td-chartcard" aria-labelledby="td-week">
                <div className="sh-card-h">
                  <h2 id="td-week">Posts going live this week<small>{t ? `${dayFmt(t.weekFrom, { day: "numeric", month: "short" })} – ${dayFmt(t.weekTo, { day: "numeric", month: "short" })} · tap a day to open the calendar` : "This week"}</small></h2>
                  <div className="td-legend"><span><i style={{ background: "var(--td-brand)" }} />Ready</span><span><i className="dash" />Still being made</span></div>
                </div>
                {today.error && !t ? <CardError text={today.error} onRetry={today.reload} />
                  : !t ? <span className="skel" style={{ height: 200, borderRadius: 14 }} />
                    : t.week.every((w) => !w.total) ? <div className="sh-empty"><Ic i={Calendar03Icon} size={20} /><b>Nothing goes live this week</b><span>Posts with a go-live date this week will show here.</span></div>
                      : <WeekChart week={t.week} today={t.today} />}
              </section>
            )}

            {canLeads && (
              <section className="sh-card" aria-labelledby="td-leads">
                <div className="sh-card-h">
                  <h2 id="td-leads">Leads pipeline<small>{o?.leads ? `${inr(totalV)} across ${plural(o.leads.total, "lead")} · win rate ${won + lost ? Math.round((won / (won + lost)) * 100) : 0}%` : "By stage"}</small></h2>
                  <Link href="/dashboard/leads" className="sh-link">Open leads<Ic i={ArrowRight01Icon} size={15} /></Link>
                </div>
                {ov.error && !o ? <CardError text={ov.error} onRetry={ov.reload} />
                  : !o ? <SkelRows n={2} />
                    : !o.leads?.total ? <div className="sh-empty"><Ic i={Target02Icon} size={20} /><b>No leads yet</b><span>Leads from the website form and the ones you add show up here.</span><Link href="/dashboard/leads" className="sh-btn sm">Add a lead</Link></div>
                      : <>
                        {totalV > 0 && <div className="td-stack" role="img" aria-label="Pipeline value by stage">{stageRows.filter((s) => s.v).map((s) => <i key={s.id} style={{ width: `${(s.v / totalV) * 100}%`, background: s.c }} title={`${s.name}: ${inr(s.v)}`} />)}</div>}
                        <div className="td-stages">
                          {stageRows.map((s) => (
                            <Link key={s.id} href="/dashboard/leads" className="td-stg">
                              <small><i style={{ background: s.c }} />{s.name}</small>
                              <b>{s.n}</b>
                              <span>{inrShort(s.v)}</span>
                            </Link>
                          ))}
                        </div>
                      </>}
              </section>
            )}
          </div>

          <div className="td-col">
            {canContact && (
              <section className="sh-card" aria-labelledby="td-msgs">
                <div className="sh-card-h"><h2 id="td-msgs">Recent messages</h2><Link href="/dashboard/contact" className="sh-link">View all<Ic i={ArrowRight01Icon} size={15} /></Link></div>
                {ov.error && !o ? <CardError text={ov.error} onRetry={ov.reload} />
                  : !o ? <SkelRows n={4} h={36} />
                    : !o.contact?.recent.length ? <div className="sh-empty"><Ic i={Mail01Icon} size={20} /><b>No messages yet</b><span>Messages from the website contact form land here.</span></div>
                      : <div>{o.contact.recent.slice(0, 4).map((m) => (
                        <Link key={m.id} href={`/dashboard/contact?msg=${m.id}`} className="td-msg">
                          <span className="sh-av" style={{ background: avColor(m.name), width: 32, height: 32, fontSize: 11 }}>{initials(m.name)}</span>
                          <span className="td-msg-tx"><b>{m.name}</b><small>{[m.projectType, m.message || m.email].filter(Boolean).join(" · ")}</small></span>
                          {m.isRead ? <small className="td-msg-d">{dateFmt(m.createdAt)}</small> : <span className="sh-pill blue">New</span>}
                        </Link>
                      ))}</div>}
              </section>
            )}

            {canSocial && (
              <section className="sh-card" aria-labelledby="td-team">
                <div className="sh-card-h"><h2 id="td-team">{t && t.team.length === 1 ? "You this month" : "Team this month"}<small>Posts finished by their due date · line marks the 90% goal</small></h2></div>
                {today.error && !t ? <CardError text={today.error} onRetry={today.reload} />
                  : !t ? <SkelRows n={3} h={34} />
                    : !t.team.length ? <div className="sh-empty"><Ic i={CheckmarkCircle02Icon} size={20} /><b>No finished posts yet this month</b><span>On-time rates show once posts move to Posted.</span></div>
                      : <div>{t.team.map((p) => {
                        const pct = p.onTimePct;
                        const col = pct == null ? "var(--td-faint)" : pct >= 90 ? "var(--td-green)" : pct >= 75 ? "var(--td-amber)" : "var(--td-red)";
                        const onTime = pct == null ? 0 : Math.round((pct * p.delivered) / 100);
                        return (
                          <div key={p.id} className="td-perf">
                            {p.avatar
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img className="sh-av" src={p.avatar} alt="" style={{ width: 32, height: 32 }} />
                              : <span className="sh-av" style={{ background: avColor(p.name), width: 32, height: 32, fontSize: 11 }}>{initials(p.name)}</span>}
                            <div className="td-perf-m">
                              <b>{p.name}<small>{p.delivered ? `${onTime} of ${p.delivered} on time` : "Nothing finished yet"}{p.overdue ? ` · ${p.overdue} overdue` : ""}</small></b>
                              <div className="td-track goal"><i style={{ width: `${pct ?? 0}%`, background: col }} /></div>
                            </div>
                            <span className="td-pct" style={{ color: col }}>{pct == null ? "—" : `${pct}%`}</span>
                          </div>
                        );
                      })}</div>}
              </section>
            )}

            {canContent && (
              <section className="sh-card" aria-labelledby="td-content">
                <div className="sh-card-h"><h2 id="td-content">Content breakdown<small>{o ? `${plural(content.reduce((a, c) => a + c.n, 0), "item")} on the website` : "Website content"}</small></h2></div>
                {ov.error && !o ? <CardError text={ov.error} onRetry={ov.reload} />
                  : !o ? <SkelRows n={4} h={22} />
                    : <div className="td-bars">{content.map((c) => (
                      <Link key={c.k} href={`/dashboard/${c.k}`} className="td-barrow">
                        <span>{c.label}</span>
                        <span className="td-track"><i style={{ width: `${(c.n / cmax) * 100}%` }} /></span>
                        <b>{c.n}</b>
                      </Link>
                    ))}</div>}
              </section>
            )}
          </div>
        </div>
      )}

      {ready && (isAdmin ? <LazyKpis mode="team" /> : teamHome ? <LazyKpis mode="me" /> : null)}
    </div>
  );
}
