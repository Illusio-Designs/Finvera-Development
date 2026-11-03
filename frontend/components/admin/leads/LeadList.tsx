"use client";
/* List view: a sortable table on desktop, a card list on phones. Rows come
   already searched / filtered from the page; sorting lives here. */
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon, UnfoldMoreIcon, Clock01Icon } from "@hugeicons/core-free-icons";
import type { LeadRow } from "@/lib/adminApi";
import { initials, avatarColor, relative, istToday, whenOf } from "@/lib/activityText";
import { STAGES, stageOf, progressOf, inr, followChip, followDay, byPosition } from "./leadKit";

type Key = "name" | "company" | "stage" | "value" | "owner" | "followup" | "lastContactedAt" | "source";
const COLS: { k: Key; label: string; num?: boolean }[] = [
  { k: "name", label: "Lead" }, { k: "company", label: "Company" }, { k: "stage", label: "Stage" }, { k: "value", label: "Value", num: true },
  { k: "owner", label: "Owner" }, { k: "followup", label: "Follow-up" }, { k: "lastContactedAt", label: "Last contacted" }, { k: "source", label: "Source" },
];
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));
const PAGE = 50;

export default function LeadList({ leads, onOpen }: { leads: LeadRow[]; onOpen: (l: LeadRow) => void }) {
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const today = istToday();

  const rows = useMemo(() => {
    const base = [...leads].sort((a, b) => STAGE_IDX[a.stage] - STAGE_IDX[b.stage] || byPosition(a, b));
    if (!sort) return base;
    const val = (l: LeadRow): string | number => {
      switch (sort.k) {
        case "value": return Number(l.value) || 0;
        case "stage": return STAGE_IDX[l.stage] ?? 9;
        case "followup": return followDay(l) || "9999";
        case "lastContactedAt": return l.lastContactedAt ? Date.parse(l.lastContactedAt) : 0;
        default: return String(l[sort.k] || "").toLowerCase() || "￿";
      }
    };
    return base.sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return c * sort.dir;
    });
  }, [leads, sort]);

  const toggle = (k: Key) => setSort((s) => (s?.k === k ? (s.dir === 1 ? { k, dir: -1 } : null) : { k, dir: k === "value" || k === "lastContactedAt" ? -1 : 1 }));
  const page = rows.slice(0, shown);

  return (
    <div className="ld-listwrap">
      <div className="ld-tbl-wrap">
        <table className="ld-tbl">
          <thead>
            <tr>
              {COLS.map((c) => {
                const on = sort?.k === c.k;
                return (
                  <th key={c.k} className={c.num ? "num" : undefined} aria-sort={on ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}>
                    <button type="button" className={"ld-th" + (on ? " on" : "")} onClick={() => toggle(c.k)}>
                      {c.label}
                      <HugeiconsIcon icon={on ? (sort!.dir === 1 ? ArrowUp01Icon : ArrowDown01Icon) : UnfoldMoreIcon} size={14} strokeWidth={2} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {page.map((l) => {
              const s = stageOf(l.stage), chip = followChip(l, today);
              return (
                <tr key={l.id} tabIndex={0} onClick={() => onOpen(l)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(l); } }} aria-label={`Open ${l.name}`}>
                  <td><b>{l.name}</b>{l.purpose && <small className="ld-sub">{l.purpose}</small>}</td>
                  <td>{l.company || <span className="ld-muted">—</span>}</td>
                  <td><span className={"sh-pill " + s.tone}>{s.name}</span><small className="ld-pct">{progressOf(l)}%</small></td>
                  <td className="num"><b>{Number(l.value) ? inr(l.value) : <span className="ld-muted">—</span>}</b></td>
                  <td>{l.owner ? <span className="ld-owner"><i className="ld-av" style={{ background: avatarColor(l.owner) }} aria-hidden>{initials(l.owner)}</i>{l.owner}</span> : <span className="ld-muted">—</span>}</td>
                  <td>{chip ? <span className={"sh-pill nodot ld-chip " + chip.tone} title={chip.title}><HugeiconsIcon icon={Clock01Icon} size={13} strokeWidth={2} />{chip.text}</span> : <span className="ld-muted">—</span>}</td>
                  <td>{l.lastContactedAt ? <span title={whenOf(l.lastContactedAt)}>{relative(l.lastContactedAt)}</span> : <span className="ld-muted">Never</span>}</td>
                  <td>{l.source || <span className="ld-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones: cards instead of the wide table. */}
      <ul className="ld-mlist">
        {page.map((l) => {
          const s = stageOf(l.stage), chip = followChip(l, today);
          return (
            <li key={l.id}>
              <button type="button" className="ld-mcard" onClick={() => onOpen(l)}>
                <span className="ld-row"><b>{l.name}</b><span className="ld-sp" /><span className={"sh-pill " + s.tone}>{s.name}</span></span>
                {(l.company || l.purpose) && <small>{[l.company, l.purpose].filter(Boolean).join(" · ")}</small>}
                <span className="ld-row">
                  <b className="ld-mval">{Number(l.value) ? inr(l.value) : "—"}</b>
                  <span className="ld-sp" />
                  {chip && <span className={"sh-pill nodot ld-chip " + chip.tone}><HugeiconsIcon icon={Clock01Icon} size={13} strokeWidth={2} />{chip.text}</span>}
                </span>
                <span className="ld-row ld-mmeta">
                  {l.owner && <span className="ld-owner"><i className="ld-av" style={{ background: avatarColor(l.owner) }} aria-hidden>{initials(l.owner)}</i>{l.owner}</span>}
                  <span className="ld-sp" />
                  <span>{l.lastContactedAt ? `Contacted ${relative(l.lastContactedAt)}` : l.source || ""}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {rows.length > shown && (
        <button type="button" className="sh-btn ld-more-btn" onClick={() => setShown((n) => n + PAGE)}>
          Show {Math.min(PAGE, rows.length - shown)} more · {rows.length - shown} left
        </button>
      )}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="ld-tbl-wrap ld-skel-list" aria-busy="true" aria-label="Loading leads">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="ld-skelrow">
          <span className="skel skel-line" style={{ width: "22%" }} />
          <span className="skel skel-line" style={{ width: "16%" }} />
          <span className="skel skel-line" style={{ width: "10%" }} />
          <span className="skel skel-line" style={{ width: "12%" }} />
          <span className="skel skel-line" style={{ width: "14%" }} />
        </div>
      ))}
    </div>
  );
}
