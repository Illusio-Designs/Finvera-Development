"use client";
import ChannelAvatar from "@/components/admin/ChannelAvatar";
import PageLoading from "@/components/admin/PageLoading";
/* Social studio — analytics, channels and published posts for the brand
   picked in the dropdown (or all brands). Numbers come from Instagram and
   Facebook for connected channels (followers, likes, comments, shares) and
   from the content calendar (posts, schedule). */
import "./studio-workspace.css";
import { hasReportedMetrics, sumReported, totalReported, followerTotal } from "@/lib/socialStudioMetrics";
import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FireIcon, FavouriteIcon, Comment01Icon, UserAdd01Icon, Calendar03Icon, StarIcon, Clock01Icon, AnalyticsUpIcon,
  Link04Icon, GridViewIcon, InstagramIcon, Facebook01Icon, PlusSignIcon, ArrowDown01Icon, ArrowUpRight01Icon,
  Alert02Icon, PlayIcon, PauseIcon, SparklesIcon, Share01Icon, Refresh01Icon, CheckmarkCircle02Icon, Unlink04Icon, Tick02Icon,
  UserCircleIcon, Globe02Icon, Call02Icon, Mail01Icon, PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { api, opsApi } from "@/lib/adminApi";
import { userRoles } from "@/lib/permissions";
import { daysUntil, timeAgo } from "@/lib/opsFormat";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";

type Platform = "instagram" | "facebook";
type Stats = { instagram?: { followers: number | null; picture: string | null; username?: string }; facebook?: { followers: number | null; picture: string | null; name?: string } };
type Acc = { client: string; pageId: string; pageName: string; igUsername: string | null; igAvatar: string | null; status: string; lastError: string | null; paused: string[]; stats: Stats; tokenExpiresAt?: string | null; lastCheckedAt?: string | null };
type Metrics = { likes?: number; comments?: number; shares?: number; picture?: string | null; url?: string | null };
type Job = { id: number; postId: number; client: string; platform: Platform; status: string; runAt: string | null; publishedAt: string | null; url: string | null; error: string | null; metrics: Metrics };
type Post = { id: number; client: string; theme: string; format: string | null; status: string; postDate: string | null; postTime: string | null; assigneeId: number | null; picture: { url: string; type: string; thumbUrl?: string | null } | null };
type FollowerRow = { client: string; platform: Platform; day: string; followers: number };
type Data = { brands: string[]; accounts: Acc[]; followers: FollowerRow[]; weekAgo: string; jobs: Job[]; posts: Post[]; metaConfigured: boolean; refreshedAt?: string | null; refreshing?: boolean };
type Tab = "overview" | "channels" | "posts";
type Profile = { platform: Platform; name?: string; username?: string; biography?: string; about?: string; description?: string; website?: string; phone?: string; email?: string; category?: string; followers?: number | null; following?: number | null; posts?: number | null; picture?: string | null; link?: string };

const COLORS = ["#3e60ab", "#0f766e", "#be185d", "#a16207", "#7c5cff", "#0369a1", "#c2410c", "#15803d"];
const DAY = 86400000;
const PNAME: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook" };
const nf = (n: number | null | undefined) => (n == null ? "—" : n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString("en-IN"));
const fmtDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—");
const isVideo = (p?: Post | null) => !!p && (p.picture?.type === "video" || /reel|video/i.test(p.format || ""));
const engagement = (m: Metrics) => (m.likes || 0) + (m.comments || 0) + (m.shares || 0);

function Icon({ i, size = 16, className }: { i: any; size?: number; className?: string }) {
  return <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} className={className} />;
}
function Delta({ now, prev, unit = "vs last week" }: { now: number | null; prev: number | null; unit?: string }) {
  if (now == null || prev == null) return <span className="ss-delta">Comparison unavailable</span>;
  if (!prev && !now) return <span className="ss-delta">No change</span>;
  if (!prev) return <span className="ss-delta"><i className="up">New</i> this week</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  return <span className="ss-delta"><i className={pct >= 0 ? "up" : "down"}>{pct >= 0 ? "↑" : "↓"} {Math.abs(pct)}%</i> {unit}</span>;
}

/* Smooth stacked areas, all drawn to one scale. */
function AreaChart({ days, series }: { days: string[]; series: { label: string; color: string; values: number[] }[] }) {
  const W = 1000, H = 220, P = 14;
  const n = days.length;
  const totals = days.map((_, i) => series.reduce((s, x) => s + x.values[i], 0));
  const max = Math.max(1, ...totals) * 1.15;
  const X = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, n - 1);
  const Y = (v: number) => H - 26 - (v / max) * (H - 46);
  const smooth = (pts: [number, number][]) => pts.map((p, i) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const q = pts[i - 1], c = (p[0] - q[0]) / 2;
    return `C${q[0] + c},${q[1]} ${p[0] - c},${p[1]} ${p[0]},${p[1]}`;
  }).join(" ");
  let base = new Array(n).fill(0);
  const paths: JSX.Element[] = [];
  series.forEach((s) => {
    const top = s.values.map((v, i) => base[i] + v);
    const up = top.map((v, i) => [X(i), Y(v)] as [number, number]);
    const down = base.map((v, i) => [X(i), Y(v)] as [number, number]).reverse();
    paths.unshift(<path key={s.label} d={`${smooth(up)} ${smooth(down).replace(/^M/, "L")} Z`} fill={s.color} />);
    base = top;
  });
  const peak = totals.indexOf(Math.max(...totals));
  return (
    <svg className="ss-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Engagement per day: highest ${Math.max(...totals)} on ${days[peak]}`}>
      {[0, 1, 2, 3].map((g) => <line key={g} x1={P} x2={W - P} y1={20 + (g * (H - 46)) / 3} y2={20 + (g * (H - 46)) / 3} stroke="rgba(16,30,60,.08)" />)}
      {paths}
      {totals[peak] > 0 && <>
        <line x1={X(peak)} x2={X(peak)} y1={Y(totals[peak])} y2={H - 26} stroke="#111a30" strokeDasharray="3 3" />
        <circle cx={X(peak)} cy={Y(totals[peak])} r={5} fill="#111a30" />
        <text x={X(peak)} y={Y(totals[peak]) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#111a30">{totals[peak]}</text>
      </>}
      {days.map((d, i) => (i % 7 === 0 || i === n - 1) && <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#8a93aa">{d}</text>)}
    </svg>
  );
}

/* "Login expires in N days" (amber < 14, red < 3) and "Checked 2 h ago". */
function ConnHealth({ acc }: { acc: Acc }) {
  const days = acc.status === "connected" ? daysUntil(acc.tokenExpiresAt) : null;
  if (days == null && !acc.lastCheckedAt) return null;
  return (
    <div className="ops-chk">
      {days != null && days < 14 && <span className={days < 3 ? "red" : "amber"}>{days < 1 ? "Login expires today" : `Login expires in ${days} day${days === 1 ? "" : "s"}`}</span>}
      {acc.lastCheckedAt && <span title={new Date(acc.lastCheckedAt).toLocaleString()}>Checked {timeAgo(acc.lastCheckedAt)}</span>}
    </div>
  );
}

export default function SocialStudio() {
  const [data, setData] = useState<Data | null>(null);
  const [colors, setColors] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [limited, setLimited] = useState(true);
  const [brand, setBrand] = useState<string>("");
  const [tab, setTab] = useState<Tab>("overview");
  const [postFilter, setPostFilter] = useState<"published" | "scheduled">("published");
  const [ddOpen, setDdOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [connectFor, setConnectFor] = useState<string | null>(null);
  const [metaPick, setMetaPick] = useState<{ sel: string; brand: string; pages: { pageId: string; pageName: string; igUsername: string | null }[]; chosen: string } | null>(null);
  const [pageQ, setPageQ] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(false);
  const ddRef = useRef<HTMLDivElement | null>(null);
  type Capability = { id: string; label: string; state: string; detail: string; url?: string };
  type Readiness = { checkedAt: string; expiresAt: string | null; scopes: string[] | null; actions: Capability[] };
  const [readiness, setReadiness] = useState<{ client: string; platform: Platform; data: Readiness | null; error: string | null } | null>(null);
  async function checkReadiness(client: string, platform: Platform) {
    setReadiness({ client, platform, data: null, error: null });
    try { const data = await api.channelCapabilities(client, platform); setReadiness((r) => r?.client === client && r.platform === platform ? { ...r, data } : r); }
    catch (e: any) { setReadiness((r) => r?.client === client && r.platform === platform ? { ...r, error: e.message } : r); }
  }
  const [prof, setProf] = useState<{ client: string; platform: Platform; data: Profile | null; error: string | null; form: Record<string, string>; saving: boolean; saveError?: string } | null>(null);
  const photoRequest = useRef(0);
  const [photoBusy, setPhotoBusy] = useState(false), [photoError, setPhotoError] = useState(""), [photoVersion, setPhotoVersion] = useState(0);
  async function refreshPhoto() {
    if (!prof || photoBusy) return;
    const { client, platform } = prof; const request = ++photoRequest.current;
    setPhotoBusy(true); setPhotoError("");
    try {
      const result = await api.channelPicture(client, platform);
      setData(current => current ? { ...current, accounts: current.accounts.map(account => account.client === client ? { ...account, stats: { ...account.stats, [platform]: { ...account.stats?.[platform], picture: result.picture } }, ...(platform === "instagram" ? { igAvatar: result.picture } : {}) } : account) } : current);
      setProf(current => current?.client === client && current.platform === platform && current.data ? { ...current, data: { ...current.data, picture: result.picture } } : current);
      setPhotoVersion(version => version + 1);
    } catch (error: any) { if (request === photoRequest.current) setPhotoError(error.message); }
    finally { if (request === photoRequest.current) setPhotoBusy(false); }
  }
  async function openProfile(client: string, platform: Platform) {
    photoRequest.current++; setPhotoBusy(false); setPhotoError("");
    setProf({ client, platform, data: null, error: null, form: {}, saving: false });
    try {
      const d: Profile = await api.channelProfile(client, platform);
      setProf((current) => current?.client === client && current.platform === platform ? { client, platform, data: d, error: null, saving: false, form: { about: d.about || "", description: d.description || "", website: d.website || "", phone: d.phone || "", email: d.email || "" } } : current);
    } catch (e: any) { setProf((p) => (p?.client === client && p.platform === platform ? { ...p, error: e.message } : p)); }
  }
  async function saveProfile() {
    if (!prof) return;
    setProf({ ...prof, saving: true, saveError: undefined });
    try {
      const d: Profile = await api.updatePageProfile(prof.client, prof.form);
      setProf((p) => p?.client === prof.client && p.platform === prof.platform ? { ...p, data: d, saving: false } : p);
      toast("Page details saved", "ok", { description: `${prof.client} · Facebook` });
    } catch (e: any) {
      setProf((p) => (p?.client === prof.client && p.platform === prof.platform ? { ...p, saving: false, saveError: e.message } : p));
      toast("Couldn't save to Facebook", "err", { description: e.message });
    }
  }

  useEffect(() => {
    if (data && brand && !data.brands.includes(brand)) { setBrand(""); try { localStorage.removeItem("fv-studio-brand"); } catch {} }
  }, [data, brand]);
  async function load(quiet = false) {
    if (!quiet) setBusy(true);
    setLoadError("");
    try {
      const [d, c, me, u, health] = await Promise.all([
        api.socialStudio(), api.list("social-clients").catch(() => []), api.me().catch(() => null), api.listUsers().catch(() => []),
        api.socialAccounts().catch(() => []),
      ]);
      // Login expiry / last check come from /social-accounts.
      if (Array.isArray(health)) d.accounts = d.accounts.map((a: Acc) => { const h = health.find((x: any) => x.client === a.client); return h ? { ...a, tokenExpiresAt: h.tokenExpiresAt, lastCheckedAt: h.lastCheckedAt } : a; });
      setData(d);
      setIsAdmin(userRoles(me?.user ?? me).includes("admin"));
      const cols: Record<string, string> = {};
      (d.brands as string[]).forEach((b, i) => { cols[b] = (Array.isArray(c) ? c.find((x: any) => x.name === b)?.color : null) || COLORS[i % COLORS.length]; });
      setColors(cols);
      setLimited(!userRoles(me?.user ?? me).includes("admin"));
      setUsers(Array.isArray(u) ? u : []);
    } catch (e: any) { setLoadError(e.message || "Check your connection and try again."); toast("Couldn't load Social studio", "err", { description: e.message }); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    let b = q.get("brand") || "";
    try { if (!b) b = localStorage.getItem("fv-studio-brand") || ""; } catch { /* storage blocked */ }
    setBrand(b);
    const t = q.get("tab"); if (t === "channels" || t === "posts") setTab(t);
    load();
    // Back from Facebook's login: pick which Page (and its Instagram) is the brand's.
    const sel = q.get("metaConnect"), err = q.get("metaError");
    if (sel || err) {
      window.history.replaceState(null, "", window.location.pathname);
      setTab("channels");
      if (err) toast("Couldn't connect", "err", { description: err });
      else api.metaPages(sel as string).then((r) => {
        // Pre-select only a Page whose name matches the brand; otherwise let them pick.
        const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, "");
        const best = r.pages.find((x: { pageName: string }) => norm(x.pageName).includes(norm(r.brand)) || norm(r.brand).includes(norm(x.pageName)));
        setMetaPick({ sel: sel as string, brand: r.brand, pages: r.pages, chosen: best?.pageId || "" });
        setBrand(r.brand);
      }).catch((e) => toast("Couldn't finish connecting", "err", { description: e.message }));
    }
  }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  function pickBrand(b: string) {
    setBrand(b); setDdOpen(false);
    try { localStorage.setItem("fv-studio-brand", b); } catch { /* storage blocked */ }
  }

  /* ── Everything below is for the selected brand ("" = all brands) ── */
  const v = useMemo(() => {
    if (!data) return null;
    const inBrand = (c: string) => !brand || c === brand;
    const brands = data.brands.filter(inBrand);
    const accounts = data.accounts.filter((a) => inBrand(a.client));
    const jobs = data.jobs.filter((j) => inBrand(j.client));
    const postById = new Map(data.posts.map((p) => [p.id, p]));
    const now = Date.now();
    const pubIn = (from: number, to: number) => jobs.filter((j) => j.status === "published" && j.publishedAt && +new Date(j.publishedAt) >= from && +new Date(j.publishedAt) < to);
    const week = pubIn(now - 7 * DAY, now + 1), prev = pubIn(now - 14 * DAY, now - 7 * DAY), month = pubIn(now - 30 * DAY, now + 1);
    const uniq = (js: Job[]) => new Set(js.map((j) => j.postId)).size;
    const sum = (js: Job[], k: "likes" | "comments" | "shares") => sumReported(js, k);
    // channels (one card per platform)
    const channels = accounts.flatMap((a) => (["instagram", "facebook"] as Platform[]).filter((p) => p === "facebook" || a.igUsername).map((p) => {
      const rows = data.followers.filter((f) => f.client === a.client && f.platform === p).sort((x, y) => x.day.localeCompare(y.day));
      const followers = a.stats?.[p]?.followers ?? rows[rows.length - 1]?.followers ?? null;
      const then = [...rows].reverse().find((r) => r.day <= data.weekAgo);
      const grew = followers != null && then && then.day < (rows[rows.length - 1]?.day || "") ? followers - then.followers : null;
      const mine = jobs.filter((j) => j.client === a.client && j.platform === p);
      return {
        client: a.client, platform: p, acc: a,
        handle: p === "instagram" ? `@${a.stats?.instagram?.username || a.igUsername}` : (a.stats?.facebook?.name || a.pageName),
        picture: a.stats?.[p]?.picture || (p === "instagram" ? a.igAvatar : null),
        state: a.status !== "connected" ? "reconnect" : (a.paused || []).includes(p) ? "paused" : "live",
        followers, grew,
        scheduled: mine.filter((j) => j.status === "scheduled").sort((x, y) => +new Date(x.runAt || 0) - +new Date(y.runAt || 0)),
        published30: mine.filter((j) => j.status === "published" && j.publishedAt && +new Date(j.publishedAt) > now - 30 * DAY).length,
        problems: mine.filter((j) => ["failed", "check", "missed"].includes(j.status)).length,
      };
    }));
    const followersNow = followerTotal(channels);
    const grew = channels.some((c) => c.grew != null) ? channels.reduce((s, c) => s + (c.grew || 0), 0) : null;
    const upcoming = jobs.filter((j) => j.status === "scheduled" && j.runAt).sort((x, y) => +new Date(x.runAt!) - +new Date(y.runAt!));
    const next7 = upcoming.filter((j) => +new Date(j.runAt!) >= now && +new Date(j.runAt!) < now + 7 * DAY);
    const top = month.filter((job) => hasReportedMetrics(job.metrics)).sort((x, y) => engagement(y.metrics) - engagement(x.metrics))[0];
    // chart: engagement per day by platform over 30 days (by the day the post went out)
    const days: string[] = [], ig: number[] = [], fb: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d0 = new Date(new Date(now - i * DAY).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30").getTime();
      days.push(fmtDay(new Date(d0)));
      const that = month.filter((j) => +new Date(j.publishedAt!) >= d0 && +new Date(j.publishedAt!) < d0 + DAY);
      ig.push(that.filter((j) => j.platform === "instagram").reduce((s, j) => s + engagement(j.metrics), 0));
      fb.push(that.filter((j) => j.platform === "facebook").reduce((s, j) => s + engagement(j.metrics), 0));
    }
    const published = jobs.filter((j) => j.status === "published").sort((x, y) => +new Date(y.publishedAt || 0) - +new Date(x.publishedAt || 0));
    const attention = channels.filter((c) => c.state === "reconnect");
    const failed = jobs.filter((j) => ["failed", "check", "missed"].includes(j.status));
    return {
      brands, accounts, channels, postById, week, prev, month, uniq, sum, followersNow, grew, upcoming, next7, top,
      days, ig, fb, published, attention, failed,
    };
  }, [data, brand]);

  async function togglePause(c: { client: string; platform: Platform; state: string }) {
    const pausing = c.state !== "paused";
    if (pausing && !(await dialog.confirm({ title: `Pause ${PNAME[c.platform]} for ${c.client}?`, message: "Ready posts stop going out on this channel until you resume it. Nothing already published changes.", confirmText: "Pause" }))) return;
    try { await api.pauseChannel(c.client, c.platform, pausing); toast(pausing ? "Channel paused" : "Channel resumed", "ok", { description: `${c.client} · ${PNAME[c.platform]}` }); load(true); }
    catch (e: any) { toast("Couldn't change it", "err", { description: e.message }); }
  }
  async function connect(b: string) {
    try { const r = await api.metaStart(b); window.location.href = r.authUrl; }
    catch (e: any) { toast("Couldn't start connecting", "err", { description: e.message }); }
  }
  async function disconnect(b: string) {
    if (!(await dialog.confirm({ title: `Disconnect ${b}?`, message: "Both its Instagram and Facebook stop publishing automatically. You can connect again any time.", danger: true, confirmText: "Disconnect" }))) return;
    try { await api.disconnectSocial(b); toast(`${b} disconnected`, "ok"); load(true); }
    catch (e: any) { toast("Couldn't disconnect", "err", { description: e.message }); }
  }
  /* Ask Meta whether each saved login still works (admin). */
  async function checkConnections() {
    setChecking(true);
    try {
      const r = await opsApi.checkSocialAccounts();
      const bad = r.results.filter((x) => x.ok === false).length, unknown = r.results.filter((x) => x.ok === null).length, good = r.checked - bad - unknown;
      const warn = r.results.filter((x) => x.warning).map((x) => `${x.client}: ${x.warning}`);
      const parts = [`${good} working`, bad && `${bad} need${bad === 1 ? "s" : ""} reconnecting`, unknown && `${unknown} couldn't be checked (Meta not reachable)`].filter(Boolean).join(" · ");
      toast(r.checked ? `Checked ${r.checked} connection${r.checked === 1 ? "" : "s"}` : "No connected brands to check", bad ? "warn" : unknown ? "info" : "ok", { description: [r.checked ? parts : "", ...warn].filter(Boolean).join(" · ") || undefined });
      await load(true);
    } catch (e: any) { toast("Couldn't check connections", "err", { description: e.message }); }
    finally { setChecking(false); }
  }
  async function finishConnect() {
    if (!metaPick?.chosen) return;
    try {
      const a = await api.metaChoose(metaPick.sel, metaPick.chosen);
      setMetaPick(null);
      toast(`${a.client} connected`, "ok", { description: [a.igUsername && `Instagram @${a.igUsername}`, a.pageName && `Facebook ${a.pageName}`].filter(Boolean).join(" · ") });
      load();
    } catch (e: any) { toast("Couldn't connect", "err", { description: e.message }); }
  }

  if (!data || !v) return <div className="ss studio-workspace"><h1>Social studio</h1>{loadError ? <div className="ss-load-error" role="alert"><p>{loadError}</p><button type="button" className="ss-btn" onClick={() => load()}>Try again</button></div> : <PageLoading label="Loading Social studio…" />}</div>;

  const brandLabel = brand || "All brands";
  const color = (b: string) => colors[b] || COLORS[0];
  const brandSub = (b: string) => {
    const a = data.accounts.find((x) => x.client === b);
    if (!a) return { text: "Not connected", dot: "off" };
    if (a.status !== "connected") return { text: "Login expired · reconnect", dot: "bad" };
    const n = (a.igUsername ? 1 : 0) + 1, paused = (a.paused || []).length;
    return { text: `${n} channel${n > 1 ? "s" : ""}${paused ? ` · ${paused} paused` : ""}`, dot: paused ? "part" : "ok" };
  };
  const today = new Date();
  const weekLabel = `${fmtDay(new Date(Date.now() - 6 * DAY))} – ${fmtDay(today)}`;
  const postsWeek = v.uniq(v.week), postsPrev = v.uniq(v.prev);
  const title = postsWeek > postsPrev && postsWeek > 0 ? <>Your posts are on fire <Icon i={FireIcon} size={30} className="ss-fire" /></>
    : postsWeek === 0 ? "A quiet week so far" : "This week at a glance";
  const topPost = v.top ? v.postById.get(v.top.postId) : null;
  const nextJob = v.upcoming[0];
  const nextPost = nextJob ? v.postById.get(nextJob.postId) : null;
  const thumb = (j?: Job | null, p?: Post | null) => j?.metrics?.picture || p?.picture?.thumbUrl || p?.picture?.url || null;
  const hasMetrics = v.month.some((j) => hasReportedMetrics(j.metrics));

  return (
    <div className="ss studio-workspace">
      {loadError && <div className="ss-load-error" role="alert"><p>Couldn’t refresh this view: {loadError}</p><button type="button" className="ss-btn" onClick={() => load()}>Try again</button></div>}
      {/* ── Hero ── */}
      <section className="ss-hero">
        <div className="ss-hero-h">
          <div>
            <span className="ss-workspace-kicker">CONNECT. UNDERSTAND. GROW.</span><h1>Social studio</h1>
            <p className="ss-range">{brandLabel} · Accounts, publishing and performance{busy && " · updating…"}</p>
          </div>
          <div className="ss-hero-actions">
            <div className="ss-dd" ref={ddRef}>
              <button type="button" className="ss-dd-btn" aria-haspopup="listbox" aria-expanded={ddOpen} onClick={() => setDdOpen((o) => !o)}>
                <i style={{ background: brand ? color(brand) : undefined }} className={brand ? "" : "all"}>{brand ? brand[0] : <Icon i={SparklesIcon} size={17} />}</i>
                <span><b>{brandLabel}</b><small>{brand ? brandSub(brand).text : `${data.brands.length} brands · ${data.accounts.length} connected`}</small></span>
                <Icon i={ArrowDown01Icon} size={16} className="car" />
              </button>
              {ddOpen && (
                <ul className="ss-dd-list" role="listbox" aria-label="Brand">
                  <li role="option" aria-selected={!brand} tabIndex={0} onClick={() => pickBrand("")} onKeyDown={(e) => e.key === "Enter" && pickBrand("")}>
                    <i className="all"><Icon i={SparklesIcon} size={17} /></i><span><b>All brands</b><small>{data.brands.length} brands · {data.accounts.length} connected</small></span>
                  </li>
                  {data.brands.map((b) => {
                    const s = brandSub(b);
                    return (
                      <li key={b} role="option" aria-selected={brand === b} tabIndex={0} onClick={() => pickBrand(b)} onKeyDown={(e) => e.key === "Enter" && pickBrand(b)}>
                        <i style={{ background: color(b) }}>{b[0]}</i><span><b>{b}</b><small>{s.text}</small></span><em className={s.dot} />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button type="button" className="ss-btn" onClick={() => load()} aria-label="Refresh saved data" disabled={busy}><Icon i={Refresh01Icon} /></button>
          </div>
        </div>

        <p className="ss-saved-note">{data.refreshedAt ? `Platform metrics last saved ${timeAgo(data.refreshedAt)}.` : "Platform metrics have not been saved yet."} {data.refreshing && "A background refresh is running."}</p>
        {tab === "overview" && <details className="ss-weekly-highlights"><summary>Weekly highlights · {weekLabel}</summary><h2 className="ss-weekly-title">{title}</h2><div className="ss-hero-grid">
          <div className="ss-glass">
            <div className="ss-big"><b>{postsWeek}</b><span>post{postsWeek === 1 ? "" : "s"} published</span><Delta now={postsWeek} prev={postsPrev} /></div>
            <div className="ss-kpis">
              <div><span>Likes</span><p><b>{nf(v.sum(v.week, "likes"))}</b><em><Icon i={FavouriteIcon} size={15} /></em></p><Delta now={v.sum(v.week, "likes")} prev={v.sum(v.prev, "likes")} /></div>
              <div><span>Comments</span><p><b>{nf(v.sum(v.week, "comments"))}</b><em><Icon i={Comment01Icon} size={15} /></em></p><Delta now={v.sum(v.week, "comments")} prev={v.sum(v.prev, "comments")} /></div>
              <div><span>Followers</span><p><b>{nf(v.followersNow)}</b><em><Icon i={UserAdd01Icon} size={15} /></em></p>
                <span className="ss-delta">{v.grew == null ? "Growth shows after a few days" : <><i className={v.grew >= 0 ? "up" : "down"}>{v.grew >= 0 ? "+" : ""}{v.grew}</i> this week</>}</span></div>
              <div><span>Going out next 7 days</span><p><b>{v.next7.length}</b><em><Icon i={Calendar03Icon} size={15} /></em></p><span className="ss-delta">scheduled on {new Set(v.next7.map((j) => `${j.client}|${j.platform}`)).size} channel{new Set(v.next7.map((j) => `${j.client}|${j.platform}`)).size === 1 ? "" : "s"}</span></div>
            </div>
          </div>
          <div className="ss-glass">
            <span className="ss-side-t"><Icon i={StarIcon} size={16} />Top post this month</span>
            {v.top && topPost ? (
              <a className="ss-toppost" href={v.top.metrics?.url || v.top.url || "#"} target="_blank" rel="noopener noreferrer">
                <span className="th" style={thumb(v.top, topPost) ? { backgroundImage: `url(${thumb(v.top, topPost)})` } : { background: color(topPost.client) }} />
                <span><b>{topPost.theme}</b><small>{topPost.client} · {PNAME[v.top.platform]} · {nf(v.top.metrics?.likes)} likes · {nf(v.top.metrics?.comments)} comments</small></span>
              </a>
            ) : <p className="ss-empty-s">No reported engagement for posts in the last 30 days yet.</p>}
            <div className="ss-hr" />
            <span className="ss-side-t"><Icon i={Clock01Icon} size={16} />Next going live</span>
            {nextJob && nextPost ? (
              <div className="ss-toppost">
                <span className="th" style={nextPost.picture?.url ? { backgroundImage: `url(${nextPost.picture.thumbUrl || nextPost.picture.url})` } : { background: color(nextPost.client) }} />
                <span><b>{nextPost.theme}</b><small>{fmtWhen(nextJob.runAt)} · {nextPost.client} · {PNAME[nextJob.platform]}</small></span>
              </div>
            ) : <p className="ss-empty-s">Nothing scheduled. Posts in Ready to post appear here.</p>}
          </div>
        </div></details>}
      </section>

      {v.attention.length > 0 && (
        <div className="ss-attn" role="status">
          <Icon i={Alert02Icon} size={20} />
          <span><b>{[...new Set(v.attention.map((c) => c.client))].join(", ")} need{v.attention.length === 1 ? "s" : ""} reconnecting.</b> The Facebook login expired, so posts for {v.attention.length === 1 ? "this channel" : "these channels"} are on hold.</span>
          {!limited && <button type="button" className="ss-chip" onClick={() => connect(v.attention[0].client)}>Reconnect</button>}
        </div>
      )}
      {v.failed.length > 0 && (
        <div className="ss-attn soft" role="status">
          <Icon i={Alert02Icon} size={20} />
          <span><b>{v.failed.length} post{v.failed.length === 1 ? "" : "s"} didn't go out.</b> Open it in the content calendar to retry or mark it posted.</span>
          <a className="ss-chip" href="/dashboard/social">Open calendar</a>
        </div>
      )}

      <div className="ss-pills" role="tablist" aria-label="Sections">
        {([["overview", "Analytics", AnalyticsUpIcon], ["channels", "Channels", Link04Icon], ["posts", "Posts", GridViewIcon]] as [Tab, string, any][]).map(([k, label, ic]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            <em><Icon i={ic} size={14} /></em>{label}
            {k === "channels" && <small>{v.channels.length}</small>}
          </button>
        ))}
      </div>

      {/* ── Analytics ── */}
      {tab === "overview" && (
        <section className="ss-panel">
          <div className="ss-panel-h">
            <h2>Last 30 days{brand ? ` · ${brand}` : ""}</h2>
            <div className="ss-legend"><span><i style={{ background: "#b9c9ef" }} />Instagram</span><span><i style={{ background: "#d6ccff" }} />Facebook</span></div>
          </div>
          <div className="ss-tiles">
            <div><p><b>{v.uniq(v.month)}</b><em><Icon i={FireIcon} size={15} /></em></p><span>Posts published</span></div>
            <div><p><b>{nf(totalReported(v.month))}</b><em><Icon i={StarIcon} size={15} /></em></p><span>Likes, comments &amp; shares</span></div>
            <div><p><b>{nf(v.followersNow)}</b><em><Icon i={UserAdd01Icon} size={15} /></em></p><span>Followers now</span></div>
            <div><p><b>{v.next7.length}</b><em><Icon i={Clock01Icon} size={15} /></em></p><span>Scheduled next 7 days</span></div>
          </div>
          {hasMetrics
            ? <AreaChart days={v.days} series={[{ label: "Instagram", color: "#b9c9ef", values: v.ig }, { label: "Facebook", color: "#d6ccff", values: v.fb }]} />
            : <div className="ss-empty">Engagement per day shows here once posts have gone out through Social studio and Instagram or Facebook reports likes and comments.</div>}
          <p className="ss-note">Available platform metrics refresh in the background for connected channels. Missing metrics show —; totals include reported values only. The chart groups recorded engagement by the post’s publication day, not the day each interaction happened. Posts and schedules come from the content calendar.</p>
        </section>
      )}

      {/* ── Channels ── */}
      {tab === "channels" && (
        <section className="ss-groups">
          {!limited && (
            <div className="ss-groups-h">
              <span>{v.channels.length} channel{v.channels.length === 1 ? "" : "s"} for {brandLabel.toLowerCase() === "all brands" ? "all brands" : brand}</span>
              {isAdmin && <button type="button" className="ss-chip" onClick={checkConnections} disabled={checking}>{checking ? <span className="sys-spin" aria-hidden="true" /> : <Icon i={CheckmarkCircle02Icon} size={14} />}{checking ? "Checking…" : "Check connections"}</button>}
              <button type="button" className="ss-chip dark" onClick={() => setConnectFor(brand || data.brands.find((b) => !data.accounts.some((a) => a.client === b)) || data.brands[0] || "")}><Icon i={PlusSignIcon} />Connect channel</button>
            </div>
          )}
          {v.brands.map((b) => {
            const chs = v.channels.filter((c) => c.client === b);
            const acc = v.accounts.find((a) => a.client === b);
            const s = brandSub(b);
            const missing: Platform[] = !acc ? ["instagram"] : acc.igUsername ? [] : ["instagram"]; // an unconnected brand gets one box for both
            return (
              <div key={b} className="ss-group">
                <div className="ss-group-h">
                  <i style={{ background: color(b) }}>{b[0]}</i>
                  <div><b>{b}</b><small>{s.text}</small></div>
                  {!brand && <button type="button" className="ss-chip" onClick={() => pickBrand(b)}>View brand <Icon i={ArrowUpRight01Icon} size={14} /></button>}
                  {acc && !limited && <button type="button" className="ss-chip ghost" onClick={() => disconnect(b)} aria-label={`Disconnect ${b}`}><Icon i={Unlink04Icon} size={14} />Disconnect</button>}
                </div>
                <div className="ss-chs">
                  {chs.map((c) => (
                    <article key={c.platform} className={"ss-ch " + c.state}>
                      <div className="ss-ch-h">
                        <ChannelAvatar key={`${c.picture}:${photoVersion}`} picture={c.picture} label={b} className={"ss-ava" + (c.platform === "instagram" ? " ig" : "")} color={color(b)} />
                        <div><b>{c.handle}</b><small>{c.platform === "instagram" ? "Instagram Business" : "Facebook Page"}</small></div>
                        <span className={"ss-st " + c.state}>{c.state === "live" ? "● Connected" : c.state === "paused" ? "Paused" : "● Reconnect"}</span>
                      </div>
                      <ConnHealth acc={c.acc} />
                      {c.state === "reconnect" && <p className="ss-hold">The Facebook login expired{c.scheduled.length ? `, so ${c.scheduled.length} scheduled post${c.scheduled.length === 1 ? " is" : "s are"} on hold` : ""}. {c.acc.lastError && <small>{c.acc.lastError}</small>}</p>}
                      <div className="ss-ch-n">
                        <div><b>{nf(c.followers)}</b><span>Followers</span>{c.grew != null && <span className={c.grew >= 0 ? "u" : "d"}>{c.grew >= 0 ? "+" : ""}{c.grew} this week</span>}</div>
                        <div><b>{c.scheduled.length}</b><span>{c.state === "live" ? "Scheduled" : "On hold"}</span></div>
                        <div><b>{c.published30}</b><span>Published (30d)</span></div>
                      </div>
                      <div className="ss-strip" aria-label="Next posts on this channel">
                        {[0, 1, 2, 3].map((i) => {
                          const j = c.scheduled[i], p = j ? v.postById.get(j.postId) : null;
                          return p ? (
                            <span key={i} title={`${p.theme} · ${fmtWhen(j.runAt)}`} style={p.picture?.url && p.picture.type !== "video" ? { backgroundImage: `url(${p.picture.thumbUrl || p.picture.url})` } : { background: color(b) }}>
                              {(!p.picture?.url || p.picture.type === "video") && <Icon i={isVideo(p) ? PlayIcon : Calendar03Icon} size={14} />}
                            </span>
                          ) : <span key={i} className="empty" />;
                        })}
                      </div>
                      {!limited && (
                        <div className="ss-ch-f">
                          {c.state === "reconnect"
                            ? <button type="button" className="ss-chip dark" onClick={() => connect(b)}><Icon i={Refresh01Icon} size={14} />Reconnect now</button>
                            : <button type="button" className={"ss-chip" + (c.state === "paused" ? " dark" : "")} onClick={() => togglePause(c)}><Icon i={c.state === "paused" ? PlayIcon : PauseIcon} size={14} />{c.state === "paused" ? "Resume" : "Pause"}</button>}
                          <button type="button" className="ss-chip" onClick={() => openProfile(b, c.platform)}><Icon i={UserCircleIcon} size={14} />Profile</button><button type="button" className="ss-chip" onClick={() => checkReadiness(b, c.platform)}>Readiness & actions</button>
                        </div>
                      )}
                      {limited && c.state !== "reconnect" && <div className="ss-ch-f"><button type="button" className="ss-chip" onClick={() => openProfile(b, c.platform)}><Icon i={UserCircleIcon} size={14} />Profile</button><button type="button" className="ss-chip" onClick={() => checkReadiness(b, c.platform)}>Readiness & actions</button></div>}
                    </article>
                  ))}
                  {missing.map((p) => (
                    <div key={p} className="ss-new">
                      <span className="two"><i className="instagram"><Icon i={InstagramIcon} size={20} /></i>{!acc && <i className="facebook"><Icon i={Facebook01Icon} size={20} /></i>}</span>
                      <b>{acc ? "No Instagram linked" : "Connect Instagram + Facebook"}</b>
                      <span>{acc
                        ? `Link ${b}'s Instagram business account to its Facebook Page "${acc.pageName}", then reconnect.`
                        : `${b} isn't connected yet, so its posts go out by hand.`}</span>
                      {!limited && <button type="button" className="ss-chip dark" onClick={() => (acc ? connect(b) : setConnectFor(b))}>{acc ? "Reconnect" : "Connect"}</button>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!v.brands.length && <div className="ss-empty">No brands yet. Add one in the content calendar.</div>}
        </section>
      )}

      {/* ── Posts ── */}
      {tab === "posts" && (
        <section className="ss-panel">
          <div className="ss-panel-h">
            <h2>{brand ? `${brand}'s posts` : "All posts"}</h2>
            <div className="ss-seg">
              <button type="button" className={postFilter === "published" ? "on" : ""} onClick={() => setPostFilter("published")}>Published <small>{v.published.length}</small></button>
              <button type="button" className={postFilter === "scheduled" ? "on" : ""} onClick={() => setPostFilter("scheduled")}>Scheduled <small>{v.upcoming.length}</small></button>
            </div>
          </div>
          <div className="ss-posts">
            {(postFilter === "published" ? v.published : v.upcoming).slice(0, 60).map((j) => {
              const p = v.postById.get(j.postId);
              if (!p) return null;
              const pic = thumb(j, p);
              return (
                <div key={j.id} className="ss-post">
                  <div className="img" style={pic && !(p.picture?.type === "video" && !j.metrics?.picture) ? { backgroundImage: `url(${pic})` } : { background: `linear-gradient(160deg, ${color(p.client)}, #243a75)` }}>
                    <span className="pf"><Icon i={j.platform === "instagram" ? InstagramIcon : Facebook01Icon} size={12} /></span>
                    {isVideo(p) && <span className="vb"><Icon i={PlayIcon} size={11} /></span>}
                    <span className="dt">{fmtDay(new Date(j.publishedAt || j.runAt || Date.now()))}</span>
                  </div>
                  <div className="card">
                    <small>{p.client} · {PNAME[j.platform]}{p.format ? ` · ${p.format}` : ""}</small>
                    <b>{p.theme}</b>
                    {postFilter === "published" ? (
                      <div className="m">
                        <span className="l"><Icon i={FavouriteIcon} size={12} />{nf(j.metrics?.likes ?? null)}</span>
                        <span className="c"><Icon i={Comment01Icon} size={12} />{nf(j.metrics?.comments ?? null)}</span>
                        {j.platform === "facebook" && <span className="s"><Icon i={Share01Icon} size={12} />{nf(j.metrics?.shares ?? null)}</span>}
                        {(j.metrics?.url || j.url) && <a className="s" href={j.metrics?.url || j.url || "#"} target="_blank" rel="noopener noreferrer">View <Icon i={ArrowUpRight01Icon} size={11} /></a>}
                      </div>
                    ) : <div className="m"><span className="s"><Icon i={Clock01Icon} size={12} />{fmtWhen(j.runAt)}</span></div>}
                  </div>
                </div>
              );
            })}
          </div>
          {!(postFilter === "published" ? v.published : v.upcoming).length && (
            <div className="ss-empty">{postFilter === "published" ? "No posts published through Social studio yet." : "Nothing scheduled. Posts in Ready to post with a connected channel appear here."}</div>
          )}
        </section>
      )}

      {/* Connect: pick the brand, then Facebook login */}
      {connectFor !== null && (
        <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setConnectFor(null); }}>
          <div className="ss-modal" role="dialog" aria-modal="true" aria-label="Connect a channel">
            <div className="ss-modal-h"><h3>Connect a channel</h3><button type="button" className="ss-btn" onClick={() => setConnectFor(null)} aria-label="Close">×</button></div>
            <div className="ss-field"><span>Brand</span>
              <Select value={connectFor} onChange={(val) => setConnectFor(val)} ariaLabel="Brand"
                options={data.brands.map((b) => ({ value: b, label: data.accounts.some((a) => a.client === b) ? `${b} · connected (reconnect)` : b }))} />
            </div>
            <div className="ss-plat"><span className="lg"><Icon i={InstagramIcon} size={18} /></span><span className="lg fb"><Icon i={Facebook01Icon} size={18} /></span>
              <div><b>Instagram + Facebook Page</b><small>Both connect together. Brands without an Instagram business account connect their Facebook Page only.</small></div></div>
            <ul className="ss-checks">
              <li><Icon i={Tick02Icon} size={15} />Log in to Facebook with the account that manages {connectFor || "the brand"}'s Page.</li>
              <li><Icon i={Tick02Icon} size={15} />Instagram must be a Business or Creator account linked to that Page.</li>
              <li><Icon i={Tick02Icon} size={15} />Only posts in Ready to post go out. You can pause or disconnect any time.</li>
            </ul>
            <div className="ss-modal-f"><button type="button" className="ss-chip" onClick={() => setConnectFor(null)}>Cancel</button><button type="button" className="ss-chip dark" disabled={!connectFor} onClick={() => connect(connectFor)}>Continue with Facebook</button></div>
          </div>
        </div>
      )}

      {readiness && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setReadiness(null); }}>
          <aside className="adm-drawer ss-prof" role="dialog" aria-modal="true" aria-label="Meta readiness and actions">
            <div className="ss-modal-h"><h3>{PNAME[readiness.platform]} readiness & actions</h3><button type="button" className="ss-btn" onClick={() => setReadiness(null)} aria-label="Close">×</button></div>
            <p>{readiness.client}</p>
            {!readiness.data && !readiness.error && <p role="status">Checking account access…</p>}
            {readiness.error && <p className="ss-attn">{readiness.error}</p>}
            {readiness.data && <>
              <p className="ss-note">Checked {fmtWhen(readiness.data.checkedAt)}. This check reads account access; it does not edit a profile or publish a test post.</p>
              {readiness.data.expiresAt && <p>Token expires {fmtWhen(readiness.data.expiresAt)}</p>}
              {readiness.data.actions.map((action) => <div className="ss-prof-sec" key={action.id}>
                <strong>{action.label}</strong><p><b>{action.state.replace(/_/g, " ")}</b> · {action.detail}</p>
                {action.url && <a className="ss-chip" href={action.url} target="_blank" rel="noopener noreferrer">{action.id === "edit" ? "Edit on platform" : "Open profile"} ↗</a>}
                {action.id === "view" && <button type="button" className="ss-chip" onClick={() => { openProfile(readiness.client, readiness.platform); setReadiness(null); }}>View profile details</button>}
                {action.id === "edit" && readiness.platform === "facebook" && !limited && action.state === "permission_granted" && <button type="button" className="ss-chip" onClick={() => { openProfile(readiness.client, "facebook"); setReadiness(null); }}>Edit supported details</button>}
              </div>)}
              <details><summary>Granted scopes</summary><p className="ss-note">{readiness.data.scopes?.join(", ") || "Unknown — not verified"}</p></details>
            </>}
            <button type="button" className="ss-chip" disabled={!readiness.data && !readiness.error} onClick={() => checkReadiness(readiness.client, readiness.platform)}>Check again</button>
          </aside>
        </div>
      )}

      {prof && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setProf(null); }}>
          <aside className="adm-drawer ss-prof" role="dialog" aria-modal="true" aria-label={`${prof.client} ${PNAME[prof.platform]} profile`}>
            <div className="ss-modal-h"><h3>{PNAME[prof.platform]} profile</h3><button type="button" className="ss-btn" onClick={() => setProf(null)} aria-label="Close">×</button></div>
            <button type="button" className="ss-btn" disabled={photoBusy || prof.saving} onClick={refreshPhoto}>{photoBusy ? "Refreshing photo…" : "Refresh photo"}</button>
            {photoError && <p className="ss-load-error" role="alert">{photoError}</p>}
            {prof.saveError && <p className="ss-load-error" role="alert">{prof.saveError}</p>}
            {prof.error && <div className="ss-attn">{prof.error}</div>}
            {!prof.data && !prof.error && <div className="ss-loading">Loading profile…</div>}
            {prof.data && (() => {
              const d = prof.data, ig = prof.platform === "instagram";
              const canEdit = !ig && !limited;
              const f = prof.form, setF = (k: string, val: string) => setProf({ ...prof, form: { ...f, [k]: val } });
              return (
                <>
                  <div className={"ss-prof-cover " + prof.platform}>
                    <ChannelAvatar key={`${d.picture}:${photoVersion}`} picture={d.picture} label={prof.client} className={"ss-ava big" + (ig ? " ig" : "")} color={color(prof.client)} />
                  </div>
                  <div className="ss-prof-id">
                    {d.link && <a className="ss-chip" href={d.link} target="_blank" rel="noopener noreferrer">Open profile ↗</a>}
                    <b>{ig ? d.name || `@${d.username}` : d.name}</b>
                    <small>{ig ? `@${d.username}` : d.category || "Facebook Page"}</small>
                  </div>
                  <div className="ss-ch-n">
                    <div><b>{nf(d.followers ?? null)}</b><span>Followers</span></div>
                    {ig ? <><div><b>{nf(d.following ?? null)}</b><span>Following</span></div><div><b>{nf(d.posts ?? null)}</b><span>Posts</span></div></>
                      : <div><b>{v.channels.find((c) => c.client === prof.client && c.platform === "facebook")?.published30 ?? 0}</b><span>Published (30d)</span></div>}
                  </div>
                  {ig ? (
                    <>
                      <div className="ss-prof-sec"><span>Bio</span><p>{d.biography || "No bio yet."}</p></div>
                      {d.website && <div className="ss-prof-sec"><span>Website</span><a href={d.website} target="_blank" rel="noopener noreferrer">{d.website}</a></div>}
                      <p className="ss-note">Profile edits for Instagram are not implemented in Finvera. Use Instagram to change the name, bio, website or picture, then refresh this profile.</p>
                      <a className="ss-chip dark" href="https://www.instagram.com/accounts/edit/" target="_blank" rel="noopener noreferrer"><Icon i={PencilEdit02Icon} size={14} />Edit on Instagram</a>
                    </>
                  ) : canEdit ? (
                    <form className="ss-prof-form" onSubmit={(e) => { e.preventDefault(); saveProfile(); }}>
                      <label className="ss-field">About <small>Short line under the Page name (up to 255 characters)</small>
                        <input value={f.about} maxLength={255} onChange={(e) => setF("about", e.target.value)} /></label>
                      <label className="ss-field">Description
                        <textarea rows={4} value={f.description} onChange={(e) => setF("description", e.target.value)} /></label>
                      <label className="ss-field"><span className="ss-lbl"><Icon i={Globe02Icon} size={14} />Website</span>
                        <input value={f.website} placeholder="https://" onChange={(e) => setF("website", e.target.value)} /></label>
                      <div className="ss-two">
                        <label className="ss-field"><span className="ss-lbl"><Icon i={Call02Icon} size={14} />Phone</span>
                          <input value={f.phone} onChange={(e) => setF("phone", e.target.value)} /></label>
                        <label className="ss-field"><span className="ss-lbl"><Icon i={Mail01Icon} size={14} />Email</span>
                          <input type="email" value={f.email} onChange={(e) => setF("email", e.target.value)} /></label>
                      </div>
                      <p className="ss-note">Saved straight to the Facebook Page. The Page name and pictures are changed on Facebook.</p>
                      <div className="ss-modal-f">
                        <a className="ss-chip" href={d.link} target="_blank" rel="noopener noreferrer">Open Page <Icon i={ArrowUpRight01Icon} size={14} /></a>
                        <button type="submit" className="ss-chip dark" disabled={prof.saving}>{prof.saving ? "Saving…" : "Save to Facebook"}</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {d.about && <div className="ss-prof-sec"><span>About</span><p>{d.about}</p></div>}
                      {d.description && <div className="ss-prof-sec"><span>Description</span><p>{d.description}</p></div>}
                      {d.website && <div className="ss-prof-sec"><span>Website</span><a href={d.website} target="_blank" rel="noopener noreferrer">{d.website}</a></div>}
                    </>
                  )}
                </>
              );
            })()}
          </aside>
        </div>
      )}

      {metaPick && (
        <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setMetaPick(null); }}>
          <div className="ss-modal pages" role="dialog" aria-modal="true" aria-label={`Connect ${metaPick.brand}`}>
            <div className="ss-modal-h"><h3>Which Page is {metaPick.brand}'s?</h3><button type="button" className="ss-btn" onClick={() => setMetaPick(null)} aria-label="Close">×</button></div>
            <p className="ss-note" style={{ margin: 0 }}>{metaPick.pages.length} Pages found. Its linked Instagram account connects with it.</p>
            {metaPick.pages.length > 6 && <input className="ss-search" placeholder="Search Pages…" value={pageQ} onChange={(e) => setPageQ(e.target.value)} aria-label="Search Pages" />}
            <div className="ss-pages" role="radiogroup">
              {metaPick.pages
                .filter((pg) => !pageQ.trim() || `${pg.pageName} ${pg.igUsername || ""}`.toLowerCase().includes(pageQ.trim().toLowerCase()))
                .sort((x, y) => (x.pageName.toLowerCase().includes(metaPick.brand.toLowerCase().split(" ")[0]) ? -1 : 0) - (y.pageName.toLowerCase().includes(metaPick.brand.toLowerCase().split(" ")[0]) ? -1 : 0))
                .map((pg, i) => (
                <label key={pg.pageId} className={metaPick.chosen === pg.pageId ? "on" : ""}>
                  <input type="radio" name="ss-page" checked={metaPick.chosen === pg.pageId} onChange={() => setMetaPick({ ...metaPick, chosen: pg.pageId })} />
                  <i className="pav" style={{ background: COLORS[i % COLORS.length] }}>{pg.pageName[0]}</i>
                  <span><b>{pg.pageName}</b><small>{pg.igUsername ? <><Icon i={InstagramIcon} size={12} /> @{pg.igUsername}</> : "Facebook only"}</small></span>
                  {metaPick.chosen === pg.pageId && <Icon i={CheckmarkCircle02Icon} size={18} />}
                </label>
              ))}
            </div>
            <div className="ss-modal-f"><button type="button" className="ss-chip" onClick={() => setMetaPick(null)}>Cancel</button><button type="button" className="ss-chip dark" disabled={!metaPick.chosen} onClick={finishConnect}>Connect</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
