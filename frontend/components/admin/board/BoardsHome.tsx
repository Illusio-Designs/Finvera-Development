"use client";
/* Boards home: one card per board — a strip in its lists' colours, card
   counts per list, overdue count and the members working on it. Counts come
   from the light GET /tasks?fields=summary (one request for every board). */
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Folder01Icon, Alert02Icon, Refresh01Icon, KanbanIcon } from "@hugeicons/core-free-icons";
import type { BoardRow, BoardUser, CardSummary } from "@/lib/adminApi";
import { istToday } from "@/lib/activityText";
import { toneOf, TONE_DOT, isDoneList, plural, day10 } from "./boardKit";
import { AvStack } from "./Avatars";

export default function BoardsHome({ boards, summary, summaryErr, users, onOpen, onNew }: {
  boards: BoardRow[]; summary: CardSummary[] | null; summaryErr: boolean; users: BoardUser[];
  onOpen: (id: number) => void; onNew: () => void;
}) {
  const today = istToday();
  const userById = new Map(users.map((u) => [u.id, u]));
  if (!boards.length) {
    return (
      <div className="sh-empty kb-empty-home">
        <HugeiconsIcon icon={KanbanIcon} size={20} strokeWidth={1.8} className="hgi" />
        <b>No boards yet</b>
        <span>A board holds the lists and cards for a stream of work — for example a client retainer or website launches.</span>
        <button type="button" className="sh-btn pri sm" onClick={onNew}><HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} />New board</button>
      </div>
    );
  }
  return (
    <div className="kb-home" role="list">
      {boards.map((b) => {
        const cards = summary ? summary.filter((t) => t.boardId === b.id) : null;
        const doneIds = new Set(b.columns.filter((c) => isDoneList(c)).map((c) => c.id));
        const late = cards ? cards.filter((t) => !doneIds.has(t.column) && !t.completed && /^\d{4}-/.test(day10(t.dueDate)) && day10(t.dueDate) < today).length : 0;
        const members = cards ? [...new Set(cards.flatMap((t) => t.memberIds))].map((id) => userById.get(id)).filter(Boolean) as BoardUser[] : [];
        return (
          <div role="listitem" key={b.id} className="kb-bcard-wrap">
            <button type="button" className="kb-bcard" onClick={() => onOpen(b.id)} aria-label={`Open ${b.name}`}>
              <span className="kb-strip" aria-hidden>{b.columns.map((c, i) => <i key={c.id} style={{ background: TONE_DOT[toneOf(c, i)] }} />)}</span>
              <span className="kb-bcard-top">
                <span className="kb-bic"><HugeiconsIcon icon={Folder01Icon} size={20} strokeWidth={1.7} /></span>
                <span className="sh-pill grey nodot">{plural(b.columns.length, "list")}</span>
              </span>
              <h3>{b.name}</h3>
              <p>{b.description || "Project board"}</p>
              {cards && cards.length > 0 && (
                <span className="kb-bcounts">
                  {b.columns.map((c, i) => {
                    const n = cards.filter((t) => t.column === c.id).length;
                    return <span key={c.id} title={`${c.title}: ${n}`}><i style={{ background: TONE_DOT[toneOf(c, i)] }} aria-hidden />{c.title}<b>{n}</b></span>;
                  })}
                </span>
              )}
              <span className="kb-bfoot">
                {cards ? (
                  <span>{plural(cards.length, "task")}{late > 0 && <> · <b className="kb-red">{late} overdue</b></>}</span>
                ) : summaryErr ? <span>Counts unavailable</span> : <span className="skel skel-line" style={{ width: 90 }} />}
                <span className="kb-sp" />
                <AvStack users={members} size={26} />
              </span>
            </button>
          </div>
        );
      })}
      <div role="listitem" className="kb-bcard-wrap">
        <button type="button" className="kb-bcard kb-bnew" onClick={onNew}><HugeiconsIcon icon={Add01Icon} size={20} strokeWidth={1.8} />New board</button>
      </div>
    </div>
  );
}

export function BoardsHomeSkeleton() {
  return (
    <div className="kb-home" aria-busy="true" aria-label="Loading boards">
      {[0, 1, 2].map((i) => <span key={i} className="skel kb-bskel" />)}
    </div>
  );
}

export function LoadError({ what, msg, onRetry }: { what: string; msg: string; onRetry: () => void }) {
  return (
    <div className="sh-empty err" role="alert">
      <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={1.8} className="hgi" />
      <b>Couldn&apos;t load {what}</b><span>{msg}</span>
      <button type="button" className="sh-btn sm" onClick={onRetry}><HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />Try again</button>
    </div>
  );
}
