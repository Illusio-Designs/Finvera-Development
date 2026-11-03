"use client";
/* Board settings: name and description, the lists (rename, reorder, add,
   delete — a deleted list's cards move to another list) and the labels
   (add, rename, colour, delete), and deleting the board. One Save. */
import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Add01Icon, ArrowUp01Icon, ArrowDown01Icon, Delete02Icon, Tick02Icon, Alert02Icon } from "@hugeicons/core-free-icons";
import type { BoardRow, BoardList, BoardLabel, CardRow } from "@/lib/adminApi";
import Select from "@/components/Select";
import { dialog } from "@/lib/dialog";
import { uid, toneOf, LABEL_COLORS, plural } from "./boardKit";

export type SettingsSave = { patch: Partial<BoardRow>; moveTo: string | null; removed: string[] };

export default function BoardSettings({ board, cards, focus, onClose, onSave, onDeleteBoard }: {
  board: BoardRow; cards: CardRow[]; focus?: "labels" | null;
  onClose: () => void; onSave: (s: SettingsSave) => Promise<boolean>; onDeleteBoard: () => void;
}) {
  const [name, setName] = useState(board.name);
  const [desc, setDesc] = useState(board.description || "");
  const [lists, setLists] = useState<BoardList[]>(board.columns);
  const [labels, setLabels] = useState<BoardLabel[]>(board.labels);
  const [moveTo, setMoveTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [colorFor, setColorFor] = useState<string | null>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focus === "labels") setTimeout(() => labelsRef.current?.scrollIntoView({ block: "start" }), 60);
    else closeRef.current?.focus({ preventScroll: true });
  }, [focus]);

  const count = (id: string) => cards.filter((t) => t.column === id).length;
  const removed = useMemo(() => board.columns.filter((c) => !lists.some((l) => l.id === c.id)).map((c) => c.id), [board.columns, lists]);
  const orphaned = removed.reduce((n, id) => n + count(id), 0);
  const target = moveTo && lists.some((l) => l.id === moveTo) ? moveTo : lists[0]?.id || "";
  const cleanLists = lists.map((l) => ({ ...l, title: l.title.trim() }));
  const cleanLabels = labels.map((l) => ({ ...l, name: l.name.trim() }));
  const patch: Partial<BoardRow> = {};
  if (name.trim() !== board.name) patch.name = name.trim();
  if (desc.trim() !== (board.description || "")) patch.description = desc.trim() || null;
  if (JSON.stringify(cleanLists) !== JSON.stringify(board.columns)) patch.columns = cleanLists;
  if (JSON.stringify(cleanLabels) !== JSON.stringify(board.labels)) patch.labels = cleanLabels;
  const dirty = Object.keys(patch).length > 0;

  async function tryClose() {
    if (dirty && !saving && !(await dialog.confirm({ title: "Discard your changes?", message: "The board settings you changed haven't been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return;
    onClose();
  }
  const tryCloseRef = useRef(tryClose);
  tryCloseRef.current = tryClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !document.querySelector(".adm-overlay, .cselect-drop")) tryCloseRef.current(); };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, []);

  async function save() {
    if (!name.trim()) { setErr("Give the board a name."); return; }
    if (!cleanLists.length) { setErr("Keep at least one list."); return; }
    if (cleanLists.some((l) => !l.title)) { setErr("Every list needs a name."); return; }
    if (cleanLabels.some((l) => !l.name)) { setErr("Every label needs a name (or delete it)."); return; }
    setErr(""); setSaving(true);
    const ok = await onSave({ patch, moveTo: orphaned ? target : null, removed });
    setSaving(false);
    if (ok) onClose();
  }

  const moveList = (i: number, to: number) => {
    if (to < 0 || to >= lists.length) return;
    const n = lists.slice(); const [x] = n.splice(i, 1); n.splice(to, 0, x); setLists(n);
  };
  async function removeList(l: BoardList) {
    const n = count(l.id);
    if (n && !(await dialog.confirm({ title: `Delete the “${l.title}” list?`, message: `Its ${plural(n, "card")} will move to another list when you save — pick which one below.`, confirmText: "Delete list", danger: true }))) return;
    setLists((ls) => ls.filter((x) => x.id !== l.id));
  }
  async function removeLabel(l: BoardLabel) {
    const n = cards.filter((t) => t.labelIds.includes(l.id)).length;
    if (n && !(await dialog.confirm({ title: `Delete the “${l.name}” label?`, message: `It comes off ${plural(n, "card")}.`, confirmText: "Delete label", danger: true }))) return;
    setLabels((ls) => ls.filter((x) => x.id !== l.id));
  }

  return (
    <>
      <div className="kb-scrim" onMouseDown={tryClose} aria-hidden />
      <aside className="kb-panel kb-settings" role="dialog" aria-modal="true" aria-labelledby="kb-stitle">
        <header className="kb-dh">
          <div className="kb-dh-tx"><h2 id="kb-stitle">Board settings</h2><p>{board.name} · lists, labels and name</p></div>
          <button ref={closeRef} type="button" className="sh-icb" onClick={tryClose} aria-label="Close"><HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} /></button>
        </header>
        <div className="kb-db">
          <div className="kb-form">
            {err && <div className="kb-err" role="alert"><HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={2} />{err}</div>}
            <div className="kb-fsec">Board</div>
            <div className="kb-field"><label htmlFor="kb-bname">Name</label>
              <input id="kb-bname" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></div>
            <div className="kb-field"><label htmlFor="kb-bdesc">Description</label>
              <input id="kb-bdesc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this board is for" maxLength={300} /></div>

            <div className="kb-fsec">Lists</div>
            <ul className="kb-srows">
              {lists.map((l, i) => (
                <li key={l.id} className="kb-srow">
                  <i className={`kb-dot kb-t-${toneOf(l, i)}`} aria-hidden />
                  <input value={l.title} aria-label={`List name ${i + 1}`} maxLength={60}
                    onChange={(e) => setLists((ls) => ls.map((x) => (x.id === l.id ? { ...x, title: e.target.value } : x)))} />
                  <small>{plural(count(l.id), "card")}</small>
                  <button type="button" className="sh-icb sm plain" onClick={() => moveList(i, i - 1)} disabled={i === 0} aria-label={`Move ${l.title} up`}><HugeiconsIcon icon={ArrowUp01Icon} size={15} strokeWidth={1.8} /></button>
                  <button type="button" className="sh-icb sm plain" onClick={() => moveList(i, i + 1)} disabled={i === lists.length - 1} aria-label={`Move ${l.title} down`}><HugeiconsIcon icon={ArrowDown01Icon} size={15} strokeWidth={1.8} /></button>
                  <button type="button" className="sh-icb sm plain" onClick={() => removeList(l)} disabled={lists.length === 1} aria-label={`Delete list ${l.title}`}><HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} /></button>
                </li>
              ))}
            </ul>
            <button type="button" className="sh-btn kb-sadd" onClick={() => setLists((ls) => [...ls, { id: uid("col"), title: "New list" }])}><HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />Add list</button>
            {orphaned > 0 && (
              <div className="kb-field kb-moveto"><span className="kb-flabel">Move the {plural(orphaned, "card")} from deleted lists to</span>
                <Select value={target} onChange={setMoveTo} ariaLabel="Move cards to" options={lists.map((l) => ({ value: l.id, label: l.title || "Untitled list" }))} /></div>
            )}

            <div className="kb-fsec" ref={labelsRef}>Labels</div>
            <ul className="kb-srows">
              {labels.map((l) => (
                <li key={l.id} className="kb-srow kb-srow-l">
                  <button type="button" className="kb-swatch" style={{ background: l.color }} aria-label={`Colour of ${l.name || "label"}`} aria-expanded={colorFor === l.id}
                    onClick={() => setColorFor(colorFor === l.id ? null : l.id)} />
                  <input value={l.name} aria-label="Label name" maxLength={40} placeholder="Label name"
                    onChange={(e) => setLabels((ls) => ls.map((x) => (x.id === l.id ? { ...x, name: e.target.value } : x)))} />
                  <span className="kb-label kb-label-prev" style={{ "--lc": l.color } as React.CSSProperties}>{l.name || "Label"}</span>
                  <button type="button" className="sh-icb sm plain" onClick={() => removeLabel(l)} aria-label={`Delete label ${l.name}`}><HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} /></button>
                  {colorFor === l.id && (
                    <div className="kb-palette" role="radiogroup" aria-label="Label colour">
                      {LABEL_COLORS.map((c) => (
                        <button key={c} type="button" role="radio" aria-checked={l.color === c} className={"kb-swatch" + (l.color === c ? " on" : "")} style={{ background: c }} aria-label={c}
                          onClick={() => { setLabels((ls) => ls.map((x) => (x.id === l.id ? { ...x, color: c } : x))); setColorFor(null); }}>
                          {l.color === c && <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.6} />}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {!labels.length && <li className="kb-note">No labels yet.</li>}
            </ul>
            <button type="button" className="sh-btn kb-sadd" onClick={() => {
              const id = uid("lb");
              setLabels((ls) => [...ls, { id, name: "", color: LABEL_COLORS[ls.length % LABEL_COLORS.length] }]);
              setTimeout(() => (document.querySelector(".kb-srow-l:last-child input") as HTMLInputElement | null)?.focus(), 30);
            }}><HugeiconsIcon icon={Add01Icon} size={16} strokeWidth={2} />Add label</button>

            <div className="kb-fsec">Danger zone</div>
            <div className="kb-dzone">
              <div><b>Delete this board</b><span>The board and all {plural(cards.length, "card")} on it are removed for everyone.</span></div>
              <button type="button" className="sh-btn kb-danger" onClick={onDeleteBoard}><HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />Delete board</button>
            </div>
          </div>
        </div>
        <footer className="kb-df">
          <span className="kb-sp" />
          {dirty && <span className="kb-unsaved">Unsaved changes</span>}
          <button type="button" className="sh-btn" onClick={tryClose}>{dirty ? "Cancel" : "Close"}</button>
          <button type="button" className="sh-btn pri" onClick={save} disabled={saving || !dirty}>
            {saving ? <><span className="spin kb-spin" aria-hidden /> Saving…</> : <><HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} />Save</>}
          </button>
        </footer>
      </aside>
    </>
  );
}
