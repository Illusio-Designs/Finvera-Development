"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";
import DatePicker from "@/components/ui/DatePicker";
import { BoardSkeleton } from "@/components/admin/Skeleton";

type Col = { id: string; title: string };
type Label = { id: string; name: string; color: string };
type Board = { id: number; name: string; description?: string; color?: string; columns: Col[]; labels: Label[] };
type ChecklistItem = { id: string; text: string; done: boolean };
type Attachment = { id: string; url: string; name: string };
type Task = {
  id: number; title: string; description?: string; boardId: number; column: string; position: number;
  priority?: string; startDate?: string | null; dueDate?: string | null; completed?: boolean; cover?: string | null;
  memberIds?: number[]; labelIds?: string[]; checklist?: ChecklistItem[]; attachments?: Attachment[];
  label?: string;
};
type User = { id: number; name: string; avatar?: string | null; title?: string | null };
type Comment = { id: number; body: string; createdAt: string; author?: { id: number; name: string; avatar?: string | null } | null };

const uid = (p = "id") => p + "-" + Math.random().toString(36).slice(2, 8);

/* JSON columns can come back as strings on some MySQL setups — coerce to arrays
   so .map()/.length never crash. */
function toArr<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string" && v.trim().startsWith("[")) { try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch { return []; } }
  return [];
}
const normBoard = (b: Board): Board => ({ ...b, columns: toArr(b.columns), labels: toArr(b.labels) });
/* MySQL/Sequelize can hand booleans back as 1/0 or even the strings "1"/"0" on
   some setups — and "0" is TRUTHY in JS, which made every card look "completed".
   Coerce to a real boolean. */
const booly = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";
const normTask = (t: Task): Task => ({
  ...t,
  completed: booly(t.completed),
  memberIds: toArr<number>(t.memberIds),
  labelIds: toArr<string>(t.labelIds),
  checklist: toArr<ChecklistItem>(t.checklist).map((c) => ({ ...c, done: booly(c.done) })),
  attachments: toArr<Attachment>(t.attachments),
});
const COVER_SWATCHES = ["", "#3e60ab", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#ec4899"];
const PRIO_SHORT: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function fmtDue(d: string) {
  const [, m, day] = String(d).split("-").map(Number);
  if (!m || !day) return String(d);
  return `${MONTHS[m - 1]}, ${day}`;
}
function statusClass(s?: string) {
  const t = (s || "").toLowerCase();
  if (/progress|doing|active/.test(t)) return "st-progress";
  if (/review|check/.test(t)) return "st-review";
  if (/correct|fix|revis/.test(t)) return "st-correction";
  if (/done|complete|approved|shipped/.test(t)) return "st-done";
  return "";
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}
function Avatar({ user, size = 26 }: { user?: User | null; size?: number }) {
  const s = { width: size, height: size, fontSize: Math.round(size * 0.4) };
  if (user?.avatar) return <img className="kb-av" src={user.avatar} alt={user.name} style={s} title={user.name} />;
  return <span className="kb-av kb-av-i" style={s} title={user?.name}>{initials(user?.name)}</span>;
}

export default function Kanban() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [overCol, setOverCol] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<number | null>(null);
  const dragId = useRef<number | null>(null);
  const overColRef = useRef<string | null>(null);
  const hoverIdRef = useRef<number | null>(null);
  const didDrag = useRef(false);
  const kbRef = useRef<HTMLDivElement | null>(null);
  const ptr = useRef<{ x: number; y: number } | null>(null);
  const scrollRAF = useRef<number | null>(null);

  /* Auto-scroll the board (horizontally) and the hovered column (vertically)
     while dragging a card near an edge — like Trello. */
  function autoScrollTick() {
    const p = ptr.current;
    if (p && dragId.current != null) {
      const EDGE = 90, MAX = 22;
      const kb = kbRef.current;
      if (kb) {
        const r = kb.getBoundingClientRect();
        if (p.x < r.left + EDGE) kb.scrollLeft -= MAX * Math.min(1, (r.left + EDGE - p.x) / EDGE);
        else if (p.x > r.right - EDGE) kb.scrollLeft += MAX * Math.min(1, (p.x - (r.right - EDGE)) / EDGE);
      }
      const el = document.elementFromPoint(p.x, p.y) as HTMLElement | null;
      const list = el?.closest(".kb-cards") as HTMLElement | null;
      if (list) {
        const r = list.getBoundingClientRect();
        if (p.y < r.top + EDGE) list.scrollTop -= MAX * Math.min(1, (r.top + EDGE - p.y) / EDGE);
        else if (p.y > r.bottom - EDGE) list.scrollTop += MAX * Math.min(1, (p.y - (r.bottom - EDGE)) / EDGE);
      }
    }
    scrollRAF.current = requestAnimationFrame(autoScrollTick);
  }
  function startAutoScroll() { if (scrollRAF.current == null) scrollRAF.current = requestAnimationFrame(autoScrollTick); }
  function stopAutoScroll() { if (scrollRAF.current != null) { cancelAnimationFrame(scrollRAF.current); scrollRAF.current = null; } ptr.current = null; }
  useEffect(() => () => stopAutoScroll(), []);

  const board = boards.find((b) => b.id === activeId) || null;
  const cols: Col[] = toArr<Col>(board?.columns);
  const labels: Label[] = toArr<Label>(board?.labels);
  const userById = (id: number) => users.find((u) => u.id === id);
  const labelById = (id: string) => labels.find((l) => l.id === id);

  async function loadBoards() {
    setLoading(true);
    try {
      const [bRaw, u, tRaw] = await Promise.all([api.listBoards(), api.listUsers().catch(() => []), api.listTasks().catch(() => [])]);
      const b = (Array.isArray(bRaw) ? bRaw : []).map(normBoard);
      setBoards(b);
      setUsers(Array.isArray(u) ? u : []);
      setAllTasks((Array.isArray(tRaw) ? tRaw : []).map(normTask));
      // Start on the boards overview — user opens a board explicitly.
    } finally { setLoading(false); }
  }
  useEffect(() => { loadBoards(); /* eslint-disable-next-line */ }, []);

  async function openBoard(id: number) {
    setActiveId(id);
    setTasks(((await api.listTasks(id)) || []).map(normTask));
  }
  async function backToBoards() {
    setActiveId(null); setTasks([]);
    setAllTasks(((await api.listTasks().catch(() => [])) || []).map(normTask));
  }
  const switchBoard = openBoard;
  async function reloadTasks() { if (activeId) setTasks(((await api.listTasks(activeId)) || []).map(normTask)); }

  /* Per-board stats for the overview cards. */
  function boardStats(bid: number) {
    const ts = allTasks.filter((t) => t.boardId === bid);
    const memberIds = [...new Set(ts.flatMap((t) => toArr<number>(t.memberIds)))];
    return { count: ts.length, members: memberIds.map(userById).filter(Boolean) as User[] };
  }

  const inCol = (id: string) => tasks.filter((t) => t.column === id).sort((a, b) => a.position - b.position);

  async function persistColumnOrder(next: Task[], colId: string) {
    const ordered = next.filter((t) => t.column === colId).sort((a, b) => a.position - b.position);
    await Promise.all(ordered.map((t, i) => api.updateTask(t.id, { column: colId, position: i })));
  }

  function drop(toCol: string, beforeId: number | null) {
    const id = dragId.current;
    setOverCol(null);
    stopAutoScroll();
    if (id == null) return;
    const destTitle = (cols.find((c) => c.id === toCol)?.title || "").toLowerCase();
    const isDone = /done|complete|shipped|✅/.test(destTitle);
    setTasks((prev) => {
      const moved = prev.find((t) => t.id === id);
      if (!moved) return prev;
      const fromCol = moved.column;
      if (isDone && fromCol !== toCol) {
        toast("Task complete 🎉");
        setJustDone(id);
        setTimeout(() => setJustDone((v) => (v === id ? null : v)), 900);
      }
      const without = prev.filter((t) => t.id !== id);
      const target = without.filter((t) => t.column === toCol).sort((a, b) => a.position - b.position);
      let idx = beforeId == null ? target.length : target.findIndex((t) => t.id === beforeId);
      if (idx < 0) idx = target.length;
      target.splice(idx, 0, { ...moved, column: toCol });
      target.forEach((t, i) => (t.position = i));
      const next = [...without.filter((t) => t.column !== toCol), ...target];
      persistColumnOrder(next, toCol);
      if (fromCol !== toCol) persistColumnOrder(next, fromCol);
      return next;
    });
    dragId.current = null;
  }

  async function openCard(t: Partial<Task>) {
    setEditing({ ...t });
    setComments([]); setNewComment("");
    if (t.id) { try { setComments(await api.listComments(t.id)); } catch { /* ignore */ } }
  }

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.title || !activeId) return;
    const body = { ...editing, boardId: activeId };
    if (editing.id) await api.updateTask(editing.id, body);
    else await api.createTask({ ...body, position: inCol(editing.column!).length });
    setEditing(null);
    toast("Card saved");
    reloadTasks();
  }
  async function deleteCard() {
    if (editing?.id && await dialog.confirm({ title: "Delete this card?", message: "This can't be undone.", danger: true, confirmText: "Delete" })) {
      await api.deleteTask(editing.id); setEditing(null); toast("Card deleted"); reloadTasks();
    }
  }

  /* ── board / column management ── */
  async function saveBoard(patch: Partial<Board>) {
    if (!board) return;
    const next = { ...board, ...patch };
    setBoards((bs) => bs.map((b) => (b.id === board.id ? next : b)));
    await api.updateBoard(board.id, patch);
  }
  async function addBoard() {
    const name = await dialog.prompt({ title: "New board", placeholder: "Board name", confirmText: "Create" });
    if (!name) return;
    const b = normBoard(await api.createBoard({
      name,
      columns: [{ id: "todo", title: "To Do" }, { id: "inprogress", title: "In Progress" }, { id: "done", title: "Done" }],
      labels,
      position: boards.length,
    }));
    setBoards((bs) => [...bs, b]); switchBoard(b.id); toast("Board created");
  }
  async function renameBoard() {
    if (!board) return;
    const name = await dialog.prompt({ title: "Rename board", defaultValue: board.name, confirmText: "Rename" });
    if (name) saveBoard({ name });
  }
  async function deleteBoard() {
    if (!board) return;
    if (!(await dialog.confirm({ title: `Delete "${board.name}"?`, message: "The board and all its cards will be removed.", danger: true, confirmText: "Delete" }))) return;
    await api.deleteBoard(board.id);
    const rest = boards.filter((b) => b.id !== board.id);
    setBoards(rest); toast("Board deleted");
    backToBoards();
  }
  async function addColumn() {
    const title = await dialog.prompt({ title: "New column", placeholder: "Column name", confirmText: "Add" });
    if (title) saveBoard({ columns: [...cols, { id: uid("col"), title }] });
  }
  async function renameColumn(c: Col) {
    const title = await dialog.prompt({ title: "Rename column", defaultValue: c.title, confirmText: "Rename" });
    if (title) saveBoard({ columns: cols.map((x) => (x.id === c.id ? { ...x, title } : x)) });
  }
  async function deleteColumn(c: Col) {
    if (!(await dialog.confirm({ title: `Delete column "${c.title}"?`, message: "Its cards move to the first column.", danger: true, confirmText: "Delete" }))) return;
    const rest = cols.filter((x) => x.id !== c.id);
    if (!rest.length) return dialog.alert({ title: "Keep at least one column." });
    await Promise.all(inCol(c.id).map((t) => api.updateTask(t.id, { column: rest[0].id })));
    saveBoard({ columns: rest }); reloadTasks();
  }

  /* ── card modal field helpers ── */
  const toggleMember = (uidNum: number) =>
    setEditing((e) => { const cur = e?.memberIds || []; return { ...e, memberIds: cur.includes(uidNum) ? cur.filter((x) => x !== uidNum) : [...cur, uidNum] }; });
  const toggleLabel = (lid: string) =>
    setEditing((e) => { const cur = e?.labelIds || []; return { ...e, labelIds: cur.includes(lid) ? cur.filter((x) => x !== lid) : [...cur, lid] }; });
  const addChecklistItem = (text: string) =>
    text.trim() && setEditing((e) => ({ ...e, checklist: [...(e?.checklist || []), { id: uid("ck"), text: text.trim(), done: false }] }));
  const toggleChecklist = (id: string) =>
    setEditing((e) => ({ ...e, checklist: (e?.checklist || []).map((c) => (c.id === id ? { ...c, done: !c.done } : c)) }));
  const removeChecklist = (id: string) =>
    setEditing((e) => ({ ...e, checklist: (e?.checklist || []).filter((c) => c.id !== id) }));

  const addAttachment = (url: string, name: string) =>
    url && setEditing((e) => ({ ...e, attachments: [...(e?.attachments || []), { id: uid("at"), url, name: name || url.split("/").pop() || "file" }] }));
  const removeAttachment = (id: string) =>
    setEditing((e) => ({ ...e, attachments: (e?.attachments || []).filter((a) => a.id !== id) }));
  async function uploadAttachment(file?: File) {
    if (!file) return;
    try { const { url } = await api.upload(file); addAttachment(url, file.name); toast("Attachment added"); }
    catch { toast("Attachment upload failed", "err"); }
  }
  const editProgress = () => {
    const list = editing?.checklist || []; if (!list.length) return 0;
    return Math.round((list.filter((c) => c.done).length / list.length) * 100);
  };

  async function postComment() {
    if (!editing?.id || !newComment.trim()) return;
    const c = await api.addComment(editing.id, newComment.trim());
    setComments((cs) => [...cs, c]); setNewComment("");
  }
  async function removeComment(id: number) {
    await api.deleteComment(id); setComments((cs) => cs.filter((c) => c.id !== id));
  }

  const ckProgress = (t: Task) => {
    const list = t.checklist || []; if (!list.length) return null;
    return { done: list.filter((c) => c.done).length, total: list.length };
  };
  const overdue = (t: Task) => t.dueDate && !t.completed && new Date(t.dueDate) < new Date(new Date().toDateString());

  if (loading) return (
    <>
      <div className="adm-top"><div><h1>Project boards</h1><p>Loading your boards…</p></div></div>
      <BoardSkeleton cols={4} />
    </>
  );

  return (
    <>
      {!board ? (
        <>
          <div className="adm-top">
            <div>
              <h1>Project boards</h1>
              <p>Open a board to manage its cards, members, labels and checklists.</p>
            </div>
            <button className="adm-btn primary" onClick={addBoard}>+ Board</button>
          </div>

          <div className="kb-boardgrid">
            {boards.map((b) => {
              const st = boardStats(b.id);
              const accent = b.color || "#3e60ab";
              return (
                <button key={b.id} className="kb-folder" style={{ ["--fc" as string]: accent } as React.CSSProperties} onClick={() => openBoard(b.id)}>
                  <span className="kb-folder-tab" />
                  <div className="kb-folder-in">
                    <div className="kb-folder-row">
                      <span className="kb-folder-ic">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>
                      </span>
                      <span className="kb-folder-cols">{toArr(b.columns).length} lists</span>
                    </div>
                    <h3>{b.name}</h3>
                    <p>{b.description || "Project board"}</p>
                    <div className="kb-folder-foot">
                      <span className="kb-folder-count">{st.count} task{st.count === 1 ? "" : "s"}</span>
                      <span className="kb-avstack">
                        {st.members.slice(0, 4).map((m) => <Avatar key={m.id} user={m} size={26} />)}
                        {st.members.length > 4 && <span className="kb-av kb-av-i" style={{ width: 26, height: 26, fontSize: 10 }}>+{st.members.length - 4}</span>}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            <button className="kb-folder kb-folder-add" onClick={addBoard}>
              <span className="kb-folder-tab" />
              <div className="kb-folder-in"><span className="plus">+</span><span>New board</span></div>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="adm-top">
            <div className="kb-openhead">
              <button className="kb-back" onClick={backToBoards} aria-label="Back to boards">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M15 18l-6-6 6-6" /></svg>
                Boards
              </button>
              <div>
                <h1><span className="kb-bc-dot" style={{ background: board.color || "#3e60ab" }} />{board.name}</h1>
                <p>{board.description || "Drag cards, assign members, add labels, checklists and comments."}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="adm-btn ghost" onClick={addColumn}>+ Column</button>
              <button className="adm-btn ghost" onClick={renameBoard}>Rename</button>
              <button className="adm-btn ghost" onClick={deleteBoard}>Delete</button>
            </div>
          </div>

        <div className="kb" ref={kbRef}
          onDragOver={(e) => { ptr.current = { x: e.clientX, y: e.clientY }; }}
          onDrop={stopAutoScroll}>
          {cols.map((c) => (
            <div key={c.id} data-col={c.id}
              className={"kb-col" + (overCol === c.id ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setOverCol(c.id); }}
              onDragLeave={() => setOverCol((o) => (o === c.id ? null : o))}
              onDrop={() => drop(c.id, null)}>
              <div className="kb-col-head">
                <span className="kb-cbar" />
                <span className="t">{c.title}</span>
                <span className="count">{inCol(c.id).length}</span>
                <span className="m">
                  <button title="Rename" onClick={() => renameColumn(c)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                  </button>
                  <button title="Delete" onClick={() => deleteColumn(c)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                  </button>
                </span>
              </div>
              <div className="kb-col-sub">{inCol(c.id).length} task{inCol(c.id).length === 1 ? "" : "s"}</div>

              <div className="kb-cards">
                {inCol(c.id).map((t) => {
                  const ck = ckProgress(t);
                  const members = (t.memberIds || []).map(userById).filter(Boolean) as User[];
                  const cardLabels = (t.labelIds || []).map(labelById).filter(Boolean) as Label[];
                  const cover = t.cover && t.cover.startsWith("#") ? t.cover : null;
                  const coverImg = t.cover && !t.cover.startsWith("#") ? t.cover : null;
                  return (
                    <div key={t.id} data-id={t.id}
                      className={"kb-card" + (justDone === t.id ? " done-pop" : "") + (t.completed ? " is-done" : "")}
                      draggable
                      onDragStart={(e) => { dragId.current = t.id; startAutoScroll(); (e.currentTarget as HTMLElement).classList.add("dragging"); }}
                      onDragEnd={(e) => { stopAutoScroll(); (e.currentTarget as HTMLElement).classList.remove("dragging"); }}
                      onDragOver={(e) => { e.preventDefault(); ptr.current = { x: e.clientX, y: e.clientY }; }}
                      onDrop={(e) => { e.stopPropagation(); drop(c.id, t.id); }}
                      onTouchStart={(e) => { dragId.current = t.id; didDrag.current = false; overColRef.current = c.id; startAutoScroll(); (e.currentTarget as HTMLElement).classList.add("dragging"); }}
                      onTouchMove={(e) => {
                        if (dragId.current == null) return;
                        didDrag.current = true;
                        const p = e.touches[0];
                        ptr.current = { x: p.clientX, y: p.clientY };
                        const el = document.elementFromPoint(p.clientX, p.clientY) as HTMLElement | null;
                        const col = el?.closest(".kb-col")?.getAttribute("data-col") || null;
                        overColRef.current = col; setOverCol(col);
                        const card = el?.closest(".kb-card") as HTMLElement | null;
                        hoverIdRef.current = card && card !== e.currentTarget ? Number(card.getAttribute("data-id")) : null;
                      }}
                      onTouchEnd={(e) => {
                        (e.currentTarget as HTMLElement).classList.remove("dragging");
                        stopAutoScroll();
                        if (dragId.current != null && didDrag.current && overColRef.current) drop(overColRef.current, hoverIdRef.current);
                        else dragId.current = null;
                        overColRef.current = null; hoverIdRef.current = null; setOverCol(null);
                      }}
                      onClick={() => { if (didDrag.current) { didDrag.current = false; return; } openCard(t); }}>
                      {coverImg && <div className="kbc-cover" style={{ backgroundImage: `url(${coverImg})` }} />}
                      {cover && <div className="kbc-coverbar" style={{ background: cover }} />}
                      <div className="kbc-body">
                        <div className="kbc-top">
                          <span className={"kbc-prio " + (t.priority || "medium")}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><path d="M6 20v-7M12 20V4M18 20v-11" /></svg>
                            {PRIO_SHORT[t.priority || "medium"]}
                          </span>
                          {(cardLabels[0]?.name || t.label) && <span className={"kbc-label " + statusClass(cardLabels[0]?.name || t.label)}>{cardLabels[0]?.name || t.label}</span>}
                        </div>
                        <h4 className={t.completed ? "done" : ""}>{t.completed && <span className="kb-check">✓</span>}{t.title || "Untitled task"}</h4>
                        {t.description && <p className="kb-desc">{t.description}</p>}
                        <div className="kbc-foot">
                          <div className="kbc-meta">
                            {t.dueDate && (
                              <span className={"kbc-date" + (overdue(t) ? " over" : "")}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                                {fmtDue(t.dueDate)}
                              </span>
                            )}
                            {ck && (
                              <span className="kbc-mini">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
                                {ck.done}/{ck.total}
                              </span>
                            )}
                            {(t.attachments || []).length > 0 && (
                              <span className="kbc-mini">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
                                {(t.attachments || []).length}
                              </span>
                            )}
                          </div>
                          {members.length > 0 && (
                            <span className="kb-avstack">
                              {members.slice(0, 4).map((m) => <Avatar key={m.id} user={m} size={26} />)}
                              {members.length > 4 && <span className="kb-av kb-av-i" style={{ width: 26, height: 26, fontSize: 10 }}>+{members.length - 4}</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="kb-addcard" onClick={() => openCard({ column: c.id, priority: "medium", completed: false, memberIds: [], labelIds: [], checklist: [], attachments: [] })}>+ Add card</button>
            </div>
          ))}
          <div className="kb-addcol"><button onClick={addColumn}>+ Add column</button></div>
        </div>
        </>
      )}

      {editing && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="adm-drawer kb-drawer" onSubmit={saveCard}>
            <h2>{editing.id ? "Edit card" : "New card"}</h2>
            <p className="sub">{cols.find((c) => c.id === editing.column)?.title}</p>

            <div className="adm-field"><label>Title</label>
              <input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required autoFocus /></div>
            <div className="adm-field"><label>Description</label>
              <textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>

            {/* Members */}
            <div className="adm-field"><label>Members</label>
              <div className="kb-picker">
                {users.map((u) => {
                  const on = (editing.memberIds || []).includes(u.id);
                  return (
                    <button type="button" key={u.id} className={"kb-member" + (on ? " on" : "")} onClick={() => toggleMember(u.id)}>
                      <Avatar user={u} size={22} /> {u.name}
                    </button>
                  );
                })}
                {!users.length && <span className="kb-hint">Add team members in the Users page.</span>}
              </div>
            </div>

            {/* Labels */}
            <div className="adm-field"><label>Labels</label>
              <div className="kb-picker">
                {labels.map((l) => {
                  const on = (editing.labelIds || []).includes(l.id);
                  return (
                    <button type="button" key={l.id} className={"kb-labelchip" + (on ? " on" : "")} style={{ background: l.color }} onClick={() => toggleLabel(l.id)}>
                      {l.name} {on && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Priority</label>
                <Select value={editing.priority || "medium"} onChange={(v) => setEditing({ ...editing, priority: v })}
                  ariaLabel="Priority"
                  options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Column</label>
                <Select value={String(editing.column ?? "")} onChange={(v) => setEditing({ ...editing, column: v })}
                  ariaLabel="Column"
                  options={cols.map((c) => ({ value: String(c.id), label: c.title }))} /></div>
            </div>

            <div className="field row" style={{ gap: 12 }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Start date</label>
                <DatePicker value={String(editing.startDate || "").slice(0, 10)} onChange={(v) => setEditing({ ...editing, startDate: v })} placeholder="Start date" /></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Due date</label>
                <DatePicker value={String(editing.dueDate || "").slice(0, 10)} onChange={(v) => setEditing({ ...editing, dueDate: v })} placeholder="Due date" /></div>
            </div>
            <label className="kb-complete">
              <input type="checkbox" checked={!!editing.completed} onChange={(e) => setEditing({ ...editing, completed: e.target.checked })} /> Mark complete
            </label>

            {/* Cover */}
            <div className="adm-field"><label>Cover color</label>
              <div className="kb-covers">
                {COVER_SWATCHES.map((s) => (
                  <button type="button" key={s || "none"} className={"kb-cover-sw" + (editing.cover === s || (!editing.cover && !s) ? " on" : "")}
                    style={{ background: s || "transparent" }} onClick={() => setEditing({ ...editing, cover: s })} title={s || "None"}>
                    {!s && "∅"}
                  </button>
                ))}
              </div>
            </div>

            {/* Attachments */}
            <div className="adm-field"><label>Attachments</label>
              <div className="kb-attachments">
                {(editing.attachments || []).map((a) => (
                  <div key={a.id} className="kb-attach">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="kb-attach-link">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
                      <span>{a.name}</span>
                    </a>
                    <button type="button" onClick={() => removeAttachment(a.id)} aria-label="Remove">×</button>
                  </div>
                ))}
                <label className="kb-attach-add">
                  <input type="file" hidden onChange={(e) => { uploadAttachment(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                  + Add attachment
                </label>
              </div>
            </div>

            {/* Checklist */}
            <div className="adm-field">
              <label>Checklist{(editing.checklist || []).length > 0 && <span className="kb-ck-pct">{editProgress()}%</span>}</label>
              {(editing.checklist || []).length > 0 && (
                <div className="kb-ck-progress"><span style={{ width: `${editProgress()}%` }} /></div>
              )}
              <div className="kb-checklist">
                {(editing.checklist || []).map((c) => (
                  <div key={c.id} className="kb-ck-item">
                    <input type="checkbox" checked={c.done} onChange={() => toggleChecklist(c.id)} />
                    <span className={c.done ? "done" : ""}>{c.text}</span>
                    <button type="button" onClick={() => removeChecklist(c.id)} aria-label="Remove">×</button>
                  </div>
                ))}
                <ChecklistAdd onAdd={addChecklistItem} />
              </div>
            </div>

            {/* Comments (only for saved cards) */}
            {editing.id && (
              <div className="adm-field"><label>Comments</label>
                <div className="kb-comments">
                  {comments.map((c) => (
                    <div key={c.id} className="kb-comment">
                      <Avatar user={c.author as User} size={26} />
                      <div className="body">
                        <b>{c.author?.name || "Someone"}</b>
                        <p>{c.body}</p>
                      </div>
                      <button type="button" onClick={() => removeComment(c.id)} aria-label="Delete comment">×</button>
                    </div>
                  ))}
                  <div className="kb-comment-add">
                    <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment…"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); postComment(); } }} />
                    <button type="button" className="adm-btn ghost" onClick={postComment}>Post</button>
                  </div>
                </div>
              </div>
            )}

            <div className="adm-drawer-actions">
              <button className="adm-btn primary" type="submit">Save</button>
              <button className="adm-btn ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
              {editing.id && <button className="adm-btn ghost" type="button" onClick={deleteCard} style={{ marginLeft: "auto" }}>Delete</button>}
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function ChecklistAdd({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="kb-ck-add">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add an item…"
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(v); setV(""); } }} />
      <button type="button" className="adm-btn ghost" onClick={() => { onAdd(v); setV(""); }}>Add</button>
    </div>
  );
}
