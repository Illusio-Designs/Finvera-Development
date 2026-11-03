"use client";
/* One board: header (name editable in place, members, actions), filters
   (client chips, member, label, due, search), and the lists. Cards drag
   between and within lists on desktop; phones scroll the lists sideways with
   snap and each card's menu has "Move to…". The page owns the data — this
   reports moves, quick-adds and opens. */
import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon, Search01Icon, Cancel01Icon, ArrowLeft01Icon, Settings02Icon, Download04Icon, MoreHorizontalIcon, ArrowRight01Icon,
  Tick02Icon, Calendar03Icon, Attachment01Icon, Comment01Icon, RepeatIcon, Alert02Icon, PencilEdit02Icon, Flag02Icon,
} from "@hugeicons/core-free-icons";
import type { BoardRow, BoardUser, CardRow, BoardList } from "@/lib/adminApi";
import Select from "@/components/Select";
import { istToday } from "@/lib/activityText";
import {
  toneOf, isDoneList, byPos, plural, dueInfo, isOverdue, dueThisWeek, plainText, clientColor, clientTag, shortDay, day10, type Tone,
} from "./boardKit";
import { AvStack } from "./Avatars";

export type MoveFn = (id: number, toCol: string, beforeId: number | null) => void;
type Due = "" | "overdue" | "week" | "none" | "renewal";

export default function BoardView({ board, cards, users, exporting, onBack, onRename, onSettings, onExport, onOpen, onNew, onQuickAdd, onMove }: {
  board: BoardRow; cards: CardRow[] | null; users: BoardUser[]; exporting: boolean;
  onBack: () => void; onRename: (name: string) => Promise<boolean>; onSettings: () => void; onExport: () => void;
  onOpen: (c: CardRow) => void; onNew: (col: string) => void; onQuickAdd: (col: string, title: string) => Promise<boolean>; onMove: MoveFn;
}) {
  const today = istToday();
  const [q, setQ] = useState("");
  const [fClient, setFClient] = useState("");
  const [fMember, setFMember] = useState("");
  const [fLabel, setFLabel] = useState("");
  const [fDue, setFDue] = useState<Due>("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<{ col: string; before: number | null } | null>(null);
  const [menu, setMenu] = useState<{ card: CardRow; x: number; y: number; up: boolean } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const all = cards || [];
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const labelById = useMemo(() => new Map(board.labels.map((l) => [l.id, l])), [board.labels]);
  const doneCols = useMemo(() => new Set(board.columns.filter((c) => isDoneList(c)).map((c) => c.id)), [board.columns]);
  const isDone = (t: CardRow) => doneCols.has(t.column) || !!t.completed;

  /* ── filters ── */
  const clients = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of all) { const c = String(t.client || "").trim(); if (c) m.set(c, (m.get(c) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [all]);
  const noClient = all.filter((t) => !String(t.client || "").trim()).length;
  const memberOpts = useMemo(() => {
    const ids = new Set(all.flatMap((t) => t.memberIds));
    return users.filter((u) => ids.has(u.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [all, users]);
  const needle = q.trim().toLowerCase();
  const match = (t: CardRow) => {
    if (fClient && (fClient === "__none" ? String(t.client || "").trim() : String(t.client || "").trim() !== fClient)) return false;
    if (fMember && (fMember === "__none" ? t.memberIds.length > 0 : !t.memberIds.includes(Number(fMember)))) return false;
    if (fLabel && !t.labelIds.includes(fLabel)) return false;
    if (fDue === "overdue" && !isOverdue(t, doneCols.has(t.column), today)) return false;
    if (fDue === "week" && !dueThisWeek(t, doneCols.has(t.column), today)) return false;
    if (fDue === "none" && day10(t.dueDate)) return false;
    if (fDue === "renewal" && !day10(t.renewalDate)) return false;
    if (needle) {
      const hay = [t.title, plainText(t.description), t.client, ...t.labelIds.map((id) => labelById.get(id)?.name), ...t.memberIds.map((id) => userById.get(id)?.name)].join(" ").toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  };
  const filtering = !!(needle || fClient || fMember || fLabel || fDue);
  const clearFilters = () => { setQ(""); setFClient(""); setFMember(""); setFLabel(""); setFDue(""); };
  const shown = all.filter(match);

  const stats = {
    open: all.filter((t) => !isDone(t)).length,
    week: all.filter((t) => dueThisWeek(t, doneCols.has(t.column), today)).length,
    late: all.filter((t) => isOverdue(t, doneCols.has(t.column), today)).length,
    renew: all.filter((t) => day10(t.renewalDate)).length,
  };
  const members = useMemo(() => [...new Set(all.flatMap((t) => t.memberIds))].map((id) => userById.get(id)).filter(Boolean) as BoardUser[], [all, userById]);

  /* ── drag ── */
  function endDrag() { setDragId(null); setOver(null); }
  function drop(col: string) {
    const id = dragId, before = over?.col === col ? over.before : null;
    endDrag();
    if (id != null) onMove(id, col, before);
  }
  function edgeScroll(e: React.DragEvent) {
    const b = boardRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    if (e.clientX < r.left + 70) b.scrollLeft -= 16;
    else if (e.clientX > r.right - 70) b.scrollLeft += 16;
  }

  return (
    <div className="td kb-page">
      <div className="td-hello">
        <div className="td-hello-tx">
          <div className="td-eyebrow">Project board</div>
          <BoardName name={board.name} onRename={onRename} />
          <p>{board.description || "Drag a card to move it, or open it for details."}</p>
        </div>
        <div className="td-acts kb-acts">
          {members.length > 0 && <AvStack users={members} max={5} size={30} label={`Members: ${members.map((m) => m.name).join(", ")}`} />}
          <button type="button" className="sh-btn" onClick={onBack}><HugeiconsIcon icon={ArrowLeft01Icon} size={17} strokeWidth={1.8} />All boards</button>
          <button type="button" className="sh-btn" onClick={onExport} disabled={exporting} title="Download this board's cards as an Excel file">
            {exporting ? <span className="spin kb-spin" aria-hidden /> : <HugeiconsIcon icon={Download04Icon} size={17} strokeWidth={1.8} />}{exporting ? "Preparing…" : "Export"}
          </button>
          <button type="button" className="sh-btn" onClick={onSettings} aria-label="Board settings" title="Board settings: lists, labels, name">
            <HugeiconsIcon icon={Settings02Icon} size={17} strokeWidth={1.8} /><span className="kb-hide-sm">Settings</span>
          </button>
          <button type="button" className="sh-btn pri" onClick={() => onNew(board.columns[0]?.id || "todo")}><HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />New task</button>
        </div>
      </div>

      {(clients.length > 0) && (
        <div className="kb-chips" role="group" aria-label="Filter by client">
          <button type="button" className="kb-chipf" aria-pressed={!fClient} onClick={() => setFClient("")}>All clients<em>{all.length}</em></button>
          {clients.map(([c, n]) => (
            <button key={c} type="button" className="kb-chipf" aria-pressed={fClient === c} onClick={() => setFClient(fClient === c ? "" : c)}>
              <i style={{ background: clientColor(c) }} aria-hidden />{c}<em>{n}</em>
            </button>
          ))}
          {noClient > 0 && <button type="button" className="kb-chipf" aria-pressed={fClient === "__none"} onClick={() => setFClient(fClient === "__none" ? "" : "__none")}>No client<em>{noClient}</em></button>}
        </div>
      )}

      <div className="kb-toolbar">
        <label className="kb-search">
          <span className="sh-sr">Search cards</span>
          <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.8} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards…" type="search" />
          {q && <button type="button" className="kb-x" onClick={() => setQ("")} aria-label="Clear search"><HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} /></button>}
        </label>
        <div className="kb-filters">
          <div className="kb-fsel"><Select value={fMember} onChange={setFMember} ariaLabel="Member" placeholder="All members"
            options={[{ value: "", label: "All members" }, ...memberOpts.map((u) => ({ value: String(u.id), label: u.name })), { value: "__none", label: "Unassigned" }]} /></div>
          <div className="kb-fsel"><Select value={fLabel} onChange={setFLabel} ariaLabel="Label" placeholder="All labels"
            options={[{ value: "", label: "All labels" }, ...board.labels.map((l) => ({ value: l.id, label: l.name }))]} /></div>
          <div className="kb-fsel"><Select value={fDue} onChange={(v) => setFDue(v as Due)} ariaLabel="Due date" placeholder="Any due date"
            options={[{ value: "", label: "Any due date" }, { value: "overdue", label: "Overdue" }, { value: "week", label: "Due this week" }, { value: "none", label: "No due date" }, { value: "renewal", label: "Tied to a renewal" }]} /></div>
          {filtering && <button type="button" className="sh-link kb-clearall" onClick={clearFilters}>Clear filters</button>}
        </div>
      </div>

      <div className="kb-stats" aria-live="polite">
        {cards ? <>
          <span><b>{stats.open}</b> open {stats.open === 1 ? "task" : "tasks"}</span>
          <span><b>{stats.week}</b> due this week</span>
          <span><b className={stats.late ? "kb-red" : ""}>{stats.late}</b> overdue</span>
          <span><b className="kb-violet">{stats.renew}</b> tied to a renewal</span>
          {filtering && <span className="kb-match">{plural(shown.length, "card")} match{shown.length === 1 ? "es" : ""}</span>}
        </> : <span className="skel skel-line" style={{ width: 280 }} />}
      </div>

      {!cards ? <ListsSkeleton n={Math.max(3, board.columns.length)} /> : (
        <div className={"kb-lists" + (dragId != null ? " is-dragging" : "")} ref={boardRef} onDragOver={edgeScroll} role="list" aria-label={`${board.name} lists`}>
          {board.columns.map((col, ci) => {
            const tone = toneOf(col, ci);
            const inCol = all.filter((t) => t.column === col.id).sort(byPos);
            const vis = inCol.filter(match);
            const lateN = doneCols.has(col.id) ? 0 : inCol.filter((t) => isOverdue(t, false, today)).length;
            return (
              <section key={col.id} role="listitem" className={`kb-list kb-t-${tone}` + (over?.col === col.id ? " over" : "")}
                aria-label={`${col.title}: ${plural(inCol.length, "card")}`}
                onDragOver={(e) => { if (dragId == null) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over?.col !== col.id) setOver({ col: col.id, before: null }); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o?.col === col.id ? null : o)); }}
                onDrop={(e) => { e.preventDefault(); drop(col.id); }}>
                <header className="kb-lh">
                  <i className="kb-dot" aria-hidden />
                  <b>{col.title}</b>
                  <span className="kb-cnt">{filtering ? `${vis.length}/${inCol.length}` : inCol.length}</span>
                  {lateN > 0 && <small className="kb-red">{lateN} overdue</small>}
                </header>
                <div className="kb-stack">
                  {vis.map((t, i) => (
                    <div key={t.id} className="kb-slot">
                      {over?.col === col.id && over.before === t.id && dragId !== t.id && <div className="kb-ph" aria-hidden />}
                      <BoardCard card={t} tone={tone} done={doneCols.has(t.column)} today={today} users={userById} labels={labelById}
                        dragging={dragId === t.id} onOpen={() => onOpen(t)}
                        onMenu={(el) => {
                          const r = el.getBoundingClientRect();
                          const up = r.bottom + 320 > window.innerHeight;
                          setMenu({ card: t, x: Math.max(8, Math.min(r.right - 230, window.innerWidth - 238)), y: up ? r.top - 6 : r.bottom + 6, up });
                        }}
                        onDragStart={(e) => { setDragId(t.id); try { e.dataTransfer.setData("text/plain", String(t.id)); e.dataTransfer.effectAllowed = "move"; } catch { /* old browsers */ } }}
                        onDragEnd={endDrag}
                        onDragOver={(e) => {
                          if (dragId == null) return;
                          e.preventDefault(); e.stopPropagation();
                          const r = e.currentTarget.getBoundingClientRect();
                          const after = e.clientY > r.top + r.height / 2;
                          const before = after ? (vis[i + 1]?.id ?? null) : t.id;
                          if (over?.col !== col.id || over.before !== before) setOver({ col: col.id, before });
                        }} />
                    </div>
                  ))}
                  {over?.col === col.id && over.before === null && dragId != null && <div className="kb-ph" aria-hidden />}
                  {!vis.length && dragId == null && adding !== col.id && (
                    <div className="kb-colempty">{filtering && inCol.length ? "No matches here" : "No cards yet — drag one here or add a task"}</div>
                  )}
                </div>
                {adding === col.id ? (
                  <QuickAdd onCancel={() => setAdding(null)} onAdd={(title) => onQuickAdd(col.id, title)} onMore={() => { setAdding(null); onNew(col.id); }} />
                ) : (
                  <button type="button" className="kb-addtask" onClick={() => setAdding(col.id)}><HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={1.8} />Add task</button>
                )}
              </section>
            );
          })}
          {board.columns.length === 0 && (
            <div className="sh-empty kb-nolists"><b>This board has no lists</b><span>Add lists in Board settings.</span>
              <button type="button" className="sh-btn sm" onClick={onSettings}><HugeiconsIcon icon={Settings02Icon} size={15} strokeWidth={1.8} />Board settings</button></div>
          )}
        </div>
      )}

      {menu && <MoveMenu menu={menu} lists={board.columns} onClose={() => setMenu(null)} onOpen={() => { onOpen(menu.card); setMenu(null); }}
        onMove={(to) => { const c = menu.card; setMenu(null); if (to !== c.column) onMove(c.id, to, null); }} />}
    </div>
  );
}

/* Board name: click (or the pencil) to rename in place; Enter saves, Esc cancels. */
function BoardName({ name, onRename }: { name: string; onRename: (n: string) => Promise<boolean> }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!edit) setV(name); }, [name, edit]);
  useEffect(() => { if (edit) { ref.current?.focus(); ref.current?.select(); } }, [edit]);
  async function commit() {
    const n = v.trim();
    if (!n || n === name) { setEdit(false); setV(name); return; }
    setBusy(true);
    const ok = await onRename(n);
    setBusy(false);
    if (ok) setEdit(false);
  }
  if (edit) {
    return (
      <h1 className="kb-title">
        <input ref={ref} className="kb-title-in" value={v} disabled={busy} maxLength={120} aria-label="Board name"
          onChange={(e) => setV(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } if (e.key === "Escape") { e.preventDefault(); setV(name); setEdit(false); } }} />
      </h1>
    );
  }
  return (
    <h1 className="kb-title">
      <button type="button" className="kb-title-btn" onClick={() => setEdit(true)} title="Rename board">
        {name}<HugeiconsIcon icon={PencilEdit02Icon} size={18} strokeWidth={1.8} className="kb-title-ic" aria-hidden />
      </button>
    </h1>
  );
}

function QuickAdd({ onAdd, onCancel, onMore }: { onAdd: (t: string) => Promise<boolean>; onCancel: () => void; onMore: () => void }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  async function add() {
    const t = v.trim();
    if (!t) { ref.current?.focus(); return; }
    setBusy(true);
    const ok = await onAdd(t);
    setBusy(false);
    if (ok) { setV(""); setTimeout(() => ref.current?.focus(), 0); }
  }
  return (
    <div className="kb-quick">
      <textarea ref={ref} rows={2} value={v} disabled={busy} placeholder="What needs doing? Enter to add" aria-label="New task title" maxLength={250}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } if (e.key === "Escape") { e.preventDefault(); onCancel(); } }}
        onBlur={(e) => { if (!v.trim() && !e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) onCancel(); }} />
      <div className="kb-quick-row">
        <button type="button" className="sh-btn pri sm" onClick={add} disabled={busy}>{busy ? "Adding…" : "Add task"}</button>
        <button type="button" className="sh-link kb-quick-more" onClick={onMore}>Add with details</button>
        <span className="kb-sp" />
        <button type="button" className="sh-icb sm plain" onClick={onCancel} aria-label="Cancel"><HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={1.8} /></button>
      </div>
    </div>
  );
}

function BoardCard({ card: t, tone, done, today, users, labels, dragging, onOpen, onMenu, onDragStart, onDragEnd, onDragOver }: {
  card: CardRow; tone: Tone; done: boolean; today: string; users: Map<number, BoardUser>; labels: Map<string, { id: string; name: string; color: string }>;
  dragging: boolean; onOpen: () => void; onMenu: (el: HTMLElement) => void;
  onDragStart: (e: React.DragEvent<HTMLElement>) => void; onDragEnd: () => void; onDragOver: (e: React.DragEvent<HTMLElement>) => void;
}) {
  const ck = t.checklist, ckDone = ck.filter((c) => c.done).length;
  const due = dueInfo(t, done, today);
  const renew = day10(t.renewalDate);
  const desc = plainText(t.description);
  const cardLabels = t.labelIds.map((id) => labels.get(id)).filter(Boolean) as { id: string; name: string; color: string }[];
  const mem = t.memberIds.map((id) => users.get(id)).filter(Boolean) as BoardUser[];
  const client = String(t.client || "").trim();
  const coverImg = t.cover && !t.cover.startsWith("#") ? t.cover : null;
  const coverCol = t.cover && t.cover.startsWith("#") ? t.cover : null;
  const files = t.attachments.length, comments = Number(t.commentCount) || 0;
  return (
    <article className={"kb-tc" + (dragging ? " is-drag" : "") + (t.completed ? " is-done" : "")} draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onDragOver={onDragOver}
      data-card={t.id} data-tone={tone} onClick={(e) => { if (!(e.target as HTMLElement).closest("button,a")) onOpen(); }}>
      {coverImg && <span className="kb-tc-cover" style={{ backgroundImage: `url(${coverImg})` }} aria-hidden />}
      {coverCol && <span className="kb-tc-bar" style={{ background: coverCol }} aria-hidden />}
      <button type="button" className={"kb-more" + (coverImg ? " on-cover" : coverCol ? " on-bar" : "")} aria-label={`Actions for ${t.title}`} aria-haspopup="menu" onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget); }}>
        <HugeiconsIcon icon={MoreHorizontalIcon} size={18} strokeWidth={1.8} />
      </button>
      {(client || cardLabels.length > 0 || t.priority === "high") && (
        <span className="kb-tags">
          {client && <span className="kb-ctag" title={`Client: ${client}`}><i style={{ background: clientColor(client) }} aria-hidden />{clientTag(client)}</span>}
          {cardLabels.map((l) => <span key={l.id} className="kb-label" style={{ "--lc": l.color } as React.CSSProperties}>{l.name}</span>)}
          {t.priority === "high" && <span className="kb-label kb-hi" title="High priority"><HugeiconsIcon icon={Flag02Icon} size={12} strokeWidth={2} />High</span>}
        </span>
      )}
      <h4 className={client || cardLabels.length > 0 || t.priority === "high" ? "" : "kb-h-solo"}><button type="button" className="kb-open" onClick={onOpen}>{t.completed && <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2.4} className="kb-donetick" aria-label="Completed" />}{t.title || "Untitled task"}</button></h4>
      {desc && <p className="kb-excerpt">{desc}</p>}
      {ck.length > 0 && (
        <span className="kb-cklst" aria-label={`Checklist ${ckDone} of ${ck.length} done`}>
          <span className="kb-cklst-h"><span>Checklist</span><b>{ckDone}/{ck.length} done</b></span>
          {ck.length <= 12
            ? <span className="kb-seg" aria-hidden>{ck.map((c) => <i key={c.id} className={c.done ? "on" : ""} />)}</span>
            : <span className="kb-bar" aria-hidden><i style={{ width: `${Math.round((ckDone / ck.length) * 100)}%` }} /></span>}
        </span>
      )}
      {(mem.length > 0 || due || renew || files > 0 || comments > 0) && (
        <span className="kb-tc-foot">
          <AvStack users={mem} max={4} size={24} />
          <span className="kb-sp" />
          <span className="kb-meta">
            {due && <span className={due.tone} title={`Due ${shortDay(day10(t.dueDate))}`}><HugeiconsIcon icon={due.tone === "late" ? Alert02Icon : Calendar03Icon} size={13} strokeWidth={2} />{due.text}</span>}
            {renew && <span className="ren" title={`Renewal date ${shortDay(renew)}`}><HugeiconsIcon icon={RepeatIcon} size={13} strokeWidth={2} />Renews {shortDay(renew)}</span>}
            {files > 0 && <span title={plural(files, "file")}><HugeiconsIcon icon={Attachment01Icon} size={13} strokeWidth={2} />{files}</span>}
            {comments > 0 && <span title={plural(comments, "comment")}><HugeiconsIcon icon={Comment01Icon} size={13} strokeWidth={2} />{comments}</span>}
          </span>
        </span>
      )}
    </article>
  );
}

function MoveMenu({ menu, lists, onClose, onOpen, onMove }: {
  menu: { card: CardRow; x: number; y: number; up: boolean }; lists: BoardList[]; onClose: () => void; onOpen: () => void; onMove: (to: string) => void;
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
  return (
    <div ref={ref} className="sh-pop kb-menu" role="menu" aria-label={`Actions for ${menu.card.title}`}
      style={{ left: menu.x, top: menu.up ? undefined : menu.y, bottom: menu.up ? window.innerHeight - menu.y : undefined }}>
      <div className="sh-menu">
        <button type="button" role="menuitem" onClick={onOpen}><HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={1.8} className="hgi" />Open card</button>
        <hr />
        <div className="kb-menu-h">Move to…</div>
        {lists.map((l, i) => (
          <button key={l.id} type="button" role="menuitemradio" aria-checked={l.id === menu.card.column} onClick={() => onMove(l.id)}>
            <i className={`kb-dot kb-t-${toneOf(l, i)}`} aria-hidden />{l.title}
            {l.id === menu.card.column && <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} className="hgi kb-tick" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ListsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className="kb-lists" aria-busy="true" aria-label="Loading cards">
      {Array.from({ length: n }).map((_, i) => (
        <section key={i} className="kb-list">
          <header className="kb-lh"><span className="skel skel-line" style={{ width: 90 }} /></header>
          <div className="kb-stack">{Array.from({ length: Math.max(1, 3 - (i % 3)) }).map((_, j) => <span key={j} className="skel kb-skelcard" />)}</div>
        </section>
      ))}
    </div>
  );
}

