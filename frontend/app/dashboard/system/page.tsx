"use client";
/* System (admin): is everything running? Health cards for the server,
   database, email, backups, daily jobs, Instagram/Facebook logins, errors
   and the spam guard; then Backups and Email setup. Refreshes every 60 s
   while the tab is visible. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ServerStack01Icon, DatabaseIcon, Mail01Icon, DatabaseBackupIcon, Notification03Icon, Clock01Icon,
  InstagramIcon, Bug01Icon, Shield01Icon, Refresh01Icon, Alert02Icon,
} from "@hugeicons/core-free-icons";
import { api, opsApi } from "@/lib/adminApi";
import { visibleInterval } from "@/lib/visibleInterval";
import { fmtBytes, hoursSince, timeAgo, uptime } from "@/lib/opsFormat";
import PageLoading from "@/components/admin/PageLoading";
import { WorkspaceHero, WorkspaceStats } from "@/components/admin/Workspace";
import "./system-workspace.css";
import SystemBackups from "@/components/admin/SystemBackups";
import EmailSetup from "@/components/admin/EmailSetup";

type Tone = "ok" | "warn" | "bad" | "off";
type Status = {
  now: string; uptimeSec: number; node: string;
  memory: { rssMb: number; heapUsedMb: number };
  db: { ok: boolean; pingMs: number | null; error: string | null };
  pool: { max: number | null; size: number | null; using: number | null; waiting: number | null };
  backups: { count: number; keep: number; latest: { name: string; size: number; createdAt: string } | null; lastResult: { ok: boolean; error?: string; at?: string; createdAt?: string } | null; lastDailyRun: string | null; running: boolean; offsiteEnabled: boolean };
  reminders: { lastRun: string | null; at: string | null };
  cron: { lastTick: string | null };
  metaCheck: { lastRun: string | null; accounts: { total: number; needReconnect: string[]; expiringSoon: string[] } | null };
  mail: { configured: boolean; from: string | null; host: string | null };
  errors: { last30m: number; last24h: number; last: { at: string; status: number; route: string; message: string } | null };
  spamGuard: { turnstile: boolean };
};

const Ic = ({ i, size = 17 }: { i: any; size?: number }) => <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} />;
const PILL: Record<Tone, string> = { ok: "OK", warn: "Check", bad: "Problem", off: "Off" };

function Card({ icon, title, tone, pill, value, children }: { icon: any; title: string; tone: Tone; pill?: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <article className={"sys-hc " + tone}>
      <div className="sys-hc-h"><span className="sys-ic"><Ic i={icon} /></span><b>{title}</b><span className={"sys-pill " + tone}>{pill || PILL[tone]}</span></div>
      <div className="sys-hc-v">{value}</div>
      {children && <div className="sys-hc-s">{children}</div>}
    </article>
  );
}
const list = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(", ")} +${xs.length - 3} more` : xs.join(", "));
const shortDay = (ymd: string | null) => (ymd ? new Date(ymd + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null);

export default function SystemPage() {
  const [s, setS] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [at, setAt] = useState<number | null>(null);
  const [myEmail, setMyEmail] = useState("");
  const [tick, setTick] = useState(0); // bumps the Backups / Email cards on a manual refresh
  const [, rerender] = useState(0);

  const inFlight = useRef(false);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true);
    try { setS(await opsApi.systemStatus()); setError(""); setAt(Date.now()); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the status"); }
    finally { inFlight.current = false; setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    api.me().then((r) => setMyEmail((r?.user ?? r)?.email || "")).catch(() => {});
    const stop = visibleInterval(load, 60000);
    const t = setInterval(() => rerender((n) => n + 1), 30000); // keep "x min ago" fresh
    return () => { stop(); clearInterval(t); };
  }, [load]);
  const refresh = () => { load(); setTick((n) => n + 1); };

  const health = s ? buildCards(s) : null;
  const tones = health?.tones || [];

  return (
    <div className="fw-workspace system-workspace">
      <WorkspaceHero eyebrow="Operations centre" title="System health" description="A live view of the services behind your workspace. Spot what needs attention, then open the right control below." actions={<button type="button" className="sys-btn" onClick={refresh} disabled={loading}>{loading ? <span className="sys-spin" aria-hidden="true" /> : <Ic i={Refresh01Icon} size={16} />}Refresh status</button>}>
        <span className="fw-caption" aria-live="polite">{at ? `Last successful refresh ${timeAgo(at)}${error ? " · showing previous status" : ""}` : "Waiting for the first status check"} · Refreshes every minute while this tab is visible</span>
      </WorkspaceHero>
      <WorkspaceStats items={[
        {label:"Healthy checks",value:health ? tones.filter(t=>t==="ok").length : "—",detail:"Of nine monitored services",accent:true},
        {label:"Needs attention",value:health ? tones.filter(t=>t==="bad"||t==="warn").length : "—",detail:"Warnings and service problems"},
        {label:"Not configured",value:health ? tones.filter(t=>t==="off").length : "—",detail:"Optional or not yet started"},
        {label:"Server uptime",value:s ? uptime(s.uptimeSec) : "—",detail:"Current application process"},
      ]} />
      {error && <div className="fw-error" role="alert"><span>{error}{s ? " Previous results remain visible." : ""}</span><button type="button" disabled={loading} onClick={refresh}>Retry / reload</button></div>}
      {!s && !error && <PageLoading label="Checking system health…" />}
      {health && <><div className="fw-section-title"><div><h2>Service overview</h2><p>Configuration and recent health signals. Email setup does not confirm mail delivery.</p></div><div className="sys-jumps"><a href="#backups">Backups ↗</a><a href="#email">Email setup ↗</a></div></div><div className="sys-grid">{health.cards}</div><p className="fw-caption">Error counts cover this application process since its last restart. Meta status reflects stored checks; open Social studio to recheck a channel.</p></>}
      {s && <><SystemBackups offsiteEnabled={s.backups.offsiteEnabled} onChange={load} refreshKey={tick} /><EmailSetup myEmail={myEmail} refreshKey={tick} /></>}
    </div>
  );
}

function buildCards(s: Status) {
  const now = new Date(s.now).getTime() || Date.now();

  // Backups: red when the newest is older than 36 h or the last attempt failed.
  const latest = s.backups.latest;
  const failed = s.backups.lastResult && s.backups.lastResult.ok === false ? s.backups.lastResult : null;
  const bkAge = hoursSince(latest?.createdAt, now);
  const bkTone: Tone = failed || bkAge > 36 ? "bad" : "ok";

  const cronAge = s.cron.lastTick ? (now - new Date(s.cron.lastTick).getTime()) / 60000 : null;
  const cronTone: Tone = cronAge == null ? "warn" : cronAge > 15 ? "bad" : "ok";

  const remAt = s.reminders.at || null;
  const remTone: Tone = !s.reminders.lastRun ? "off" : hoursSince(remAt, now) > 26 ? "warn" : "ok";

  const acc = s.metaCheck.accounts;
  const metaTone: Tone = !acc ? "warn" : acc.total === 0 ? "off" : acc.needReconnect.length ? "bad" : acc.expiringSoon.length ? "warn" : "ok";

  const errTone: Tone = s.errors.last30m > 0 ? "bad" : s.errors.last24h > 0 ? "warn" : "ok";
  const pool = s.pool;

  return { tones: ["ok", s.db.ok ? "ok" : "bad", s.mail.configured ? "ok" : "off", bkTone, remTone, cronTone, metaTone, errTone, s.spamGuard.turnstile ? "ok" : "off"] as Tone[], cards: [
    <Card key="server" icon={ServerStack01Icon} title="Server" tone="ok" pill="Running" value={uptime(s.uptimeSec)}>
      Memory {Math.round(s.memory.rssMb)} MB · Node {s.node}
    </Card>,
    <Card key="db" icon={DatabaseIcon} title="Database" tone={s.db.ok ? "ok" : "bad"} value={s.db.ok ? `OK · ${s.db.pingMs ?? "—"} ms` : "Not reachable"}>
      {s.db.ok
        ? <>Connections in use {pool.using ?? "—"} of {pool.size ?? "—"} open{pool.max ? ` (max ${pool.max})` : ""}{pool.waiting ? ` · ${pool.waiting} waiting` : ""}</>
        : s.db.error}
    </Card>,
    <Card key="mail" icon={Mail01Icon} title="Email" tone={s.mail.configured ? "ok" : "off"} pill={s.mail.configured ? "Set up" : "Not set up"} value={s.mail.configured ? "Set up" : "Not set up"}>
      {s.mail.configured ? <>Sends from {s.mail.from}</> : <>Alerts still show in the app. <a href="#email">How to set it up</a></>}
    </Card>,
    <Card key="bk" icon={DatabaseBackupIcon} title="Last backup" tone={bkTone} value={latest ? timeAgo(latest.createdAt, now) : "No backups yet"}>
      {failed
        ? <>Last attempt failed {failed.at ? timeAgo(failed.at, now) : ""}: {failed.error}</>
        : latest
          ? <>{fmtBytes(latest.size)} · {s.backups.count} kept{bkAge > 36 ? " · older than 36 hours" : ""}{s.backups.running ? " · backing up now…" : ""}</>
          : <>The first nightly backup runs after 2:30 AM. <a href="#backups">Back up now</a></>}
    </Card>,
    <Card key="rem" icon={Notification03Icon} title="Daily reminders" tone={remTone} pill={remTone === "off" ? "Not run yet" : undefined}
      value={s.reminders.lastRun ? (remAt ? timeAgo(remAt, now) : shortDay(s.reminders.lastRun)) : "Not run yet"}>
      Renewals and content due today, sent each morning around 10:15 AM.
    </Card>,
    <Card key="cron" icon={Clock01Icon} title="Cron" tone={cronTone} value={s.cron.lastTick ? `Last tick ${timeAgo(s.cron.lastTick, now)}` : "No tick yet"}>
      {cronTone === "ok" ? "The scheduled job is calling the server." : "The cPanel cron job should call the server every few minutes. Check it’s still set up."}
    </Card>,
    <Card key="meta" icon={InstagramIcon} title="Instagram / Facebook" tone={metaTone} pill={metaTone === "off" ? "None" : undefined}
      value={!acc ? "Status unavailable" : !acc.total ? "No accounts connected" : acc.needReconnect.length ? `${acc.needReconnect.length} need${acc.needReconnect.length === 1 ? "s" : ""} reconnecting` : acc.expiringSoon.length ? `${acc.expiringSoon.length} expiring soon` : `All ${acc.total} connected`}>
      {!acc && <>Channel status could not be read. Refresh or open Social studio. </>}
      {acc && acc.needReconnect.length > 0 && <>Reconnect: {list(acc.needReconnect)}. </>}
      {acc && acc.expiringSoon.length > 0 && <>Login expires within 7 days: {list(acc.expiringSoon)}. </>}
      {s.metaCheck.lastRun ? <>Checked {shortDay(s.metaCheck.lastRun)}. </> : null}
      <Link href="/dashboard/social-studio?tab=channels">Open Social studio</Link>
    </Card>,
    <Card key="err" icon={Bug01Icon} title="Errors" tone={errTone} pill={errTone === "ok" ? "None" : undefined}
      value={`${s.errors.last30m} in 30 min · ${s.errors.last24h} in 24 h`}>
      {s.errors.last
        ? <>Last: <code>{s.errors.last.status} {s.errors.last.route}</code> “{s.errors.last.message}” · {timeAgo(s.errors.last.at, now)}</>
        : "No server errors since the app last started."}
    </Card>,
    <Card key="spam" icon={Shield01Icon} title="Spam guard" tone={s.spamGuard.turnstile ? "ok" : "off"} pill={s.spamGuard.turnstile ? "On" : "Basic"}
      value={s.spamGuard.turnstile ? "Captcha on" : "Captcha off"}>
      {s.spamGuard.turnstile
        ? "Cloudflare Turnstile checks every website enquiry."
        : <>Hidden-field and timing checks still block most bots. For a captcha, add <code>TURNSTILE_SECRET</code> on the server and <code>NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> on the website.</>}
    </Card>,
  ] };
}
