"use client";
/* The card drawer (also "New task"): title, list, client, priority, dates,
   labels, members, description (rich text), checklist, files, cover, then
   comments and History for saved cards. Save sends only the fields that
   changed. Comments post straight away (they notify the card's members). */
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon, Delete02Icon, Tick02Icon, Add01Icon, ArrowUp01Icon, ArrowDown01Icon, DragDropVerticalIcon, Image01Icon,
  Link04Icon, File01Icon, Alert02Icon, Sent02Icon, Refresh01Icon,
} from "@hugeicons/core-free-icons";
import { boardApi, type BoardRow, type BoardUser, type CardRow, type CardComment, type CheckItem, type CardFile } from "@/lib/adminApi";
import Select from "@/components/Select";
import DatePicker from "@/components/ui/DatePicker";
import HistoryList from "@/components/admin/HistoryList";
import { relative, whenOf } from "@/lib/activityText";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { uid, day10, isImage, toneOf, COVER_SWATCHES, clientColor, normCard } from "./boardKit";
import { Av } from "./Avatars";

const RichText = dynamic(() => import("@/components/admin/RichText"), {
  ssr: false,
  loading: () => <div className="rte kb-rte-load" aria-busy="true" aria-label="Loading editor" />,
});

type Draft = Partial<CardRow>;
const FIELDS = ["title", "column", "client", "priority", "completed", "startDate", "dueDate", "renewalDate",
  "labelIds", "memberIds", "description", "checklist", "attachments", "cover"] as const;
type Field = typeof FIELDS[number];
const DATES: Field[] = ["startDate", "dueDate", "renewalDate"];
const normOf = (k: Field, v: unknown) => {
  if (DATES.includes(k)) return day10(v) || null;
  if (k === "completed") return !!v;
  if (k === "labelIds" || k === "memberIds" || k === "checklist" || k === "attachments") return Array.isArray(v) ? v : [];
  if (v === "" || v === undefined) return null;
  return v;
};
const same = (k: Field, a: unknown, b: unknown) => JSON.stringify(normOf(k, a)) === JSON.stringify(normOf(k, b));

export default function CardDrawer({ board, card, defaults, users, clients, endPos, onClose, onSaved, onDeleted, onComments, onManage }: {
  board: BoardRow; card: CardRow | null; defaults?: Draft; users: BoardUser[]; clients: string[];
  endPos: (col: string) => number;
  onClose: () => void;
  onSaved: (row: CardRow, isNew: boolean) => void;
  onDeleted: (id: number) => void;
  onComments: (id: number, n: number) => void;
  onManage: () => void;
}) {
  const isNew = !card;
  const [base, setBase] = useState<Draft>(() => card ? { ...card } : {
    title: "", column: board.columns[0]?.id, priority: "medium", completed: false, memberIds: [], labelIds: [], checklist: [], attachments: [], ...defaults,
  });
  const [draft, setDraft] = useState<Draft>(base);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [histKey, setHistKey] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { (isNew ? titleRef.current : closeRef.current)?.focus({ preventScroll: true }); }, [isNew]);

  const dirtyKeys = useMemo(() => FIELDS.filter((k) => !same(k, draft[k], base[k])), [draft, base]);
  const dirty = isNew ? !!String(draft.title || "").trim() || dirtyKeys.some((k) => !["column", "priority", "client"].includes(k)) : dirtyKeys.length > 0;
  const set = <K extends Field>(k: K, v: Draft[K]) => { setDraft((d) => ({ ...d, [k]: v })); if (k === "title") setErr(""); };
  const toggleIn = (k: "labelIds" | "memberIds", v: string | number) => setDraft((d) => {
    const cur = (d[k] || []) as (string | number)[];
    return { ...d, [k]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
  });

  async function tryClose() {
    if (dirty && !saving) {
      const ok = await dialog.confirm({ title: isNew ? "Discard this task?" : "Discard your changes?", message: isNew ? "It hasn't been added yet." : "The changes you made here haven't been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true });
      if (!ok) return;
    }
    onClose();
  }
  const tryCloseRef = useRef(tryClose);
  tryCloseRef.current = tryClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".adm-overlay, .kb-menu, .cselect-drop")) return;
      tryCloseRef.current();
    };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, []);

  async function save() {
    const title = String(draft.title || "").trim();
    if (!title) { setErr("Give the task a title."); titleRef.current?.focus(); return; }
    setSaving(true); setErr("");
    try {
      const keys = isNew ? FIELDS.filter((k) => normOf(k, draft[k]) !== null) : dirtyKeys;
      const body: Record<string, unknown> = {};
      for (const k of keys) {
        const v = normOf(k, draft[k]);
        body[k] = typeof v === "string" ? (v.trim() || null) : v;
      }
      body.title = title;
      if (isNew) { body.boardId = board.id; body.column = draft.column || board.columns[0]?.id; body.position = endPos(String(body.column)); }
      else if ("column" in body) body.position = endPos(String(body.column)); // changed list → goes to the bottom of it
      const row = normCard(isNew ? await boardApi.createCard(body as Partial<CardRow>) : await boardApi.updateCard(card!.id, body as Partial<CardRow>));
      const merged = { ...row, commentCount: card?.commentCount ?? 0 };
      setBase({ ...merged }); setDraft({ ...merged }); setHistKey((k) => k + 1);
      onSaved(merged, isNew);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Couldn't save.";
      setErr(m);
      toast("Couldn't save the card", "err", { description: m });
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!card) return;
    const ok = await dialog.confirm({ title: `Delete “${card.title}”?`, message: "The card, its checklist, files and comments are removed for everyone. This can't be undone.", confirmText: "Delete card", danger: true });
    if (!ok) return;
    try { await boardApi.deleteCard(card.id); onDeleted(card.id); }
    catch (e) { toast("Couldn't delete it", "err", { description: e instanceof Error ? e.message : "Try again." }); }
  }

  const list = board.columns.find((c) => c.id === draft.column);
  const clientOpts = [...new Set([...clients, String(draft.client || "").trim()].filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div className="kb-scrim" onMouseDown={tryClose} aria-hidden />
      <aside className="kb-panel" role="dialog" aria-modal="true" aria-labelledby="kb-dtitle">
        <header className="kb-dh">
          <div className="kb-dh-tx">
            <h2 id="kb-dtitle">{isNew ? "New task" : "Task"}</h2>
            <p>{board.name}{list ? <> · <span className={`kb-dot kb-t-${toneOf(list, board.columns.indexOf(list))}`} aria-hidden /> {list.title}</> : null}{!isNew && <> · #{card!.id}</>}</p>
          </div>
          <button ref={closeRef} type="button" className="sh-icb" onClick={tryClose} aria-label="Close"><HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} /></button>
        </header>

        <div className="kb-db">
          <div className="kb-form">
            {err && <div className="kb-err" role="alert"><HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} />{err}</div>}
            <div className={"kb-field" + (err && !String(draft.title || "").trim() ? " bad" : "")}>
              <label htmlFor="kb-ftitle">Title</label>
              <input id="kb-ftitle" ref={titleRef} value={String(draft.title || "")} onChange={(e) => set("title", e.target.value)} placeholder="What needs doing?" maxLength={250}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); }} />
            </div>
            <div className="kb-frow">
              <div className="kb-field"><span className="kb-flabel" id="kb-l-list">List</span>
                <Select value={String(draft.column || "")} onChange={(v) => set("column", v)} ariaLabel="List" options={board.columns.map((c) => ({ value: c.id, label: c.title }))} /></div>
              <div className="kb-field"><label htmlFor="kb-client">Client</label>
                <input id="kb-client" list="kb-clients" value={String(draft.client || "")} onChange={(e) => set("client", e.target.value)} placeholder="e.g. Morbix" maxLength={160} autoComplete="off" />
                <datalist id="kb-clients">{clientOpts.map((c) => <option key={c} value={c} />)}</datalist>
                {clientOpts.length > 0 && (
                  <div className="kb-qchips" aria-label="Pick a client">
                    {clientOpts.slice(0, 8).map((c) => (
                      <button key={c} type="button" className={"kb-qchip" + (String(draft.client || "").trim() === c ? " on" : "")} onClick={() => set("client", String(draft.client || "").trim() === c ? "" : c)}>
                        <i style={{ background: clientColor(c) }} aria-hidden />{c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="kb-frow">
              <div className="kb-field"><span className="kb-flabel">Priority</span>
                <Select value={String(draft.priority || "medium")} onChange={(v) => set("priority", v as CardRow["priority"])} ariaLabel="Priority"
                  options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} /></div>
              <div className="kb-field"><span className="kb-flabel">Status</span>
                <label className={"kb-toggle" + (draft.completed ? " on" : "")}>
                  <input type="checkbox" checked={!!draft.completed} onChange={(e) => set("completed", e.target.checked)} />
                  <span className="kb-tg-box" aria-hidden><HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.6} /></span>
                  {draft.completed ? "Completed" : "Mark as complete"}
                </label></div>
            </div>
            <div className="kb-frow kb-frow3">
              <div className="kb-field"><span className="kb-flabel">Start date</span>
                <DatePicker value={day10(draft.startDate)} onChange={(v) => set("startDate", v || null)} placeholder="Start" /></div>
              <div className="kb-field"><span className="kb-flabel">Due date</span>
                <DatePicker value={day10(draft.dueDate)} onChange={(v) => set("dueDate", v || null)} placeholder="Due" /></div>
              <div className="kb-field"><span className="kb-flabel">Renewal date <em>optional</em></span>
                <DatePicker value={day10(draft.renewalDate)} onChange={(v) => set("renewalDate", v || null)} placeholder="Renewal" /></div>
            </div>
            {(draft.startDate || draft.dueDate || draft.renewalDate) && (
              <div className="kb-clears">
                {draft.startDate && <button type="button" className="sh-link" onClick={() => set("startDate", null)}>Clear start</button>}
                {draft.dueDate && <button type="button" className="sh-link" onClick={() => set("dueDate", null)}>Clear due</button>}
                {draft.renewalDate && <button type="button" className="sh-link" onClick={() => set("renewalDate", null)}>Clear renewal</button>}
                {draft.renewalDate && <span className="kb-note">You&apos;ll be reminded as the renewal date gets close and on the day.</span>}
              </div>
            )}

            <div className="kb-field">
              <span className="kb-flabel kb-flabel-row">Labels<button type="button" className="sh-link" onClick={async () => {
                if (dirty && !(await dialog.confirm({ title: "Leave this card?", message: "Editing labels opens Board settings. Changes on this card that aren't saved will be lost.", confirmText: "Discard and continue", cancelText: "Keep editing", danger: true }))) return;
                onManage();
              }}>Edit labels</button></span>
              <div className="kb-chipset">
                {board.labels.map((l) => {
                  const on = (draft.labelIds || []).includes(l.id);
                  return (
                    <button key={l.id} type="button" className={"kb-pick" + (on ? " on" : "")} aria-pressed={on} style={{ "--lc": l.color } as React.CSSProperties} onClick={() => toggleIn("labelIds", l.id)}>
                      <i aria-hidden />{l.name}{on && <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.4} />}
                    </button>
                  );
                })}
                {!board.labels.length && <span className="kb-note">No labels on this board yet.</span>}
              </div>
            </div>
            <div className="kb-field"><span className="kb-flabel">Members</span>
              <div className="kb-chipset">
                {users.map((u) => {
                  const on = (draft.memberIds || []).includes(u.id);
                  return (
                    <button key={u.id} type="button" className={"kb-pick kb-pick-m" + (on ? " on" : "")} aria-pressed={on} onClick={() => toggleIn("memberIds", u.id)}>
                      <Av user={u} size={20} />{u.name}{on && <HugeiconsIcon icon={Tick02Icon} size={14} strokeWidth={2.4} />}
                    </button>
                  );
                })}
                {!users.length && <span className="kb-note">Add team members on the Users page.</span>}
              </div>
            </div>

            <div className="kb-field"><span className="kb-flabel">Description</span>
              <RichText value={String(draft.description || "")} onChange={(v) => set("description", v === "<p></p>" ? "" : v)} /></div>

            <Checklist items={draft.checklist || []} onChange={(v) => set("checklist", v)} />
            <Files files={draft.attachments || []} onChange={(v) => set("attachments", v)} />

            <div className="kb-field"><span className="kb-flabel">Cover</span>
              <div className="kb-covs" role="radiogroup" aria-label="Cover colour">
                {COVER_SWATCHES.map((s) => {
                  const on = (draft.cover || "") === s;
                  return <button key={s || "none"} type="button" role="radio" aria-checked={on} className={"kb-cov" + (on ? " on" : "") + (s ? "" : " none")}
                    style={s ? { background: s } : undefined} onClick={() => set("cover", s || null)} aria-label={s ? `Cover ${s}` : "No cover"} title={s || "No cover"} />;
                })}
                {draft.cover && !draft.cover.startsWith("#") && <span className="kb-note">Image cover</span>}
              </div>
            </div>

            {!isNew && <Comments taskId={card!.id} onCount={(n) => onComments(card!.id, n)} />}
            {!isNew && <div className="kb-hist"><HistoryList entity="task" id={card!.id} refreshKey={histKey} /></div>}
          </div>
        </div>

        <footer className="kb-df">
          {!isNew && <button type="button" className="sh-btn kb-danger" onClick={remove}><HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />Delete</button>}
          <span className="kb-sp" />
          {!isNew && dirty && <span className="kb-unsaved">Unsaved changes</span>}
          <button type="button" className="sh-btn" onClick={tryClose}>{dirty || isNew ? "Cancel" : "Close"}</button>
          <button type="button" className="sh-btn pri" onClick={save} disabled={saving || (!isNew && !dirty)}>
            {saving ? <><span className="spin kb-spin" aria-hidden /> Saving…</> : <><HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} />{isNew ? "Add task" : "Save"}</>}
          </button>
        </footer>
      </aside>
    </>
  );
}

/* ── checklist: add, tick, edit, reorder (drag the handle, or the arrows), delete ── */
function Checklist({ items, onChange }: { items: CheckItem[]; onChange: (v: CheckItem[]) => void }) {
  const [v, setV] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const done = items.filter((c) => c.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const add = () => { const t = v.trim(); if (!t) return; onChange([...items, { id: uid("ck"), text: t, done: false }]); setV(""); };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = items.slice(); const [x] = next.splice(from, 1); next.splice(to, 0, x); onChange(next);
  };
  return (
    <div className="kb-field">
      <span className="kb-flabel kb-flabel-row">Checklist{items.length > 0 && <em>{done}/{items.length} done · {pct}%</em>}</span>
      {items.length > 0 && <span className="kb-bar kb-bar-lg" aria-hidden><i style={{ width: `${pct}%` }} /></span>}
      <ul className="kb-cklist">
        {items.map((c, i) => (
          <li key={c.id} className={"kb-ckrow" + (c.done ? " done" : "") + (drag === i ? " is-drag" : "")}
            onDragOver={(e) => { if (drag == null) return; e.preventDefault(); if (drag !== i) { move(drag, i); setDrag(i); } }}
            onDrop={(e) => { e.preventDefault(); setDrag(null); }}>
            <span className="kb-handle" draggable onDragStart={(e) => { setDrag(i); try { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; } catch { /* */ } }}
              onDragEnd={() => setDrag(null)} title="Drag to reorder" aria-hidden><HugeiconsIcon icon={DragDropVerticalIcon} size={16} strokeWidth={1.8} /></span>
            <input type="checkbox" checked={c.done} aria-label={`Done: ${c.text}`} onChange={() => onChange(items.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} />
            <input className="kb-cktext" value={c.text} aria-label="Checklist item" onChange={(e) => onChange(items.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
              onBlur={(e) => { if (!e.target.value.trim()) onChange(items.filter((x) => x.id !== c.id)); }} />
            <span className="kb-ckbtns">
              <button type="button" className="sh-icb sm plain" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up"><HugeiconsIcon icon={ArrowUp01Icon} size={15} strokeWidth={1.8} /></button>
              <button type="button" className="sh-icb sm plain" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label="Move down"><HugeiconsIcon icon={ArrowDown01Icon} size={15} strokeWidth={1.8} /></button>
              <button type="button" className="sh-icb sm plain" onClick={() => onChange(items.filter((x) => x.id !== c.id))} aria-label={`Remove ${c.text}`}><HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={1.8} /></button>
            </span>
          </li>
        ))}
        {!items.length && <li className="kb-note">No items yet.</li>}
      </ul>
      <div className="kb-addrow">
        <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add an item and press Enter" aria-label="New checklist item" maxLength={300}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="sh-btn" onClick={add}><HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />Add</button>
      </div>
    </div>
  );
}

/* ── files: upload images (thumbnail shown), or attach a link to any other file ── */
function Files({ files, onChange }: { files: CardFile[]; onChange: (v: CardFile[]) => void }) {
  const [busy, setBusy] = useState(0);
  const inRef = useRef<HTMLInputElement>(null);
  const latest = useRef(files);
  latest.current = files;
  async function upload(list: FileList | null) {
    const fs = Array.from(list || []);
    if (!fs.length) return;
    setBusy((b) => b + fs.length);
    for (const f of fs) {
      try {
        const r = await boardApi.upload(f);
        latest.current = [...latest.current, { id: uid("at"), url: r.url, name: f.name, thumbUrl: r.thumbUrl || null }];
        onChange(latest.current);
      } catch (e) {
        toast(`Couldn't upload ${f.name}`, "err", { description: e instanceof Error ? e.message : "Try again." });
      } finally { setBusy((b) => b - 1); }
    }
  }
  async function addLink() {
    const url = (await dialog.prompt({ title: "Attach a link", message: "A Google Drive, Dropbox or any other file link.", placeholder: "https://…", confirmText: "Next" }))?.trim();
    if (!url) return;
    if (!/^https?:\/\/\S+$/i.test(url)) { toast("That doesn't look like a link", "warn", { description: "Start it with https://" }); return; }
    const guess = decodeURIComponent(url.split(/[?#]/)[0].split("/").filter(Boolean).pop() || "Link");
    const name = (await dialog.prompt({ title: "Name it", defaultValue: guess, confirmText: "Attach" }))?.trim();
    if (name === undefined || name === null) return;
    onChange([...latest.current, { id: uid("at"), url, name: name || guess }]);
  }
  return (
    <div className="kb-field">
      <span className="kb-flabel kb-flabel-row">Files{files.length > 0 && <em>{files.length}</em>}</span>
      {files.length > 0 && (
        <ul className="kb-files">
          {files.map((f) => {
            const img = isImage(f);
            return (
              <li key={f.id} className="kb-file">
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="kb-file-a" title={f.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img ? <img src={f.thumbUrl || f.url} alt="" loading="lazy" /> : <span className="kb-file-ic"><HugeiconsIcon icon={/^https?:/.test(f.url) && !/\/uploads\//.test(f.url) ? Link04Icon : File01Icon} size={22} strokeWidth={1.6} /></span>}
                  <span className="kb-file-n">{f.name}</span>
                </a>
                <button type="button" className="kb-file-x" onClick={() => onChange(files.filter((x) => x.id !== f.id))} aria-label={`Remove ${f.name}`}><HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} /></button>
              </li>
            );
          })}
          {Array.from({ length: busy }).map((_, i) => <li key={`up${i}`} className="kb-file"><span className="skel kb-file-skel" /></li>)}
        </ul>
      )}
      <div className="kb-filebtns">
        <input ref={inRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.currentTarget.value = ""; }} />
        <button type="button" className="sh-btn" onClick={() => inRef.current?.click()} disabled={busy > 0}>
          {busy > 0 ? <span className="spin kb-spin" aria-hidden /> : <HugeiconsIcon icon={Image01Icon} size={16} strokeWidth={1.8} />}{busy > 0 ? "Uploading…" : "Upload images"}
        </button>
        <button type="button" className="sh-btn" onClick={addLink}><HugeiconsIcon icon={Link04Icon} size={16} strokeWidth={1.8} />Attach a link</button>
      </div>
      {files.length === 0 && busy === 0 && <span className="kb-note">Images upload here (compressed, with thumbnails). For PDFs or videos, attach a Drive link.</span>}
    </div>
  );
}

/* ── comments (saved cards): posted straight away; members are notified ── */
function Comments({ taskId, onCount }: { taskId: number; onCount: (n: number) => void }) {
  const [rows, setRows] = useState<CardComment[] | null>(null);
  const [err, setErr] = useState("");
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setErr("");
    try { const r = await boardApi.comments(taskId); setRows(Array.isArray(r) ? r : []); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load the comments."); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [taskId]);
  async function post() {
    const b = v.trim();
    if (!b) return;
    setBusy(true);
    try {
      const c = await boardApi.addComment(taskId, b);
      const next = [...(rows || []), c];
      setRows(next); setV(""); onCount(next.length);
    } catch (e) { toast("Couldn't post the comment", "err", { description: e instanceof Error ? e.message : "Try again." }); }
    finally { setBusy(false); }
  }
  async function remove(c: CardComment) {
    if (!(await dialog.confirm({ title: "Delete this comment?", message: c.body.slice(0, 140), confirmText: "Delete", danger: true }))) return;
    try {
      await boardApi.deleteComment(c.id);
      const next = (rows || []).filter((x) => x.id !== c.id);
      setRows(next); onCount(next.length);
    } catch (e) { toast("Couldn't delete the comment", "err", { description: e instanceof Error ? e.message : "Try again." }); }
  }
  return (
    <div className="kb-field kb-cmts">
      <span className="kb-flabel kb-flabel-row">Comments{rows && rows.length > 0 && <em>{rows.length}</em>}</span>
      {err ? (
        <div className="kb-err" role="alert"><HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} />{err}
          <button type="button" className="sh-btn sm" onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={1.8} />Retry</button></div>
      ) : !rows ? (
        <span className="skel skel-line" style={{ width: "60%", height: 14 }} />
      ) : (
        <ul className="kb-clist">
          {rows.map((c) => (
            <li key={c.id} className="kb-cm">
              <Av user={c.author || { name: "Someone" }} size={28} />
              <div className="kb-cm-b">
                <span className="kb-cm-h"><b>{c.author?.name || "Someone"}</b><small title={whenOf(c.createdAt)}>{relative(c.createdAt)}</small></span>
                <p>{c.body}</p>
              </div>
              <button type="button" className="sh-icb sm plain" onClick={() => remove(c)} aria-label="Delete comment"><HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} /></button>
            </li>
          ))}
          {!rows.length && <li className="kb-note">No comments yet. Members of the card are notified when you post.</li>}
        </ul>
      )}
      <div className="kb-addrow kb-cm-add">
        <textarea rows={2} value={v} onChange={(e) => setV(e.target.value)} placeholder="Write a comment… (Ctrl+Enter to post)" aria-label="New comment"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); post(); } }} />
        <button type="button" className="sh-btn" onClick={post} disabled={busy || !v.trim()}><HugeiconsIcon icon={Sent02Icon} size={16} strokeWidth={1.8} />{busy ? "Posting…" : "Post"}</button>
      </div>
    </div>
  );
}
