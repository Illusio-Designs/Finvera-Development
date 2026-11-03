"use client";
/* The two small dialogs behind the row buttons:
   Renewed — old date → new date (one cycle on, can be changed), a remark with
   quick picks and "last renewed on = today"; Terminate — why it is ending. */
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, ArrowRight02Icon, Tick02Icon, StopCircleIcon } from "@hugeicons/core-free-icons";
import type { RenewalRow } from "@/lib/adminApi";
import DatePicker from "@/components/ui/DatePicker";
import { RENEW_PICKS, END_PICKS, nextDate, fmtDay, day10, cycleOf, label, inr, istToday } from "./renewalKit";

export type RenewChoice = { remark: string; renewalDate: string; invoiced: boolean; picked: boolean };

function useEscape(onCancel: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onCancel(); } };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [onCancel]);
}

/* Quick picks add to the box (or take themselves out); the caret goes to the end so typing carries on. */
function Picks({ picks, value, onChange, field }: { picks: string[]; value: string; onChange: (v: string) => void; field: React.RefObject<HTMLTextAreaElement | null> }) {
  const onPick = (v: string) => {
    onChange(v);
    requestAnimationFrame(() => { const t = field.current; if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } });
  };
  return (
    <div className="rn-chips">
      {picks.map((p) => (
        <button key={p} type="button" className={"rn-qchip" + (value.includes(p) ? " on" : "")}
          aria-pressed={value.includes(p)}
          onClick={() => onPick(value.includes(p) ? value.split(" · ").filter((x) => x.trim() !== p).join(" · ") : value.trim() ? `${value.trim()} · ${p}` : p)}>{p}</button>
      ))}
    </div>
  );
}

export function RenewDialog({ row, onDone }: { row: RenewalRow; onDone: (v: RenewChoice | null) => void }) {
  const computed = nextDate(row);
  const [date, setDate] = useState(computed);
  const [remark, setRemark] = useState("");
  const [invoiced, setInvoiced] = useState(true);
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancel = () => onDone(null);
  useEscape(cancel);
  useEffect(() => { ref.current?.focus(); }, []);
  const old = day10(row.renewalDate);
  const bad = !/^\d{4}-\d{2}-\d{2}$/.test(date);
  const ok = () => { if (!bad) onDone({ remark: remark.trim(), renewalDate: date, invoiced, picked: date !== computed }); };
  const cyc = cycleOf(row.cycle);
  return (
    <div className="rn-dlg-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="rn-dlg" role="dialog" aria-modal="true" aria-labelledby="rn-renew-t">
        <div className="rn-dlg-h">
          <span className="rn-dlg-ic green" aria-hidden><HugeiconsIcon icon={Tick02Icon} size={18} strokeWidth={2} /></span>
          <div><h3 id="rn-renew-t">Renewed: {label(row)}?</h3><p>{Number(row.amount) ? `${inr(row.amount)} · ` : ""}{cyc.name} billing. The next date moves on one cycle — change it if the client agreed something else.</p></div>
          <button type="button" className="sh-icb sm plain" onClick={cancel} aria-label="Cancel"><HugeiconsIcon icon={Cancel01Icon} size={17} strokeWidth={1.8} /></button>
        </div>
        <div className="rn-dates">
          <div className="rn-date-old"><small>Was due</small><b>{old ? fmtDay(old) : "No date"}</b></div>
          <HugeiconsIcon icon={ArrowRight02Icon} size={18} strokeWidth={1.8} className="rn-date-arrow" />
          <div className="rn-date-new">
            <label htmlFor="rn-next">Next renewal</label>
            <DatePicker id="rn-next" value={date} onChange={(v) => setDate(v || computed)} />
            {date !== computed && <button type="button" className="sh-link muted rn-reset" onClick={() => setDate(computed)}>Back to {fmtDay(computed)} (+1 {cyc.months === 1 ? "month" : cyc.months === 12 ? "year" : `${cyc.months} months`})</button>}
          </div>
        </div>
        <label className="rn-field">
          <span className="rn-lbl">Remark</span>
          <textarea ref={ref} rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Invoice #214 paid by NEFT" maxLength={1000}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ok(); } }} />
        </label>
        <Picks picks={RENEW_PICKS} value={remark} onChange={setRemark} field={ref} />
        <label className="rn-check">
          <input type="checkbox" checked={invoiced} onChange={(e) => setInvoiced(e.target.checked)} />
          <span>Set <b>last renewed on</b> to today ({fmtDay(istToday())})</span>
        </label>
        <div className="rn-dlg-f">
          <button type="button" className="sh-btn" onClick={cancel}>Cancel</button>
          <button type="button" className="sh-btn rn-solid-green" onClick={ok} disabled={bad}><HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} />Mark as renewed</button>
        </div>
      </div>
    </div>
  );
}

export function EndDialog({ row, onDone }: { row: RenewalRow; onDone: (reason: string | null) => void }) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const cancel = () => onDone(null);
  useEscape(cancel);
  useEffect(() => { ref.current?.focus(); }, []);
  const ok = () => onDone(v.trim());
  return (
    <div className="rn-dlg-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}>
      <div className="rn-dlg" role="dialog" aria-modal="true" aria-labelledby="rn-end-t">
        <div className="rn-dlg-h">
          <span className="rn-dlg-ic red" aria-hidden><HugeiconsIcon icon={StopCircleIcon} size={18} strokeWidth={1.8} /></span>
          <div><h3 id="rn-end-t">Terminate {label(row)}?</h3><p>It stops renewing and no more reminders are sent. You can restore it later. Why is it ending?</p></div>
          <button type="button" className="sh-icb sm plain" onClick={cancel} aria-label="Cancel"><HugeiconsIcon icon={Cancel01Icon} size={17} strokeWidth={1.8} /></button>
        </div>
        <label className="rn-field">
          <span className="rn-lbl">Reason</span>
          <textarea ref={ref} rows={2} value={v} onChange={(e) => setV(e.target.value)} placeholder="e.g. Client moved to another agency" maxLength={1000}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ok(); } }} />
        </label>
        <Picks picks={END_PICKS} value={v} onChange={setV} field={ref} />
        <div className="rn-dlg-f">
          <button type="button" className="sh-btn" onClick={cancel}>Cancel</button>
          <button type="button" className="sh-btn rn-solid-red" onClick={ok}>Terminate</button>
        </div>
      </div>
    </div>
  );
}
