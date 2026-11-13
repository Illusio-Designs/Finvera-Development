"use client";
import { useResourceState } from "@/lib/useResourceState";
/* Monthly KPI report for the content calendar: pick a month (last month by
   default), see the team and brand tables with the change from the month
   before, and download both as one Excel file (sheets "Team" and "Brands"). */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { trackApi, type KpiReport } from "@/lib/adminApi";
import Select from "@/components/Select";
import { downloadXlsx } from "@/lib/xlsxWrite";
import { toast } from "@/lib/toast";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ym = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;
/* This month and the 17 before it (India time), newest first. */
function monthOptions() {
  const now = new Date(Date.now() + 330 * 60000);
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ value: ym(d.getUTCFullYear(), d.getUTCMonth()), label: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}${i === 0 ? " (so far)" : ""}` });
  }
  return out;
}
const num = (v: unknown) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));

function Change({ now, prev, unit = "", better = "up" }: { now: unknown; prev: unknown; unit?: string; better?: "up" | "down" }) {
  const a = num(now), b = num(prev);
  if (a == null || b == null) return <span className="exp-chg none" title="No figure for the month before">–</span>;
  const d = Math.round((a - b) * 10) / 10;
  if (!d) return <span className="exp-chg same" title={`Same as the month before (${b}${unit})`}>=</span>;
  const good = better === "up" ? d > 0 : d < 0;
  return <span className={"exp-chg " + (good ? "up" : "down")} title={`Month before: ${b}${unit}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}{unit}</span>;
}

export function MonthlyReportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="exp-reportbtn" onClick={() => setOpen(true)}>Monthly report</button>
      {open && createPortal(<MonthlyReport onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

export default function MonthlyReport({ onClose }: { onClose: () => void }) {
  const options = monthOptions();
  const [month, setMonth] = useState(options[1].value); // last month
  const { data, setData, error, setError, loading, setLoading } = useResourceState<KpiReport | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    trackApi.kpiReport(month)
      .then((r) => { if (alive) setData(r); })
      .catch((e) => { if (alive) { setData(null); setError(e?.status === 404 ? "The monthly report isn't on this server yet — update the backend." : e instanceof Error ? e.message : "Couldn't load the report."); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [month]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function download() {
    if (!data) return;
    downloadXlsx(`finvera-kpi-report-${data.month}.xlsx`, [
      { name: "Team", columns: data.columns, rows: data.rows },
      { name: "Brands", columns: data.brandColumns, rows: data.brandRows },
    ]);
    toast("Report downloaded", "ok", { description: `finvera-kpi-report-${data.month}.xlsx` });
  }

  const t = data?.team;
  const label = data?.label || options.find((o) => o.value === month)?.label || month;
  return (
    <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-drawer exp-report" role="dialog" aria-modal="true" aria-label="Monthly report">
        <div className="exp-rhead">
          <div><h2>Monthly report</h2><p>Content calendar delivery for the whole team, compared with the month before.</p></div>
          <button type="button" className="exp-x" onClick={onClose} aria-label="Close"><HugeiconsIcon icon={Cancel01Icon} size={18} /></button>
        </div>
        <div className="exp-rbar">
          <div className="exp-month"><Select value={month} onChange={setMonth} options={options} ariaLabel="Month" /></div>
          <button type="button" className="adm-btn primary" onClick={download} disabled={!data || loading}>
            <HugeiconsIcon icon={Download04Icon} size={16} strokeWidth={1.8} />Download Excel
          </button>
        </div>

        {error ? <div className="adm-msg err">{error}</div>
          : loading || !data ? <div className="exp-loading">Loading {label}…</div>
          : (
            <>
              {t && (
                <div className="exp-cards">
                  <div className="exp-card"><span>Completed assignments</span><b>{t.delivered}</b><Change now={t.delivered} prev={t.deliveredPrev} /></div>
                  <div className="exp-card"><span>On time</span><b>{t.onTime == null ? "—" : `${t.onTime}%`}</b><Change now={t.onTime} prev={t.onTimePrev} unit=" pts" /></div>
                  <div className="exp-card"><span>Hours logged</span><b>{t.hours ?? 0}</b><small>{t.estHours != null ? `Estimated ${t.estHours} h` : "No estimates"}</small></div>
                  <div className="exp-card"><span>Avg days per stage</span><b>{t.avgStageDays ?? "—"}</b><small>{t.overdue ? `${t.overdue} overdue now` : "Nothing overdue now"}</small></div>
                </div>
              )}

              <h3 className="exp-h3">Team · {label}</h3>
              <div className="exp-tablewrap">
                <table className="exp-table">
                  <thead><tr><th>Person</th><th>Delivered</th><th>On time</th><th>Avg days in stage</th><th>Hours</th><th>Open now</th><th>Overdue now</th></tr></thead>
                  <tbody>
                    {data.rows.map((r, i) => (
                      <tr key={i}>
                        <td><b>{r.Name}</b><small>{r.Role}</small></td>
                        <td><span className="exp-n">{r.Delivered}</span><Change now={r.Delivered} prev={r["Delivered (previous month)"]} /></td>
                        <td><span className="exp-n">{r["On time %"] === "" ? "—" : `${r["On time %"]}%`}</span><Change now={r["On time %"]} prev={r["On time % (previous month)"]} unit=" pts" /></td>
                        <td>{r["Avg days in stage"] === "" ? "—" : r["Avg days in stage"]}</td>
                        <td>{r["Hours logged"]}{r["Estimated hours"] !== "" && r["Estimated hours"] != null ? <small>of {r["Estimated hours"]} est.</small> : null}</td>
                        <td>{r["Open now"]}</td>
                        <td>{Number(r["Overdue now"]) ? <span className="exp-bad">{r["Overdue now"]}</span> : 0}</td>
                      </tr>
                    ))}
                    {!data.rows.length && <tr><td colSpan={7} className="exp-none">No one had content calendar work this month.</td></tr>}
                  </tbody>
                </table>
              </div>

              <h3 className="exp-h3">Brands · {label}</h3>
              <div className="exp-tablewrap">
                <table className="exp-table">
                  <thead><tr><th>Brand</th><th>Planned</th><th>Posted</th><th>Overdue</th><th>Done</th></tr></thead>
                  <tbody>
                    {data.brandRows.map((b, i) => {
                      const pct = Number(b.Planned) ? Math.round((100 * Number(b.Posted)) / Number(b.Planned)) : null;
                      return (
                        <tr key={i}>
                          <td><b>{b.Brand}</b></td><td>{b.Planned}</td><td>{b.Posted}</td>
                          <td>{Number(b.Overdue) ? <span className="exp-bad">{b.Overdue}</span> : 0}</td>
                          <td>{pct == null ? "—" : <span className="exp-pct"><i><em style={{ width: `${pct}%` }} /></i>{pct}%</span>}</td>
                        </tr>
                      );
                    })}
                    {!data.brandRows.length && <tr><td colSpan={5} className="exp-none">Nothing was planned to go live this month.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="exp-foot">▲ / ▼ compare with the month before. Brand numbers count posts planned to go live in {label}.</p>
            </>
          )}
      </div>
    </div>
  );
}
