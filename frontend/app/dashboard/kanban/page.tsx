"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";

type Col = { id: string; title: string };
type Label = { id: string; name: string; color: string };
type Board = { id: number; name: string; description?: string; color?: string; columns: Col[]; labels: Label[] };
type ChecklistItem = { id: string; text: string; done: boolean };
type Attachment = { id: string; url: string; name: string };
type Task = {
  id: number; title: string; description?: string; boardId: number; column: string; position: number;
  priority?: string; dueDate?: string | null; completed?: boolean; cover?: string | null;
  memberIds?: number[]; labelIds?: string[]; checklist?: ChecklistItem[]; attachments?: Attachment[];
};
type User = { id: number; name: string; avatar?: string | null; title?: string | null };
type Comment = { id: number; body: string; createdAt: string; author?: { id: number; name: string; avatar?: string | null } | null };

const uid = (p = "id") => p + "-" + Math.random().toString(36).slice(2, 8);
const COVER_SWATCHES = ["", "#3e60ab", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#ec4899"];

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

  const board = boards.find((b) => b.id === activeId) || null;
  const cols: Col[] = board?.columns?.length ? board.columns : [];
  const labels: Label[] = board?.labels || [];
  const userById = (id: number) => users.find((u) => u.id === id);
  const labelById = (id: string) => labels.find((l) => l.id === id);

  async function loadBoards() {
    setLoading(true);
    try {
      const [b, u] = await Promise.all([api.listBoards(), api.listUsers().catch(() => [])]);
      setBoards(b);
      setUsers(u);
      const first = activeId && b.some((x: Board) => x.id === activeId) ? activeId : b[0]?.id ?? null;
      setActiveId(first);
      if (first) setTasks(await api.listTasks(first));
    } finally { setLoading(false); }
  }
  useEffect(() => { loadBoards(); /* eslint-disable-next-line */ }, []);

  async function switchBoard(id: number) {
    setActiveId(id);
    setTasks(await api.listTasks(id));
  }
  async function reloadTasks() { if (activeId) setTasks(await api.listTasks(activeId)); }

  const inCol = (id: string) => tasks.filter((t) => t.column === id).sort((a, b) => a.position - b.position);

  async function persistColumnOrder(next: Task[], colId: string) {
    const ordered = next.filter((t) => t.column === colId).sort((a, b) => a.position - b.position);
    await Promise.all(ordered.map((t, i) => api.updateTask(t.id, { column: colId, position: i })));
  }

  function drop(toCol: string, beforeId: number | null) {
    const id = dragId.current;
    setOverCol(null);
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
    if (editing?.id && confirm("Delete this card?")) { await api.deleteTask(editing.id); setEditing(null); toast("Card deleted"); reloadTasks(); }
  }

  /* ── board / column management ── */
  async function saveBoard(patch: Partial<Board>) {
    if (!board) return;
    const next = { ...board, ...patch };
    setBoards((bs) => bs.map((b) => (b.id === board.id ? next : b)));
    await api.updateBoard(board.id, patch);
  }
  async function addBoard() {
    const name = prompt("Board name?");
    if (!name) return;
    const b = await api.createBoard({
      name,
      columns: [{ id: "todo", title: "To Do" }, { id: "inprogress", title: "In Progress" }, { id: "done", title: "Done" }],
      labels,
      position: boards.length,
    });
    setBoards((bs) => [...bs, b]); switchBoard(b.id); toast("Board created");
  }
  async function renameBoard() {
    if (!board) return;
    const name = prompt("Rename board", board.name);
    if (name) saveBoard({ name });
  }
  async function deleteBoard() {
    if (!board) return;
    if (!confirm(`Delete board "${board.name}" and all its cards?`)) return;
    await api.deleteBoard(board.id);
    const rest = boards.filter((b) => b.id !== board.id);
    setBoards(rest); toast("Board deleted");
    if (rest[0]) switchBoard(rest[0].id); else { setActiveId(null); setTasks([]); }
  }
  function addColumn() {
    const title = prompt("Column name?");
    if (title) saveBoard({ columns: [...cols, { id: uid("col"), title }] });
  }
  function renameColumn(c: Col) {
    const title = prompt("Rename column", c.title);
    if (title) saveBoard({ columns: cols.map((x) => (x.id === c.id ? { ...x, title } : x)) });
  }
  async function deleteColumn(c: Col) {
    if (!confirm(`Delete column "${c.title}"? Its cards move to the first column.`)) return;
    const rest = cols.filter((x) => x.id !== c.id);
    if (!rest.length) return alert("Keep at least one column.");
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

  if (loading) return <div className="adm-empty">Loading…</div>;

  return (
    <>
      <div className="adm-top">
        <div>
          <h1>Project boards</h1>
          <p>Trello-style boards — drag cards, assign members, add labels, checklists and comments.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {board && <button className="adm-btn ghost" onClick={addColumn}>+ Column</button>}
          <button className="adm-btn primary" onClick={addBoard}>+ Board</button>
        </div>
      </div>

      {/* Board switcher */}
      <div className="kb-boards">
        {boards.map((b) => (
          <button key={b.id} className={"kb-boardtab" + (b.id === activeId ? " active" : "")} onClick={() => switchBoard(b.id)}>
            <span className="dot" style={{ background: b.color || "#3e60ab" }} />{b.name}
          </button>
        ))}
        {board && (
          <span className="kb-board-actions">
            <button onClick={renameBoard} data-tip="Rename board" aria-label="Rename board">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
            </button>
            <button onClick={deleteBoard} data-tip="Delete board" aria-label="Delete board">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </button>
          </span>
        )}
      </div>

      {!board ? (
        <div className="adm-empty">No boards yet. Create your first board.</div>
      ) : (
        <div className="kb">
          {cols.map((c) => (
            <div key={c.id} data-col={c.id}
              className={"kb-col" + (overCol === c.id ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setOverCol(c.id); }}
              onDragLeave={() => setOverCol((o) => (o === c.id ? null : o))}
              onDrop={() => drop(c.id, null)}>
              <div className="kb-col-head">
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
                      onDragStart={(e) => { dragId.current = t.id; (e.currentTarget as HTMLElement).classList.add("dragging"); }}
                      onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove("dragging")}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => { e.stopPropagation(); drop(c.id, t.id); }}
                      onTouchStart={(e) => { dragId.current = t.id; didDrag.current = false; overColRef.current = c.id; (e.currentTarget as HTMLElement).classList.add("dragging"); }}
                      onTouchMove={(e) => {
                        if (dragId.current == null) return;
                        didDrag.current = true;
                        const p = e.touches[0];
                        const el = document.elementFromPoint(p.clientX, p.clientY) as HTMLElement | null;
                        const col = el?.closest(".kb-col")?.getAttribute("data-col") || null;
                        overColRef.current = col; setOverCol(col);
                        const card = el?.closest(".kb-card") as HTMLElement | null;
                        hoverIdRef.current = card && card !== e.currentTarget ? Number(card.getAttribute("data-id")) : null;
                      }}
                      onTouchEnd={(e) => {
                        (e.currentTarget as HTMLElement).classList.remove("dragging");
                        if (dragId.current != null && didDrag.current && overColRef.current) drop(overColRef.current, hoverIdRef.current);
                        else dragId.current = null;
                        overColRef.current = null; hoverIdRef.current = null; setOverCol(null);
                      }}
                      onClick={() => { if (didDrag.current) { didDrag.current = false; return; } openCard(t); }}>
                      {coverImg && <div className="kb-cover-img" style={{ backgroundImage: `url(${coverImg})` }} />}
                      {cover && <div className="kb-cover" style={{ background: cover }} />}
                      {!!cardLabels.length && (
                        <div className="kb-labels">
                          {cardLabels.map((l) => <span key={l.id} className="kb-lbl" style={{ background: l.color }} title={l.name} />)}
                        </div>
                      )}
                      <h4 className={t.completed ? "done" : ""}>{t.completed && <span className="kb-check">✓</span>}{t.title}</h4>
                      <div className="meta">
                        <span className={"kb-prio " + (t.priority || "medium")} />
                        <span className="kb-prio-t">{t.priority || "medium"}</span>
                        {overdue(t) && <span className="kb-due over">⏰ {t.dueDate}</span>}
                        {t.dueDate && !overdue(t) && <span className="kb-due">📅 {t.dueDate}</span>}
                        {ck && <span className="kb-ck">☑ {ck.done}/{ck.total}</span>}
                        <span style={{ flex: 1 }} />
                        <span className="kb-avstack">
                          {members.slice(0, 3).map((m) => <Avatar key={m.id} user={m} size={22} />)}
                          {members.length > 3 && <span className="kb-av kb-av-i" style={{ width: 22, height: 22, fontSize: 9 }}>+{members.length - 3}</span>}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button className="kb-addcard" onClick={() => openCard({ column: c.id, priority: "medium", memberIds: [], labelIds: [], checklist: [] })}>+ Add card</button>
            </div>
          ))}
          <div className="kb-addcol"><button onClick={addColumn}>+ Add column</button></div>
        </div>
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
                <select value={editing.priority || "medium"} onChange={(e) => setEditing({ ...editing, priority: e.target.value })}>
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select></div>
              <div className="adm-field" style={{ flex: 1 }}><label>Column</label>
                <select value={editing.column} onChange={(e) => setEditing({ ...editing, column: e.target.value })}>
                  {cols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select></div>
            </div>

            <div className="field row" style={{ gap: 12, alignItems: "flex-end" }}>
              <div className="adm-field" style={{ flex: 1 }}><label>Due date</label>
                <input type="date" value={String(editing.dueDate || "").slice(0, 10)} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} /></div>
              <label className="kb-complete">
                <input type="checkbox" checked={!!editing.completed} onChange={(e) => setEditing({ ...editing, completed: e.target.checked })} /> Complete
              </label>
            </div>

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

            {/* Checklist */}
            <div className="adm-field"><label>Checklist</label>
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
