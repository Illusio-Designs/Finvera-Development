"use client";
/* Small dialog when a lead is moved to "Lost": why? (quick picks or free text). */
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { LOST_REASONS } from "./leadKit";

export default function LostDialog({ name, initial, onDone }: { name: string; initial?: string | null; onDone: (reason: string | null) => void }) {
  const [v, setV] = useState(initial || "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onDone(null); } };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [onDone]);
  const ok = () => onDone(v.trim());
  return (
    <div className="ld-dlg-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onDone(null); }}>
      <div className="ld-dlg" role="dialog" aria-modal="true" aria-labelledby="ld-lost-t">
        <div className="ld-dlg-h">
          <div><h3 id="ld-lost-t">Mark {name} as lost?</h3><p>Note why — it helps spot patterns later. You can leave it blank.</p></div>
          <button type="button" className="sh-icb sm plain" onClick={() => onDone(null)} aria-label="Cancel"><HugeiconsIcon icon={Cancel01Icon} size={17} strokeWidth={1.8} /></button>
        </div>
        <label className="ld-field">
          <span className="ld-lbl">Lost reason</span>
          <input ref={ref} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } }}
            placeholder="e.g. Budget, went with another agency" maxLength={500} />
        </label>
        <div className="ld-chips">{LOST_REASONS.map((r) => <button key={r} type="button" className={"ld-qchip" + (v === r ? " on" : "")} onClick={() => setV(r)}>{r}</button>)}</div>
        <div className="ld-dlg-f">
          <button type="button" className="sh-btn" onClick={() => onDone(null)}>Cancel</button>
          <button type="button" className="sh-btn ld-solid-red" onClick={ok}>Mark as lost</button>
        </div>
      </div>
    </div>
  );
}
