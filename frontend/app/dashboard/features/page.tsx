"use client";
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
import { Check } from "@/components/icons";
import SolutionFeatures from "@/components/SolutionFeatures";
import HistoryList from "@/components/admin/HistoryList";
import "./features-workspace.css";
type FeatureRow = { id: number; title: string; description: string | null; position: number; status: string; createdAt?: string };
const FIELDS = ["title", "description", "position", "status"] as const;
const sorted = (rows: FeatureRow[]) => [...rows].sort((a, b) => a.position - b.position || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id - b.id);
export default function AdminFeatures() {
  const { data: rows, setData: setRows, loading: busy, setLoading: setBusy, error, setError } = useResourceState<FeatureRow[] | null>(null, true);
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: FeatureRow | null; key: number } | null>(null), [ordering, setOrdering] = useState(false);
  const orderPending = useRef(false);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("features"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load solution features."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const filtered = !!(query.trim() || status);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.title, row.description].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: FeatureRow) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  async function move(index: number, direction: number) {
    if (!rows || filtered || orderPending.current || !rows[index + direction]) return;
    orderPending.current = true; setOrdering(true); setError("");
    const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    try {
      const result = await api.reorderFeatures(next.map(row => row.id), rows);
      setRows(result.items); toast("Website order saved", "ok");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the order."); }
    finally { orderPending.current = false; setOrdering(false); }
  }
  return <div className="features-workspace"><header className="sfn-header"><div><span className="sfn-eyebrow">THE DETAILS THAT MAKE IT USEFUL</span><h1>Solution features</h1><p>Show visitors what your platform helps them do.</p></div><div className="sfn-header-actions"><a className="sh-btn" href="/#solutions" target="_blank" rel="noopener noreferrer">Open homepage <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" disabled={ordering} onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New feature</button></div></header>
    {!rows && busy && !error ? <PageLoading label="Loading solution features…" variant="list" /> : <>
    <div className="sfn-toolbar"><div className="sfn-tabs" role="tablist" aria-label="Feature status">{[["", "All features"], ["published", "Published"], ["draft", "Drafts"]].map(([value, label]) => <button type="button" role="tab" aria-selected={status === value} key={value} onClick={() => setStatus(value)}>{label}{rows && <small>{rows.filter(row => !value || row.status === value).length}</small>}</button>)}</div><label className="sfn-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search features" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a feature…" /></label><button type="button" className="sh-icb" aria-label="Refresh features" disabled={busy || ordering} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="sfn-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy || ordering} onClick={load}>Try again</button></div>}
    <div className="sfn-list-caption"><span>{rows ? `${shown.length} features` : busy ? "Loading solution features…" : "Features unavailable"}</span><span>{filtered ? "Clear filters to change the website order." : ordering ? "Saving website order…" : "Use the arrows to arrange features on the website."}</span></div>
    <div className="sfn-list">{shown.map((row, index) => <article className="sfn-row" key={row.id}><span className="sfn-number">{String(index + 1).padStart(2, "0")}</span><span className="sfn-icon"><Check width={21} /></span><button type="button" className="sfn-title" disabled={ordering} onClick={() => setEditing({ row, key: Date.now() })}><b>{row.title}</b><small>{row.description || "Add a description before publishing"}</small></button><span className={`sfn-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="sfn-order"><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} up`} disabled={filtered || ordering || busy || index === 0} onClick={() => move(index, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={15} /></button><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} down`} disabled={filtered || ordering || busy || index === shown.length - 1} onClick={() => move(index, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={15} /></button></div><button type="button" className="sh-btn sm sfn-edit" disabled={ordering} aria-label={`Edit ${row.title}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></button></article>)}</div>
    {rows && !shown.length && !error && <div className="sfn-empty"><h2>{rows.length ? "No features match" : "What makes your solution useful?"}</h2><p>{rows.length ? "Try another search or status." : "Start with a private draft, then describe the benefit for your customers."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New feature"}</button></div>}
    <p className="sfn-note">Published features appear in the homepage Solutions section in this order. Drafts stay private.</p>
    </>}
    {editing && <FeatureEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function FeatureEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: FeatureRow | null; nextPosition: number; onClose: () => void; onSaved: (row: FeatureRow) => void; onPatch: (row: FeatureRow) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<FeatureRow>>(row || { title: "", description: "", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base);
  const { saving: busy, setSaving: setBusy, error, setError, conflict, setConflict } = useSaveWorkflow();
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof FeatureRow, value: any) => { if (!busy) setDraft(current => ({ ...current, [field]: value })); };
  async function close() { if (busy) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your feature changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function save() {
    if (busy) return;
    if (!draft.title?.trim()) { setError("Add the feature title."); return; }
    if (draft.status === "published" && !draft.description?.trim()) { setError("Add a description before publishing."); return; }
    setBusy(true); setError(""); setConflict(false);
    const fields = row ? dirtyKeys : FIELDS;
    const body = Object.fromEntries(fields.map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("features", row.id, { ...body, expected: base }) : await api.create("features", body); toast(saved.status === "published" ? "Feature published" : "Draft saved", "ok", { description: saved.title }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this feature."); }
    finally { setBusy(false); }
  }
  async function reload() { if (busy || !row || !(await dialog.confirm({ title: "Reload this feature?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("features", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.title}?`, message: "This removes the feature from your website. Save it as a draft to keep it privately.", confirmText: "Delete feature", danger: true }))) return; setBusy(true); try { await api.remove("features", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  return <div className="sfn-overlay"><section className="sfn-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit ${row.title}` : "New feature"}><header className="sfn-editor-header"><div><span className="sfn-eyebrow">ONE FEATURE. A CLEAR BENEFIT.</span><h2>{draft.title || "New feature"}</h2><p>Edit the content. Check the card. Publish when ready.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="sfn-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="sfn-editor-body"><div className="sfn-form" inert={busy}><label className="sfn-field"><span>Feature title</span><input maxLength={255} value={draft.title || ""} onChange={event => set("title", event.target.value)} /></label><label className="sfn-field"><span>Description</span><textarea aria-label="Description" rows={6} value={draft.description || ""} onChange={event => set("description", event.target.value)} placeholder="What does this feature help your customers achieve?" /></label><div className="sfn-pair"><div className="sfn-field"><label htmlFor="sfn-status">Publication status</label><Select id="sfn-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="sfn-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="feature" id={row.id} />}</div>
    <aside className="sfn-preview"><span className="sfn-eyebrow">PRIVATE FEATURE PREVIEW</span><p>Preview of your current edits. Changes appear on the website after saving as Published.</p><article className="sfn-preview-card"><SolutionFeatures items={[{ id: row?.id ?? 0, title: draft.title || "Your next feature", description: draft.description || "Describe the benefit for your customers.", status: "published" }]} /></article><span className={`sfn-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="sfn-editor-footer">{row && <button type="button" className="sh-btn sfn-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
