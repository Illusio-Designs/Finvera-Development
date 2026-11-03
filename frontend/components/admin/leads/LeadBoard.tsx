"use client";
/* Pipeline board: one column per stage (count + ₹ sum), cards dragged between
   and within columns on desktop. Phones have no drag: the columns scroll
   sideways with snap and each card's menu has "Move to…". The page owns the
   data; this only reports `onMove(id, stage, beforeId)`. */
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Building03Icon, Clock01Icon, MoreHorizontalIcon, ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { LeadRow, LeadStage } from "@/lib/adminApi";
import { initials, avatarColor, relative, istToday } from "@/lib/activityText";
import { STAGES, stageOf, progressOf, inr, inrShort, sumValue, firstName, followChip, byPosition, type StageDef } from "./leadKit";

type MoveFn = (id: number, to: LeadStage, beforeId: number | null) => void;

export default function LeadBoard({ leads, onOpen, onMove, onAdd, filtered }: {
  leads: LeadRow[]; onOpen: (l: LeadRow) => void; onMove: MoveFn; onAdd: () => void; filtered: boolean;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<{ stage: LeadStage; before: number | null } | null>(null);
  const [menu, setMenu] = useState<{ lead: LeadRow; x: number; y: number; up: boolean } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const today = istToday();

  const cols = STAGES.map((s) => ({ s, ls: leads.filter((l) => l.stage === s.id).sort(byPosition) }));

  function endDrag() { setDragId(null); setOver(null); }
  function drop(stage: LeadStage) {
    const id = dragId;
    const before = over?.stage === stage ? over.before : null;
    endDrag();
    if (id != null) onMove(id, stage, before);
  }
  /* Keep the board scrolling sideways while a card is held near its edge. */
  function edgeScroll(e: React.DragEvent) {
    const b = boardRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    if (e.clientX < r.left + 70) b.scrollLeft -= 14;
    else if (e.clientX > r.right - 70) b.scrollLeft += 14;
  }

  return (
    <>
      <div className={"ld-board" + (dragId != null ? " dragging" : "")} ref={boardRef} onDragOver={edgeScroll} role="list" aria-label="Pipeline">
        {cols.map(({ s, ls }) => (
          <section key={s.id} role="listitem" aria-label={`${s.name}: ${ls.length} lead${ls.length === 1 ? "" : "s"}`}
            className={"ld-col" + (over?.stage === s.id ? " over" : "")} style={{ "--c": s.c, "--c-bg": s.bg } as React.CSSProperties}
            onDragOver={(e) => { if (dragId == null) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over?.stage !== s.id) setOver({ stage: s.id, before: null }); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o?.stage === s.id ? null : o)); }}
            onDrop={(e) => { e.preventDefault(); drop(s.id); }}>
            <header className="ld-kh">
              <i className="ld-dot" aria-hidden />
              <b>{s.name}</b>
              <span className="ld-cnt">{ls.length}</span>
              <small title={inr(sumValue(ls))}>{inrShort(sumValue(ls))}</small>
            </header>
            {ls.map((l, i) => (
              <div key={l.id} className="ld-slot">
                {over?.stage === s.id && over.before === l.id && dragId !== l.id && <div className="ld-ph" aria-hidden />}
                <LeadCard lead={l} stage={s} today={today} dragging={dragId === l.id}
                  onOpen={() => onOpen(l)}
                  onMenu={(el) => {
                    const r = el.getBoundingClientRect();
                    const up = r.bottom + 300 > window.innerHeight;
                    setMenu({ lead: l, x: Math.max(8, Math.min(r.right - 220, window.innerWidth - 228)), y: up ? r.top - 6 : r.bottom + 6, up });
                  }}
                  onDragStart={(e) => {
                    setDragId(l.id);
                    try { e.dataTransfer.setData("text/plain", String(l.id)); e.dataTransfer.effectAllowed = "move"; } catch { /* old browsers */ }
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(e) => {
                    if (dragId == null) return;
                    e.preventDefault(); e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const after = e.clientY > r.top + r.height / 2;
                    const before = after ? (ls[i + 1]?.id ?? null) : l.id;
                    if (over?.stage !== s.id || over.before !== before) setOver({ stage: s.id, before });
                  }} />
              </div>
            ))}
            {over?.stage === s.id && over.before === null && dragId != null && <div className="ld-ph" aria-hidden />}
            {s.id === "new" ? (
              <button type="button" className="ld-addcard" onClick={onAdd}><HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />Add lead</button>
            ) : !ls.length && dragId == null ? (
              <div className="ld-colempty">{filtered ? "No matches here" : "Drag a lead here"}</div>
            ) : null}
          </section>
        ))}
      </div>
      {menu && <MoveMenu menu={menu} onClose={() => setMenu(null)} onOpen={() => { onOpen(menu.lead); setMenu(null); }}
        onMove={(to) => { setMenu(null); if (to !== menu.lead.stage) onMove(menu.lead.id, to, null); }} />}
    </>
  );
}

function LeadCard({ lead: l, stage: s, today, dragging, onOpen, onMenu, onDragStart, onDragEnd, onDragOver }: {
  lead: LeadRow; stage: StageDef; today: string; dragging: boolean; onOpen: () => void; onMenu: (el: HTMLElement) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>) => void; onDragEnd: () => void; onDragOver: (e: React.DragEvent<HTMLElement>) => void;
}) {
  const chip = followChip(l, today);
  const sub = [l.company, l.purpose].filter(Boolean).join(" · ");
  return (
    <article className={"ld-card" + (dragging ? " is-drag" : "")} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver}
      data-lead={l.id} onClick={(e) => { if (!(e.target as HTMLElement).closest("button,a")) onOpen(); }}>
      <div className="ld-row">
        <h4><button type="button" className="ld-open" onClick={onOpen}>{l.name}</button></h4>
        {l.priority === "high" && <span className="sh-pill red nodot">High</span>}
        {l.priority === "low" && <span className="sh-pill grey nodot">Low</span>}
        <button type="button" className="ld-more" aria-label={`Actions for ${l.name}`} aria-haspopup="menu"
          onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget); }}>
          <HugeiconsIcon icon={MoreHorizontalIcon} size={18} strokeWidth={1.8} />
        </button>
      </div>
      {sub && <span className="ld-co"><HugeiconsIcon icon={Building03Icon} size={15} strokeWidth={1.7} /><span>{sub}</span></span>}
      <span className="ld-amt">{Number(l.value) ? inr(l.value) : <span className="ld-muted">No value yet</span>}</span>
      <span className="ld-prog" aria-label={`Progress ${progressOf(l)}%`}><span className="ld-track"><i style={{ width: `${progressOf(l)}%` }} /></span>{progressOf(l)}%</span>
      <div className="ld-row ld-foot">
        {l.owner ? <span className="ld-owner" title={l.owner}><i className="ld-av" style={{ background: avatarColor(l.owner) }} aria-hidden>{initials(l.owner)}</i>{firstName(l.owner)}</span>
          : <span className="ld-owner ld-muted">Unassigned</span>}
        <span className="ld-sp" />
        {chip && <span className={"sh-pill nodot ld-chip " + chip.tone} title={chip.title}><HugeiconsIcon icon={Clock01Icon} size={13} strokeWidth={2} />{chip.text}</span>}
      </div>
      {(l.lastContactedAt || (l.stage === "lost" && l.lostReason)) && (
        <small className="ld-last">{l.stage === "lost" && l.lostReason ? `Lost: ${l.lostReason}` : `Contacted ${relative(l.lastContactedAt)}`}</small>
      )}
    </article>
  );
}

function MoveMenu({ menu, onClose, onOpen, onMove }: {
  menu: { lead: LeadRow; x: number; y: number; up: boolean }; onClose: () => void; onOpen: () => void; onMove: (to: LeadStage) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const out = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", out, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onClose, true);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", out, true); document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose); document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);
  const cur = stageOf(menu.lead.stage);
  return (
    <div ref={ref} className="sh-pop ld-menu" role="menu" aria-label={`Actions for ${menu.lead.name}`}
      style={{ left: menu.x, top: menu.up ? undefined : menu.y, bottom: menu.up ? window.innerHeight - menu.y : undefined }}>
      <div className="sh-menu">
        <button type="button" role="menuitem" onClick={onOpen}><HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={1.8} className="hgi" />Open lead</button>
        <hr />
        <div className="ld-menu-h">Move to…</div>
        {STAGES.map((s) => (
          <button key={s.id} type="button" role="menuitemradio" aria-checked={s.id === cur.id} onClick={() => onMove(s.id)}>
            <i className="ld-dot" style={{ background: s.c }} aria-hidden />{s.name}<small>{s.pct}%</small>
            {s.id === cur.id && <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} className="hgi ld-tick" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BoardSkeleton() {
  return (
    <div className="ld-board" aria-busy="true" aria-label="Loading leads">
      {STAGES.map((s, i) => (
        <section key={s.id} className="ld-col">
          <header className="ld-kh"><span className="skel skel-line" style={{ width: 90 }} /></header>
          {Array.from({ length: Math.max(1, 3 - (i % 3)) }).map((_, j) => <span key={j} className="skel ld-skelcard" />)}
        </section>
      ))}
    </div>
  );
}
