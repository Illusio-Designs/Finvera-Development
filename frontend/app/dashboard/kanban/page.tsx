"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";

type Col = { id: string; title: string };
type Task = { id: number; title: string; description?: string; column: string; position: number; assignee?: string; priority?: string; label?: string; dueDate?: string | null };

const uid = () => "col-" + Math.random().toString(36).slice(2, 8);

export default function Kanban() {
  const [cols, setCols] = useState<Col[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<number | null>(null);
  const dragId = useRef<number | null>(null);
  const overColRef = useRef<string | null>(null);
  const hoverIdRef = useRef<number | null>(null);
  const didDrag = useRef(false);

  async function load() {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([api.getColumns(), api.listTasks()]);
      setCols(c.length ? c : [{ id: "todo", title: "To Do" }, { id: "done", title: "Done" }]);
      setTasks(t);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

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

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !editing.title) return;
    if (editing.id) await api.updateTask(editing.id, editing);
    else await api.createTask({ ...editing, position: inCol(editing.column!).length });
    setEditing(null);
    load();
  }
  async function deleteCard() {
    if (editing?.id && confirm("Delete this card?")) { await api.deleteTask(editing.id); setEditing(null); load(); }
  }

  async function addColumn() {
    const title = prompt("Column name?");
    if (!title) return;
    const next = [...cols, { id: uid(), title }];
    setCols(next); await api.saveColumns(next);
  }
  async function renameColumn(c: Col) {
    const title = prompt("Rename column", c.title);
    if (!title) return;
    const next = cols.map((x) => (x.id === c.id ? { ...x, title } : x));
    setCols(next); await api.saveColumns(next);
  }
  async function deleteColumn(c: Col) {
    if (!confirm(`Delete column "${c.title}"? Its cards move to the first column.`)) return;
    const rest = cols.filter((x) => x.id !== c.id);
    if (!rest.length) return alert("Keep at least one column.");
    await Promise.all(inCol(c.id).map((t) => api.updateTask(t.id, { column: rest[0].id })));
    setCols(rest); await api.saveColumns(rest); load();
  }

  return (
    <>
      <div className="adm-top">
        <div><h1>Project board</h1><p>Plan and track work like a Trello board — drag cards between columns.</p></div>
        <button className="adm-btn ghost" onClick={addColumn}>+ Add column</button>
      </div>

      {loading ? <div className="adm-empty">Loading…</div> : (
        <div className="kb">
          {cols.map((c) => (
            <div
              key={c.id}
              data-col={c.id}
              className={"kb-col" + (overCol === c.id ? " over" : "")}
              onDragOver={(e) => { e.preventDefault(); setOverCol(c.id); }}
              onDragLeave={() => setOverCol((o) => (o === c.id ? null : o))}
              onDrop={() => drop(c.id, null)}
            >
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
                {inCol(c.id).map((t) => (
                  <div
                    key={t.id}
                    data-id={t.id}
                    className={"kb-card" + (justDone === t.id ? " done-pop" : "")}
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
                    onClick={() => { if (didDrag.current) { didDrag.current = false; return; } setEditing({ ...t }); }}
                  >
                    {t.label && <span className="lbl">{t.label}</span>}
                    <h4>{t.title}</h4>
                    <div className="meta">
                      <span className={"kb-prio " + (t.priority || "medium")} />
                      <span className="kb-prio-t">{t.priority || "medium"}</span>
                      {t.assignee && <span className="kb-assignee">{t.assignee.slice(0, 2).toUpperCase()}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <button className="kb-addcard" onClick={() => setEditing({ column: c.id, priority: "medium" })}>+ Add card</button>
            </div>
          ))}
          <div className="kb-addcol"><button onClick={addColumn}>+ Add column</button></div>
        </div>
      )}

      {editing && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="adm-drawer" onSubmit={saveCard}>
            <h2>{editing.id ? "Edit card" : "New card"}</h2>
            <p className="sub">{cols.find((c) => c.id === editing.column)?.title}</p>
            <div className="adm-field"><label>Title</label>
              <input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required autoFocus /></div>
            <div className="adm-field"><label>Description</label>
              <textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="adm-field"><label>Assignee</label>
              <input value={editing.assignee || ""} onChange={(e) => setEditing({ ...editing, assignee: e.target.value })} placeholder="e.g. Maya" /></div>
            <div className="adm-field"><label>Priority</label>
              <select value={editing.priority || "medium"} onChange={(e) => setEditing({ ...editing, priority: e.target.value })}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select></div>
            <div className="adm-field"><label>Label</label>
              <input value={editing.label || ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Design / Dev / QA" /></div>
            <div className="adm-field"><label>Column</label>
              <select value={editing.column} onChange={(e) => setEditing({ ...editing, column: e.target.value })}>
                {cols.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select></div>
            <div className="adm-field"><label>Due date</label>
              <input type="date" value={String(editing.dueDate || "").slice(0, 10)} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} /></div>
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
