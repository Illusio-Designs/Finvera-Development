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
import ContentIcon from "@/components/contentIcon";
import { brandWebsite } from "@/lib/brandPresentation";
import HistoryList from "@/components/admin/HistoryList";
import "./brands-workspace.css";
type Brand = { id: number; name: string; category: string | null; url: string | null; icon: string; description: string | null; position: number; status: string; createdAt?: string };
const ICONS = [["rocket", "Momentum"], ["target", "Focus"], ["award", "Craft"], ["agreement", "Partnership"], ["paint", "Design"], ["calculator", "Clarity"], ["store", "Commerce"], ["megaphone", "Voice"], ["code", "Engineering"], ["search", "Curiosity"], ["cloud", "Scale"], ["team", "People"], ["ai", "Intelligence"]];
const FIELDS = ["name", "category", "url", "icon", "description", "position", "status"] as const;
const sorted = (rows: Brand[]) => [...rows].sort((a, b) => a.position - b.position || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id - b.id);
export default function AdminBrands() {
  const { data: rows, setData: setRows, loading: busy, setLoading: setBusy, error, setError } = useResourceState<Brand[] | null>(null, true);
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: Brand | null; key: number } | null>(null), [ordering, setOrdering] = useState(false);
  const orderPending = useRef(false);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("brands"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load brands."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const filtered = !!(query.trim() || status);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.name, row.category, row.description, row.url].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: Brand) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  async function move(index: number, direction: number) {
    if (!rows || filtered || orderPending.current || !rows[index + direction]) return;
    orderPending.current = true; setOrdering(true); setError("");
    const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    try {
      const result = await api.reorderBrands(next.map(row => row.id), rows);
      setRows(result.items); toast("Website order saved", "ok");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the order."); }
    finally { orderPending.current = false; setOrdering(false); }
  }
  return <div className="brands-workspace"><header className="be-header"><div><span className="be-eyebrow">CONNECTED BRANDS. SHARED AMBITION.</span><h1>Brand ecosystem</h1><p>Introduce the brands and products in your ecosystem.</p></div><div className="be-header-actions"><a className="sh-btn" href="/about" target="_blank" rel="noopener noreferrer">Open About page <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" disabled={ordering} onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New brand</button></div></header>
    {!rows && busy && !error ? <PageLoading label="Loading brands…" variant="list" /> : <>
    <div className="be-toolbar"><div className="be-tabs" role="tablist" aria-label="Brand status">{[["", "All brands"], ["published", "Published"], ["draft", "Drafts"]].map(([brand, label]) => <button type="button" role="tab" aria-selected={status === brand} key={brand} onClick={() => setStatus(brand)}>{label}{rows && <small>{rows.filter(row => !brand || row.status === brand).length}</small>}</button>)}</div><label className="be-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search brands" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a brand…" /></label><button type="button" className="sh-icb" aria-label="Refresh brands" disabled={busy || ordering} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="be-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy || ordering} onClick={load}>Try again</button></div>}
    <div className="be-list-caption"><span>{rows ? `${shown.length} brands` : busy ? "Loading brands…" : "Brands unavailable"}</span><span>{filtered ? "Clear filters to change the website order." : ordering ? "Saving website order…" : "Use the arrows to arrange brands on the website."}</span></div>
    <div className="be-list">{shown.map((row, index) => <article className="be-row" key={row.id}><span className="be-number">{String(index + 1).padStart(2, "0")}</span><span className={`be-icon ${row.icon}`}><ContentIcon name={row.icon} /></span><button type="button" className="be-title" disabled={ordering} onClick={() => setEditing({ row, key: Date.now() })}><b>{row.name}</b><small>{row.category || "Category to be added"}</small></button><span className={`be-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="be-order"><button type="button" className="sh-icb sm" aria-label={`Move ${row.name} up`} disabled={filtered || ordering || busy || index === 0} onClick={() => move(index, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={15} /></button><button type="button" className="sh-icb sm" aria-label={`Move ${row.name} down`} disabled={filtered || ordering || busy || index === shown.length - 1} onClick={() => move(index, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={15} /></button></div><button type="button" className="sh-btn sm be-edit" disabled={ordering} aria-label={`Edit ${row.name}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></button></article>)}</div>
    {rows && !shown.length && !error && <div className="be-empty"><h2>{rows.length ? "No brands match" : "Introduce the brands in your ecosystem"}</h2><p>{rows.length ? "Try another search or status." : "Start with a draft and shape your next brand."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New brand"}</button></div>}
    <p className="be-note">Published brands appear on About in this order. Drafts stay private.</p>
    </>}
    {editing && <BrandEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function BrandEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: Brand | null; nextPosition: number; onClose: () => void; onSaved: (row: Brand) => void; onPatch: (row: Brand) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<Brand>>(row || { name: "", category: "", url: "", description: "", icon: "code", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base);
  const { saving: busy, setSaving: setBusy, error, setError, conflict, setConflict } = useSaveWorkflow();
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof Brand, brand: any) => { if (!busy) setDraft(current => ({ ...current, [field]: brand })); };
  async function close() { if (busy) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your brand changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function save() {
    if (busy) return;
    if (!draft.name?.trim()) { setError("Add the brand name."); return; }
    if (draft.status === "published" && !draft.description?.trim()) { setError("Add a description before publishing."); return; }
    if (draft.url && !brandWebsite(draft.url)) { setError("Use an absolute HTTP or HTTPS website URL."); return; }
    setBusy(true); setError(""); setConflict(false);
    const fields = row ? dirtyKeys : FIELDS;
    const body = Object.fromEntries(fields.map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("brands", row.id, { ...body, expected: base }) : await api.create("brands", body); toast(saved.status === "published" ? "Brand published" : "Draft saved", "ok", { description: saved.name }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this brand."); }
    finally { setBusy(false); }
  }
  async function reload() { if (!row || !(await dialog.confirm({ title: "Reload this brand?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("brands", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.name}?`, message: "This removes the brand from your website. Save it as a draft to keep it privately.", confirmText: "Delete brand", danger: true }))) return; setBusy(true); try { await api.remove("brands", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  return <div className="be-overlay"><section className="be-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit ${row.name}` : "New brand"}><header className="be-editor-header"><div><span className="be-eyebrow">A BRAND WITH ITS OWN STORY</span><h2>{draft.name || "New brand"}</h2><p>Edit the content. Check the card. Publish when ready.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="be-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="be-editor-body"><div className="be-form" inert={busy}><label className="be-field"><span>Brand name</span><input maxLength={255} value={draft.name || ""} onChange={event => set("name", event.target.value)} /></label><div className="be-pair"><label className="be-field"><span>Category</span><input maxLength={255} value={draft.category || ""} onChange={event => set("category", event.target.value)} placeholder="e.g. Accounting SaaS" /></label><label className="be-field"><span>Website URL · optional</span><input maxLength={255} value={draft.url || ""} onChange={event => set("url", event.target.value)} placeholder="https://brand.com" /></label></div><div className="be-field"><span>Brand icon</span><div className="be-icon-picker" role="radiogroup" aria-label="Brand icon">{ICONS.map(([brand, label]) => <button key={brand} type="button" role="radio" aria-checked={draft.icon === brand} onClick={() => set("icon", brand)}><ContentIcon name={brand} /><span>{label}</span></button>)}</div></div><label className="be-field"><span>Description</span><textarea aria-label="Description" rows={6} value={draft.description || ""} onChange={event => set("description", event.target.value)} placeholder="What does this brand help people achieve?" /></label><div className="be-pair"><div className="be-field"><label htmlFor="be-status">Publication status</label><Select id="be-status" ariaLabel="Publication status" value={draft.status} onChange={brand => set("status", brand)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="be-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="brand" id={row.id} />}</div>
    <aside className="be-preview"><span className="be-eyebrow">PRIVATE CARD PREVIEW</span><p>Preview of your current edits. Changes appear on the website after saving as Published.</p><article className="be-preview-card"><span className="be-preview-icon"><ContentIcon name={draft.icon || "code"} /></span><small className="be-preview-category">{draft.category || "Brand category"}</small><h3>{draft.name || "Your next brand"}</h3><p>{draft.description || "Your brand description will appear here."}</p>{brandWebsite(draft.url) && <a href={brandWebsite(draft.url)} target="_blank" rel="noopener noreferrer">Visit website ↗</a>}</article><span className={`be-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="be-editor-footer">{row && <button type="button" className="sh-btn be-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
