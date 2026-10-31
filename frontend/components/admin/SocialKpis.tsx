"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import Select from "@/components/Select";

/* Content calendar performance KPIs, shown on the dashboard home.
   mode "team": admins — team cards, a row per person (tap → details),
   where work waits, and planned vs posted by brand.
   mode "me": a team member — their own numbers against the team average. */

type Week = { label: string; onTime: number; late: number };
type Recent = { postId: number; theme: string; client: string; format?: string; day: string; to: string; onTime: boolean; minutes: number };
type Person = {
  id: number; name: string; avatar?: string | null; role: string; open: number; overdue: number; startsToday: number;
  delivered: number; deliveredPrev: number; onTime: number | null; onTimePrev: number | null; avgStageDays: number | null;
  hours: number; estHours: number | null; weeks: Week[]; timeByBrand: { brand: string; hours: number; posts: number }[]; recent: Recent[];
};
type Team = {
  delivered: number; deliveredPrev: number; onTime: number | null; onTimePrev: number | null; overdue: number; open: number;
  avgStageDays: number | null; hours: number; estHours: number | null; weeks: Week[];
  stages: { status: string; name: string; days: number | null; moves: number }[];
  brands: { name: string; planned: number; posted: number; overdue: number }[];
};
type Data = { period: { kind: string; label: string; from: string }; historySince: string | null; team: Team | null; people: Person[] };

const PERIODS = [["week", "This week"], ["month", "This month"], ["quarter", "3 months"]] as const;
const ini = (n: string) => n.split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase();
const AV = ["#8a4b12", "#0f6b62", "#6033c4", "#2f4f9e", "#33405e", "#b42323", "#15703a"];
const fmtDay = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const days = (d: number | null) => (d == null ? "—" : d < 0.1 ? "<0.1 d" : `${d} d`);
const tone = (p: number | null) => (p == null ? "" : p >= 85 ? "good" : p >= 70 ? "mid" : "bad");

function Delta({ now, prev, unit = "", better = "up" }: { now: number | null; prev: number | null; unit?: string; better?: "up" | "down" }) {
  if (now == null || prev == null) return <span className="kp-delta">No earlier data yet</span>;
  const d = now - prev;
  if (!d) return <span className="kp-delta">Same as before</span>;
  const good = better === "up" ? d > 0 : d < 0;
  return <span className={"kp-delta " + (good ? "good" : "bad")}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}{unit} vs previous</span>;
}

function Bars({ weeks, height = 120 }: { weeks: Week[]; height?: number }) {
  const max = Math.max(1, ...weeks.map((w) => w.onTime + w.late));
  return (
    <div className="kp-bars" style={{ height: height + 34 }}>
      {weeks.map((w, i) => (
        <div key={i} className="kp-bar" title={`${w.label}: ${w.onTime} on time, ${w.late} late`}>
          <span className="n">{w.onTime + w.late || ""}</span>
          {w.late > 0 && <i className="late" style={{ height: (height * w.late) / max }} />}
          <i className="on" style={{ height: Math.max(w.onTime ? 3 : 0, (height * w.onTime) / max) }} />
          <small>{w.label}</small>
        </div>
      ))}
    </div>
  );
}

export default function SocialKpis({ mode }: { mode: "team" | "me" }) {
  const [period, setPeriod] = useState("month");
  const [brand, setBrand] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Person | null>(null);

  useEffect(() => {
    let alive = true;
    setError(false);
    api.socialKpis(period, brand).then((d: Data) => { if (alive) setData(d); }).catch(() => alive && setError(true));
    return () => { alive = false; };
  }, [period, brand]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const head = (
    <div className="kp-head">
      <div>
        <h2>{mode === "team" ? "Social media performance" : "My performance"}</h2>
        <p>{mode === "team" ? "Delivery, deadlines and time on the content calendar." : "Your content calendar work, compared with the team."}</p>
      </div>
      <div className="kp-controls">
        <div className="kp-seg" role="group" aria-label="Period">
          {PERIODS.map(([k, l]) => <button key={k} type="button" aria-pressed={period === k} className={period === k ? "on" : ""} onClick={() => setPeriod(k)}>{l}</button>)}
        </div>
        {mode === "team" && data?.team && (
          <div className="kp-brand"><Select value={brand} onChange={setBrand} ariaLabel="Brand"
            options={[{ value: "", label: "All brands" }, ...data.team.brands.map((b) => ({ value: b.name, label: b.name }))]} /></div>
        )}
      </div>
    </div>
  );

  if (error) return <section className="kp">{head}<div className="kp-empty">Couldn&apos;t load the numbers. Refresh to try again.</div></section>;
  if (!data || !data.team) return <section className="kp">{head}<div className="kp-empty">Loading…</div></section>;

  const t = data.team;
  const historyNote = data.historySince
    ? `Each stage counts for the person who did it. Work finished before ${fmtDay(data.historySince)} is included from what was recorded then; days in stage count from ${fmtDay(data.historySince)}.`
    : "Each stage counts for the person who did it. Days in stage start counting from the next stage move.";

  /* ── A team member's own view ── */
  if (mode === "me") {
    const me = data.people[0];
    if (!me) return <section className="kp">{head}<div className="kp-empty">No calendar work for you yet.</div></section>;
    return (
      <section className="kp">
        {head}
        <div className="kp-cards four">
          <div className="kp-card"><span>Delivered</span><b>{me.delivered}</b><Delta now={me.delivered} prev={me.deliveredPrev} /></div>
          <div className="kp-card"><span>On-time rate</span><b className={tone(me.onTime)}>{me.onTime == null ? "—" : `${me.onTime}%`}</b><span className="kp-delta">Team {t.onTime == null ? "—" : `${t.onTime}%`}</span></div>
          <div className="kp-card"><span>Open now</span><b className="blue">{me.open}</b><span className="kp-delta">{me.overdue ? `${me.overdue} overdue` : me.startsToday ? `${me.startsToday} start today` : "Nothing overdue"}</span></div>
          <div className="kp-card"><span>Days per stage</span><b className="blue">{days(me.avgStageDays)}</b><span className="kp-delta">Team {days(t.avgStageDays)}</span></div>
        </div>
        <div className="kp-grid">
          <div className="kp-panel"><h3>Delivered per week</h3><Bars weeks={me.weeks} /><Legend /></div>
          <div className="kp-panel">
            <h3>Compared with the team</h3>
            <div className="kp-kv"><span>Days in my stage</span><b>{days(me.avgStageDays)} <small>· team {days(t.avgStageDays)}</small></b></div>
            <div className="kp-kv"><span>On-time rate</span><b>{me.onTime ?? "—"}% <small>· team {t.onTime ?? "—"}%</small></b></div>
          </div>
        </div>
        <p className="kp-note">{historyNote}</p>
      </section>
    );
  }

  /* ── Admin team view ── */
  const maxStage = Math.max(1, ...t.stages.map((s) => s.days || 0));
  const slowest = [...t.stages].filter((s) => s.days != null).sort((a, b) => (b.days || 0) - (a.days || 0))[0];
  return (
    <section className="kp">
      {head}
      <div className="kp-cards four">
        <div className="kp-card"><span>Posts delivered</span><b>{t.delivered}</b><Delta now={t.delivered} prev={t.deliveredPrev} /></div>
        <div className="kp-card"><span>On-time rate</span><b className={tone(t.onTime)}>{t.onTime == null ? "—" : `${t.onTime}%`}</b><Delta now={t.onTime} prev={t.onTimePrev} unit=" pts" /></div>
        <div className="kp-card"><span>Overdue now</span><b className={t.overdue ? "bad" : "good"}>{t.overdue}</b><span className="kp-delta">{t.open} posts open</span></div>
        <div className="kp-card"><span>Avg days per stage</span><b className="blue">{days(t.avgStageDays)}</b><span className="kp-delta">From stage moves</span></div>
      </div>

      <div className="kp-panel flush">
        <div className="kp-panel-head"><h3>Team members</h3><span>Tap a person for details</span></div>
        <div className="kp-table-wrap">
          <table className="kp-table">
            <thead><tr><th>Person</th><th>Open now</th><th>Delivered</th><th>On time</th><th>Overdue</th><th>Avg days in stage</th><th>Recent weeks</th></tr></thead>
            <tbody>
              {data.people.map((p, i) => {
                const max = Math.max(1, ...p.weeks.map((w) => w.onTime + w.late));
                return (
                  <tr key={p.id}>
                    <td data-label="Person">
                      <button type="button" className="kp-person" onClick={() => setOpen(p)}>
                        {p.avatar
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={p.avatar} alt="" />
                          : <span style={{ background: AV[i % AV.length] }}>{ini(p.name)}</span>}
                        <span><b>{p.name}</b><small>{p.role}</small></span>
                      </button>
                    </td>
                    <td data-label="Open now"><b>{p.open}</b></td>
                    <td data-label="Delivered"><b>{p.delivered}</b></td>
                    <td data-label="On time">
                      {p.onTime == null ? <span className="kp-muted">—</span> : (
                        <span className="kp-ontime"><i><em className={tone(p.onTime)} style={{ width: `${p.onTime}%` }} /></i><b className={tone(p.onTime)}>{p.onTime}%</b></span>
                      )}
                    </td>
                    <td data-label="Overdue">{p.overdue ? <span className="kp-pill bad">{p.overdue}</span> : <span className="kp-muted">0</span>}</td>
                    <td data-label="Avg days in stage">{p.avgStageDays == null ? <span className="kp-muted">—</span> : days(p.avgStageDays)}</td>
                    <td data-label="Recent weeks">
                      <span className="kp-spark" aria-label={`Delivered per week: ${p.weeks.slice(-6).map((w) => w.onTime + w.late).join(", ")}`}>
                        {p.weeks.slice(-6).map((w, j, a) => <i key={j} className={j === a.length - 1 ? "last" : ""} style={{ height: Math.max(3, (26 * (w.onTime + w.late)) / max) }} />)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!data.people.length && <tr><td colSpan={8} className="kp-muted" style={{ padding: 18 }}>No one has content calendar work yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="kp-grid">
        <div className="kp-panel">
          <h3>Where work waits</h3>
          <p className="kp-sub">Average days a post spends in each stage</p>
          {t.stages.map((s) => (
            <div key={s.status} className="kp-row">
              <span>{s.name}</span>
              <i><em style={{ width: `${(100 * (s.days || 0)) / maxStage}%` }} className={"st-" + s.status} /></i>
              <b>{days(s.days)}</b>
            </div>
          ))}
          {slowest && slowest.days ? <p className="kp-callout">Slowest: <b>{slowest.name}</b>, posts wait {slowest.days} days on average.</p> : null}
        </div>
        <div className="kp-panel">
          <h3>By brand</h3>
          <p className="kp-sub">Planned to go live {data.period.kind === "week" ? "this week" : data.period.kind === "month" ? "this month" : "in the last 3 months"}: posted vs overdue</p>
          {t.brands.length === 0 && <p className="kp-muted">Nothing planned in this period.</p>}
          {t.brands.map((b) => (
            <div key={b.name} className="kp-brandrow">
              <div><b>{b.name}</b><span>{b.posted} of {b.planned} posted{b.overdue ? ` · ${b.overdue} overdue` : ""}</span></div>
              <i><em className="posted" style={{ width: `${(100 * b.posted) / b.planned}%` }} /><em className="over" style={{ width: `${(100 * b.overdue) / b.planned}%` }} /></i>
            </div>
          ))}
          <div className="kp-legend"><span><i className="posted" />Posted</span><span><i className="over" />Overdue</span><span><i />Still to do</span></div>
        </div>
      </div>
      <p className="kp-note">{historyNote}</p>

      {open && createPortal(
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="adm-drawer kp-drawer" role="dialog" aria-modal="true" aria-label={`${open.name} performance`}>
            <div className="kp-dhead">
              <div><h2>{open.name}</h2><p>{open.role} · {data.period.label}</p></div>
              <button type="button" className="kp-x" onClick={() => setOpen(null)} aria-label="Close">×</button>
            </div>
            <div className="kp-cards two">
              <div className="kp-card"><span>Delivered</span><b>{open.delivered}</b><Delta now={open.delivered} prev={open.deliveredPrev} /></div>
              <div className="kp-card"><span>On-time rate</span><b className={tone(open.onTime)}>{open.onTime == null ? "—" : `${open.onTime}%`}</b><Delta now={open.onTime} prev={open.onTimePrev} unit=" pts" /></div>
              <div className="kp-card"><span>Open now</span><b className="blue">{open.open}</b><span className="kp-delta">{open.overdue ? `${open.overdue} overdue` : "Nothing overdue"}</span></div>
              <div className="kp-card"><span>Days per stage</span><b className="blue">{days(open.avgStageDays)}</b><span className="kp-delta">Team {days(t.avgStageDays)}</span></div>
            </div>
            <div className="kp-panel"><h3>Delivered per week</h3><Bars weeks={open.weeks} height={100} /><Legend /></div>
            <div className="kp-panel">
              <h3>Recent work</h3>
              {open.recent.length === 0 && <p className="kp-muted">Nothing delivered in this period yet.</p>}
              {open.recent.map((r, i) => (
                <div key={i} className="kp-recent">
                  <span><b>{r.theme}</b><small>{r.client}{r.format ? ` · ${r.format}` : ""} · moved to {r.to} on {fmtDay(r.day)}</small></span>
                  <span className={"kp-pill " + (r.onTime ? "good" : "bad")}>{r.onTime ? "On time" : "Late"}</span>
                </div>
              ))}
              <Link href="/dashboard/social" className="kp-link">Open content calendar →</Link>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}

function Legend() {
  return <div className="kp-legend"><span><i className="posted" />On time</span><span><i className="over" />Late</span></div>;
}
