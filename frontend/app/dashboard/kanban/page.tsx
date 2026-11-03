"use client";
/* Project board.
   Boards home (?board absent): one card per board with counts per list,
   overdue and members — boards + GET /tasks?fields=summary.
   A board (?board=ID): its cards in ONE request (GET /tasks?boardId=, with
   comment counts), lists you drag cards between, a card drawer and board
   settings. Moves are optimistic with Undo: the moved card's PATCH carries
   the notifications, then one POST /tasks/reorder saves the list's order.
   ?task=ID (notifications) opens that card on its board. */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { api, boardApi, type BoardRow, type BoardUser, type CardRow, type CardSummary } from "@/lib/adminApi";
import { exportToExcel } from "@/components/admin/ExportButton";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import BoardsHome, { BoardsHomeSkeleton, LoadError } from "@/components/admin/board/BoardsHome";
import BoardView, { ListsSkeleton } from "@/components/admin/board/BoardView";
import CardDrawer from "@/components/admin/board/CardDrawer";
import BoardSettings, { type SettingsSave } from "@/components/admin/board/BoardSettings";
import { normBoard, normCard, normSummary, byPos, isDoneList, DEFAULT_LABELS, DEFAULT_LISTS } from "@/components/admin/board/boardKit";
import "./board.css";

const errMsg = (e: unknown, d = "Try again in a moment.") => (e instanceof Error && e.message ? e.message : d);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function ProjectBoard() {
  const router = useRouter();
  const params = useSearchParams();
  const boardParam = Number(params.get("board")) || null;
  const taskParam = Number(params.get("task")) || null;

  const [boards, setBoards] = useState<BoardRow[] | null>(null);
  const [boardsErr, setBoardsErr] = useState("");
  const [summary, setSummary] = useState<CardSummary[] | null>(null);
  const [summaryErr, setSummaryErr] = useState(false);
  const [users, setUsers] = useState<BoardUser[]>([]);
  const [cards, setCards] = useState<CardRow[] | null>(null);
  const [cardsErr, setCardsErr] = useState("");
  const [drawer, setDrawer] = useState<{ card: CardRow | null; defaults?: Partial<CardRow>; key: number } | null>(null);
  const [settings, setSettings] = useState<{ focus: "labels" | null; back?: number | null } | null>(null);
  const [exporting, setExporting] = useState(false);
  const cardsRef = useRef<CardRow[]>([]);
  cardsRef.current = cards || [];
  const pendingCard = useRef<number | null>(null);

  const board = boards?.find((b) => b.id === boardParam) || null;
  const boardRef = useRef<BoardRow | null>(null);
  boardRef.current = board;

  /* ── loading ── */
  const loadBoards = useCallback(async () => {
    setBoardsErr("");
    try { const b = await boardApi.boards(); setBoards((Array.isArray(b) ? b : []).map(normBoard)); }
    catch (e) { setBoardsErr(errMsg(e, "Couldn't load the boards.")); }
  }, []);
  const loadSummary = useCallback(async () => {
    setSummaryErr(false);
    try { const s = await boardApi.summary(); setSummary((Array.isArray(s) ? s : []).map(normSummary)); }
    catch { setSummaryErr(true); }
  }, []);
  useEffect(() => {
    loadBoards(); loadSummary();
    api.listUsers().then((u: unknown) => setUsers(Array.isArray(u) ? (u as BoardUser[]) : [])).catch(() => {});
  }, [loadBoards, loadSummary]);

  const loadCards = useCallback(async (id: number) => {
    setCardsErr("");
    try {
      const r = await boardApi.cards(id);
      if (boardRef.current?.id !== id && boardRef.current) return;
      setCards((Array.isArray(r) ? r : []).map(normCard));
    } catch (e) { setCardsErr(errMsg(e, "Couldn't load the cards.")); }
  }, []);
  useEffect(() => {
    setCards(null); setDrawer(null); setSettings(null);
    if (boardParam) loadCards(boardParam);
  }, [boardParam, loadCards]);

  /* Deep link ?task=ID → find its board (summary), open the board, then the card. */
  useEffect(() => {
    if (!taskParam || !boards) return;
    if (!summary) { if (summaryErr) { toast("Couldn't open that card", "err", { description: "The board list didn't load — try again." }); router.replace("/dashboard/kanban", { scroll: false }); } return; }
    const t = summary.find((s) => s.id === taskParam);
    if (!t || !boards.some((b) => b.id === t.boardId)) {
      toast("That card isn't on the board any more", "warn", { description: "It may have been deleted." });
      router.replace(boardParam ? `/dashboard/kanban?board=${boardParam}` : "/dashboard/kanban", { scroll: false });
      return;
    }
    pendingCard.current = t.id;
    router.replace(`/dashboard/kanban?board=${t.boardId}`, { scroll: false });
  }, [taskParam, boards, summary, summaryErr, boardParam, router]);
  useEffect(() => {
    if (!cards || pendingCard.current == null) return;
    const c = cards.find((x) => x.id === pendingCard.current);
    pendingCard.current = null;
    if (c) setDrawer({ card: c, key: Date.now() });
  }, [cards]);

  /* Unknown ?board= (deleted, or no access) → back to the boards home. */
  useEffect(() => {
    if (boards && boardParam && !taskParam && !boards.some((b) => b.id === boardParam)) {
      toast("That board isn't here any more", "warn");
      router.replace("/dashboard/kanban", { scroll: false });
    }
  }, [boards, boardParam, taskParam, router]);

  const openBoard = (id: number) => { router.push(`/dashboard/kanban?board=${id}`, { scroll: false }); window.scrollTo(0, 0); };
  const backHome = () => { router.push("/dashboard/kanban", { scroll: false }); loadSummary(); };

  /* ── boards ── */
  async function newBoard() {
    const name = (await dialog.prompt({ title: "New board", message: "Boards start with To Do, In Progress and Done. You can rename lists and add labels in Board settings.", placeholder: "e.g. Gripzus retainer", confirmText: "Create board" }))?.trim();
    if (!name) return;
    try {
      const labels = boards?.[0]?.labels?.length ? boards[0].labels : DEFAULT_LABELS;
      const b = normBoard(await boardApi.createBoard({ name, description: null, columns: DEFAULT_LISTS, labels, position: boards?.length || 0 }));
      setBoards((bs) => [...(bs || []), b]);
      toast("Board created", "ok", { description: b.name });
      openBoard(b.id);
    } catch (e) { toast("Couldn't create the board", "err", { description: errMsg(e) }); }
  }
  async function patchBoard(patch: Partial<BoardRow>): Promise<boolean> {
    const b = boardRef.current;
    if (!b) return false;
    const before = b;
    setBoards((bs) => bs && bs.map((x) => (x.id === b.id ? { ...x, ...patch } : x)));
    try { const saved = normBoard(await boardApi.updateBoard(b.id, patch)); setBoards((bs) => bs && bs.map((x) => (x.id === b.id ? { ...x, ...saved } : x))); return true; }
    catch (e) {
      setBoards((bs) => bs && bs.map((x) => (x.id === b.id ? before : x)));
      toast("Couldn't save the board", "err", { description: errMsg(e) });
      return false;
    }
  }
  const rename = async (name: string) => { const ok = await patchBoard({ name }); if (ok) toast("Board renamed", "ok", { description: name }); return ok; };

  async function saveSettings(s: SettingsSave): Promise<boolean> {
    const b = boardRef.current;
    if (!b) return false;
    // Cards in deleted lists move first (one request), so none are left in a list that's gone.
    const moving = s.moveTo ? cardsRef.current.filter((t) => s.removed.includes(t.column)) : [];
    if (moving.length && s.moveTo) {
      const dest = cardsRef.current.filter((t) => t.column === s.moveTo).sort(byPos);
      const ids = [...dest, ...moving.sort(byPos)].map((t) => t.id);
      try { await boardApi.reorder(s.moveTo, ids); }
      catch (e) { toast("Couldn't move the cards out of the deleted list", "err", { description: errMsg(e) }); return false; }
      const pos = new Map(ids.map((id, i) => [id, i]));
      setCards((cs) => cs && cs.map((t) => (pos.has(t.id) ? { ...t, column: s.moveTo as string, position: pos.get(t.id)! } : t)));
    }
    if (!Object.keys(s.patch).length) return true;
    const ok = await patchBoard(s.patch);
    if (ok) toast("Board settings saved", "ok", { description: [s.patch.columns && "lists", s.patch.labels && "labels", (s.patch.name || s.patch.description !== undefined) && "details"].filter(Boolean).join(", ") || undefined });
    return ok;
  }
  async function deleteBoard() {
    const b = boardRef.current;
    if (!b) return;
    const n = cardsRef.current.length;
    if (!(await dialog.confirm({ title: `Delete “${b.name}”?`, message: `The board and its ${n} card${n === 1 ? "" : "s"} are removed for everyone. This can't be undone.`, confirmText: "Delete board", danger: true }))) return;
    try {
      await boardApi.deleteBoard(b.id);
      setSettings(null);
      setBoards((bs) => bs && bs.filter((x) => x.id !== b.id));
      toast("Board deleted", "ok", { description: b.name });
      backHome();
    } catch (e) { toast("Couldn't delete the board", "err", { description: errMsg(e) }); }
  }

  /* ── moving cards (optimistic, with Undo) ── */
  const reorderOk = useRef(true); // false once /tasks/reorder 404s (older backend)
  async function saveOrder(col: string, ids: number[]) {
    if (!ids.length) return;
    if (reorderOk.current) {
      try { await boardApi.reorder(col, ids); return; }
      catch (e) { if ((e as { status?: number })?.status !== 404) throw e; reorderOk.current = false; }
    }
    await Promise.all(ids.map((id, i) => boardApi.updateCard(id, { column: col, position: i })));
  }
  async function move(id: number, to: string, beforeId: number | null) {
    const b = boardRef.current;
    const cur = cardsRef.current;
    const card = cur.find((t) => t.id === id);
    if (!b || !card) return;
    const from = card.column;
    const fromIds = cur.filter((t) => t.column === from).sort(byPos).map((t) => t.id);
    const dest = cur.filter((t) => t.column === to && t.id !== id).sort(byPos).map((t) => t.id);
    const at = beforeId == null ? dest.length : Math.max(0, dest.indexOf(beforeId));
    const ids = [...dest.slice(0, at), id, ...dest.slice(at)];
    const sameCol = from === to;
    if (sameCol && ids.join() === fromIds.join()) return;
    const restIds = fromIds.filter((x) => x !== id);

    const touched = new Set([...fromIds, ...ids]);
    const before = new Map(cur.filter((t) => touched.has(t.id)).map((t) => [t.id, { column: t.column, position: t.position }]));
    const restore = () => setCards((cs) => cs && cs.map((t) => (before.has(t.id) ? { ...t, ...before.get(t.id)! } : t)));
    const pos = new Map(ids.map((x, i) => [x, i]));
    if (!sameCol) restIds.forEach((x, i) => pos.set(x, i));
    setCards((cs) => cs && cs.map((t) => (t.id === id ? { ...t, column: to, position: pos.get(id)! } : pos.has(t.id) ? { ...t, position: pos.get(t.id)! } : t)));

    const toList = b.columns.find((c) => c.id === to), fromList = b.columns.find((c) => c.id === from);
    try {
      if (!sameCol) await boardApi.updateCard(id, { column: to, position: pos.get(id)! }); // tells the card's members it moved
      await saveOrder(to, ids);
      if (!sameCol && restIds.length) saveOrder(from, restIds).catch(() => { /* gaps in the old list's order are harmless */ });
    } catch (e) {
      restore();
      toast(`Couldn't move “${card.title}”`, "err", { description: errMsg(e) });
      return;
    }
    const undo = async () => {
      restore();
      try {
        if (!sameCol) await boardApi.updateCard(id, { column: from, position: fromIds.indexOf(id) });
        await saveOrder(from, fromIds);
        if (!sameCol) await saveOrder(to, dest);
        toast(`“${card.title}” is back in ${fromList?.title || "its list"}`, "info");
      } catch (e) {
        toast("Couldn't undo", "err", { description: errMsg(e, "Reload the page and check the card.") });
        loadCards(b.id);
      }
    };
    toast(sameCol ? "Order saved" : `Moved to ${toList?.title || "list"}${isDoneList(toList) ? " — nice work" : ""}`, "ok", {
      description: card.title, action: { label: "Undo", onClick: undo }, duration: 7000,
    });
  }

  /* ── cards ── */
  const endPos = (col: string) => cardsRef.current.filter((t) => t.column === col).reduce((m, t) => Math.max(m, t.position + 1), 0);
  async function quickAdd(col: string, title: string): Promise<boolean> {
    const b = boardRef.current;
    if (!b) return false;
    try {
      const row = normCard(await boardApi.createCard({ title, boardId: b.id, column: col, position: endPos(col), priority: "medium", completed: false, memberIds: [], labelIds: [], checklist: [], attachments: [] }));
      setCards((cs) => [...(cs || []), { ...row, commentCount: 0 }]);
      toast("Task added", "ok", { description: title, action: { label: "Open", onClick: () => setDrawer({ card: { ...row, commentCount: 0 }, key: Date.now() }) } });
      return true;
    } catch (e) { toast("Couldn't add the task", "err", { description: errMsg(e) }); return false; }
  }
  function saved(row: CardRow, isNew: boolean) {
    setCards((cs) => (isNew ? [...(cs || []), row] : (cs || []).map((t) => (t.id === row.id ? { ...t, ...row } : t))));
    setDrawer(null);
    toast(isNew ? "Task added" : "Card saved", "ok", { description: row.title, ...(isNew ? { action: { label: "Open", onClick: () => setDrawer({ card: row, key: Date.now() }) } } : {}) });
  }
  function deleted(id: number) {
    const t = cardsRef.current.find((x) => x.id === id);
    setCards((cs) => cs && cs.filter((x) => x.id !== id));
    setDrawer(null);
    toast("Card deleted", "ok", { description: t?.title });
  }
  const setCommentCount = (id: number, n: number) => setCards((cs) => cs && cs.map((t) => (t.id === id ? { ...t, commentCount: n } : t)));

  async function doExport() {
    const b = boardRef.current;
    if (!b) return;
    setExporting(true);
    try {
      const r = await exportToExcel("tasks", { boardId: b.id }, { file: `board-${slug(b.name) || b.id}`, sheet: b.name.slice(0, 31) });
      if (!r.total) toast("Nothing to export", "info", { description: "This board has no cards yet — the file has only the headings." });
      else toast(`Exported ${r.total} card${r.total === 1 ? "" : "s"}`, "ok", { description: r.file });
    } catch (e) { toast("Couldn't export", "err", { description: errMsg(e) }); }
    finally { setExporting(false); }
  }

  const clients = useMemo(() => [...new Set((cards || []).map((t) => String(t.client || "").trim()).filter(Boolean))], [cards]);

  /* ── render ── */
  if (boardsErr && !boards) {
    return (
      <div className="td kb-page">
        <Hello title="Project boards" sub="Open a board to manage its cards, members, labels and checklists." />
        <LoadError what="the boards" msg={boardsErr} onRetry={loadBoards} />
      </div>
    );
  }
  if (!boards || (taskParam && !summaryErr)) {
    return (
      <div className="td kb-page">
        <Hello title={boardParam || taskParam ? "Project board" : "Project boards"} sub="Loading…" />
        {boardParam || taskParam ? <ListsSkeleton n={5} /> : <BoardsHomeSkeleton />}
      </div>
    );
  }

  if (!board) {
    return (
      <div className="td kb-page">
        <Hello title="Project boards" sub="Open a board to manage its cards, members, labels and checklists."
          action={<button type="button" className="sh-btn pri" onClick={newBoard}><HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />Board</button>} />
        <BoardsHome boards={boards} summary={summary} summaryErr={summaryErr} users={users} onOpen={openBoard} onNew={newBoard} />
      </div>
    );
  }

  return (
    <>
      {cardsErr && !cards ? (
        <div className="td kb-page">
          <Hello title={board.name} sub={board.description || "Project board"} eyebrow="Project board" />
          <LoadError what="this board's cards" msg={cardsErr} onRetry={() => loadCards(board.id)} />
          <button type="button" className="sh-link kb-backlink" onClick={backHome}>Back to all boards</button>
        </div>
      ) : (
        <BoardView board={board} cards={cards} users={users} exporting={exporting}
          onBack={backHome} onRename={rename} onSettings={() => setSettings({ focus: null })} onExport={doExport}
          onOpen={(c) => setDrawer({ card: c, key: Date.now() })}
          onNew={(col) => setDrawer({ card: null, defaults: { column: col }, key: Date.now() })}
          onQuickAdd={quickAdd} onMove={move} />
      )}
      {drawer && (
        <CardDrawer key={drawer.key} board={board} card={drawer.card} defaults={drawer.defaults} users={users} clients={clients} endPos={endPos}
          onClose={() => setDrawer(null)} onSaved={saved} onDeleted={deleted} onComments={setCommentCount}
          onManage={() => { const id = drawer.card?.id ?? null; setDrawer(null); setSettings({ focus: "labels", back: id }); }} />
      )}
      {settings && <BoardSettings board={board} cards={cards || []} focus={settings.focus}
        onClose={() => {
          // Came from a card's "Edit labels" → back to that card.
          const back = settings.back != null ? cardsRef.current.find((t) => t.id === settings.back) : null;
          setSettings(null);
          if (back) setDrawer({ card: back, key: Date.now() });
        }} onSave={saveSettings} onDeleteBoard={deleteBoard} />}
    </>
  );
}

function Hello({ title, sub, eyebrow = "Projects", action }: { title: string; sub: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div className="td-hello">
      <div className="td-hello-tx"><div className="td-eyebrow">{eyebrow}</div><h1>{title}</h1><p>{sub}</p></div>
      {action && <div className="td-acts">{action}</div>}
    </div>
  );
}

export default function KanbanPage() {
  return <Suspense fallback={null}><ProjectBoard /></Suspense>;
}
