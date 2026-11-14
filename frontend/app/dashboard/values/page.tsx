"use client";
import { WorkspaceHero } from "@/components/admin/Workspace";
import { useResourceState } from "@/lib/useResourceState";
import { useSaveWorkflow } from "@/lib/useSaveWorkflow";
import PageLoading from "@/components/admin/PageLoading";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon, Refresh01Icon, ArrowUp01Icon, ArrowDown01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";
import ContentIcon from "@/components/contentIcon";
import HistoryList from "@/components/admin/HistoryList";
import "./values-workspace.css";
type Value = { id: number; title: string; icon: string; description: string | null; position: number; status: string; createdAt?: string };
const ICONS = [["rocket", "Momentum"], ["target", "Focus"], ["award", "Craft"], ["agreement", "Partnership"], ["paint", "Design"], ["calculator", "Clarity"], ["store", "Commerce"], ["megaphone", "Voice"], ["code", "Engineering"], ["search", "Curiosity"], ["cloud", "Scale"], ["team", "People"], ["ai", "Intelligence"]];
const FIELDS = ["title", "icon", "description", "position", "status"] as const;
const sorted = (rows: Value[]) => [...rows].sort((a, b) => a.position - b.position || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id - b.id);
export default function AdminValues() {
  const { data: rows, setData: setRows, loading: busy, setLoading: setBusy, error, setError } = useResourceState<Value[] | null>(null, true);
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: Value | null; key: number } | null>(null), [ordering, setOrdering] = useState(false);
  const orderPending = useRef(false);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("values"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load values."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const filtered = !!(query.trim() || status);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.title, row.description, row.icon].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: Value) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  async function move(index: number, direction: number) {
    if (!rows || filtered || orderPending.current || !rows[index + direction]) return;
    orderPending.current = true; setOrdering(true); setError("");
    const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    try {
      const result = await api.reorderValues(next.map(row => row.id), rows);
      setRows(result.items); toast("Website order saved", "ok");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the order."); }
    finally { orderPending.current = false; setOrdering(false); }
  }
  return <div className="values-workspace"><WorkspaceHero eyebrow="THE PRINCIPLES BEHIND YOUR WORK" title="Values" description="Show visitors the principles that guide your team." actions={<> <div className="vl-header-actions"><a className="sh-btn" href="/about" target="_blank" rel="noopener noreferrer">Open About page <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" disabled={ordering} onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New value</button></div> </>} />
    {!rows && busy && !error ? <PageLoading label="Loading values…" variant="list" /> : <>
    <div className="vl-toolbar"><div className="vl-tabs" role="tablist" aria-label="Value status">{[["", "All values"], ["published", "Published"], ["draft", "Drafts"]].map(([value, label]) => <button type="button" role="tab" aria-selected={status === value} key={value} onClick={() => setStatus(value)}>{label}{rows && <small>{rows.filter(row => !value || row.status === value).length}</small>}</button>)}</div><label className="vl-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search values" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a value…" /></label><button type="button" className="sh-icb" aria-label="Refresh values" disabled={busy || ordering} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="vl-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy || ordering} onClick={load}>Try again</button></div>}
    <div className="vl-list-caption"><span>{rows ? `${shown.length} values` : busy ? "Loading values…" : "Values unavailable"}</span><span>{filtered ? "Clear filters to change the website order." : ordering ? "Saving website order…" : "Use the arrows to arrange values on the website."}</span></div>
    <div className="vl-list">{shown.map((row, index) => <article className="vl-row" key={row.id}><span className="vl-number">{String(index + 1).padStart(2, "0")}</span><span className={`vl-icon ${row.icon}`}><ContentIcon name={row.icon} /></span><button type="button" className="vl-title" disabled={ordering} onClick={() => setEditing({ row, key: Date.now() })}><b>{row.title}</b><small>{ICONS.find(([value]) => value === row.icon)?.[1] || "Value"}</small></button><span className={`vl-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="vl-order"><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} up`} disabled={filtered || ordering || busy || index === 0} onClick={() => move(index, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={15} /></button><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} down`} disabled={filtered || ordering || busy || index === shown.length - 1} onClick={() => move(index, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={15} /></button></div><button type="button" className="sh-btn sm vl-edit" disabled={ordering} aria-label={`Edit ${row.title}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></button></article>)}</div>
    {rows && !shown.length && !error && <div className="vl-empty"><h2>{rows.length ? "No values match" : "What guides the way you work?"}</h2><p>{rows.length ? "Try another search or status." : "Start with a draft and shape your next value."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New value"}</button></div>}
    <p className="vl-note">Published values appear on About in this order. Drafts stay private.</p>
    </>}
    {editing && <ValueEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function ValueEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: Value | null; nextPosition: number; onClose: () => void; onSaved: (row: Value) => void; onPatch: (row: Value) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<Value>>(row || { title: "", description: "", icon: "rocket", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base);
  const { saving: busy, setSaving: setBusy, error, setError, conflict, setConflict } = useSaveWorkflow();
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof Value, value: any) => { if (!busy) setDraft(current => ({ ...current, [field]: value })); };
  async function close() { if (busy) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your value changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function save() {
    if (busy) return;
    if (!draft.title?.trim()) { setError("Add the value title."); return; }
    if (draft.status === "published" && !draft.description?.trim()) { setError("Add a description before publishing."); return; }
    setBusy(true); setError(""); setConflict(false);
    const fields = row ? dirtyKeys : FIELDS;
    const body = Object.fromEntries(fields.map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("values", row.id, { ...body, expected: base }) : await api.create("values", body); toast(saved.status === "published" ? "Value published" : "Draft saved", "ok", { description: saved.title }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this value."); }
    finally { setBusy(false); }
  }
  async function reload() { if (!row || !(await dialog.confirm({ title: "Reload this value?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("values", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.title}?`, message: "This removes the value from your website. Save it as a draft to keep it privately.", confirmText: "Delete value", danger: true }))) return; setBusy(true); try { await api.remove("values", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  return <div className="vl-overlay"><section className="vl-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit ${row.title}` : "New value"}><header className="vl-editor-header"><div><span className="vl-eyebrow">A PRINCIPLE PUT INTO PRACTICE</span><h2>{draft.title || "New value"}</h2><p>Edit the content. Check the card. Publish when ready.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="vl-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="vl-editor-body"><div className="vl-form" inert={busy}><label className="vl-field"><span>Value title</span><input maxLength={255} value={draft.title || ""} onChange={event => set("title", event.target.value)} /></label><div className="vl-field"><span>Value icon</span><div className="vl-icon-picker" role="radiogroup" aria-label="Value icon">{ICONS.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={draft.icon === value} onClick={() => set("icon", value)}><ContentIcon name={value} /><span>{label}</span></button>)}</div></div><label className="vl-field"><span>Description</span><textarea aria-label="Description" rows={6} value={draft.description || ""} onChange={event => set("description", event.target.value)} placeholder="How does this principle guide your work?" /></label><div className="vl-pair"><div className="vl-field"><label htmlFor="vl-status">Publication status</label><Select id="vl-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="vl-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="value" id={row.id} />}</div>
    <aside className="vl-preview"><span className="vl-eyebrow">PRIVATE CARD PREVIEW</span><p>Preview of your current edits. Changes appear on the website after saving as Published.</p><article className="vl-preview-card"><span className="vl-preview-icon"><ContentIcon name={draft.icon || "rocket"} /></span><h3>{draft.title || "Your next value"}</h3><p>{draft.description || "Your value description will appear here."}</p></article><span className={`vl-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="vl-editor-footer">{row && <button type="button" className="sh-btn vl-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
