"use client";
import { useSaveWorkflow } from "@/lib/useSaveWorkflow";
import PageLoading from "@/components/admin/PageLoading";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon, Refresh01Icon, ArrowUp01Icon, ArrowDown01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";
import LogoMark from "@/components/LogoMark";
import HistoryList from "@/components/admin/HistoryList";
import "./logos-workspace.css";
type ClientLogo = { id: number; name: string; image: string | null; position: number; status: string; createdAt?: string };
const FIELDS = ["name", "image", "position", "status"] as const;
const sorted = (rows: ClientLogo[]) => [...rows].sort((a, b) => a.position - b.position || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id - b.id);
export default function AdminLogos() {
  const [rows, setRows] = useState<ClientLogo[] | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: ClientLogo | null; key: number } | null>(null), [ordering, setOrdering] = useState(false);
  const orderPending = useRef(false);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("logos"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load client logos."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const filtered = !!(query.trim() || status);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.image, row.name].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: ClientLogo) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  async function move(index: number, direction: number) {
    if (!rows || filtered || orderPending.current || !rows[index + direction]) return;
    orderPending.current = true; setOrdering(true); setError("");
    const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    try {
      const result = await api.reorderLogos(next.map(row => row.id), rows);
      setRows(result.items); toast("Website order saved", "ok");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the order."); }
    finally { orderPending.current = false; setOrdering(false); }
  }
  return <div className="logos-workspace"><header className="cl-header"><div><span className="cl-eyebrow">THE COMPANIES IN YOUR STORY</span><h1>Client logos</h1><p>Give the companies you work with a place on your website.</p></div><div className="cl-header-actions"><a className="sh-btn" href="/about#clients" target="_blank" rel="noopener noreferrer">Open About page <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" disabled={ordering} onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New logo</button></div></header>
    {!rows && busy && !error ? <PageLoading label="Loading client logos…" variant="list" /> : <>
    <div className="cl-toolbar"><div className="cl-tabs" role="tablist" aria-label="Logo status">{[["", "All logos"], ["published", "Published"], ["draft", "Drafts"]].map(([value, label]) => <button type="button" role="tab" aria-selected={status === value} key={value} onClick={() => setStatus(value)}>{label}{rows && <small>{rows.filter(row => !value || row.status === value).length}</small>}</button>)}</div><label className="cl-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search logos" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a company…" /></label><button type="button" className="sh-icb" aria-label="Refresh logos" disabled={busy || ordering} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="cl-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy || ordering} onClick={load}>Try again</button></div>}
    <div className="cl-list-caption"><span>{rows ? `${shown.length} logos` : busy ? "Loading client logos…" : "Logos unavailable"}</span><span>{filtered ? "Clear filters to change the website order." : ordering ? "Saving website order…" : "Use the arrows to arrange logos on the website."}</span></div>
    <div className="cl-list">{shown.map((row, index) => <article className="cl-row" key={row.id}><span className="cl-mark"><LogoMark name={row.name} image={row.image || undefined} /></span><button type="button" className="cl-title" disabled={ordering} onClick={() => setEditing({ row, key: Date.now() })}><b>{row.name || "Company name"}</b><small>Home · About</small></button><span className={`cl-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="cl-order"><button type="button" className="sh-icb sm" aria-label={`Move ${row.name || row.image} up`} disabled={filtered || ordering || busy || index === 0} onClick={() => move(index, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={15} /></button><button type="button" className="sh-icb sm" aria-label={`Move ${row.name || row.image} down`} disabled={filtered || ordering || busy || index === shown.length - 1} onClick={() => move(index, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={15} /></button></div><button type="button" className="sh-btn sm cl-edit" disabled={ordering} aria-label={`Edit ${row.name || row.image}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></button></article>)}</div>
    {rows && !shown.length && !error && <div className="cl-empty"><h2>{rows.length ? "No logos match" : "Who have you worked with?"}</h2><p>{rows.length ? "Try another search or status." : "Add a company name and upload its logo. Start privately as a draft."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New logo"}</button></div>}
    <p className="cl-note">Published logos appear on Home and About in this order. Drafts stay private.</p>
    </>}
    {editing && <LogoEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function LogoEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: ClientLogo | null; nextPosition: number; onClose: () => void; onSaved: (row: ClientLogo) => void; onPatch: (row: ClientLogo) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<ClientLogo>>(row || { name: "", image: "", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base);
  const { saving: busy, setSaving: setBusy, error, setError, conflict, setConflict } = useSaveWorkflow();
  const fileRef = useRef<HTMLInputElement>(null), uploadPending = useRef(false);
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof ClientLogo, value: any) => { if (!busy) setDraft(current => ({ ...current, [field]: value })); };
  async function close() { if (busy || uploadPending.current) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your logo changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function upload(file?: File) {
    if (!file || busy || uploadPending.current) return;
    if (!['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) { setError("Choose an SVG, PNG, JPG, WebP, GIF or AVIF logo."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Choose a logo smaller than 8 MB."); return; }
    uploadPending.current = true; setBusy(true); setError("");
    try { const result = await api.upload(file); setDraft(current => ({ ...current, image: result.url })); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t upload this logo."); }
    finally { uploadPending.current = false; setBusy(false); }
  }
  async function save() {
    if (busy || uploadPending.current) return;
    if (!draft.name?.trim()) { setError("Add the company name."); return; }
    setBusy(true); setError(""); setConflict(false);
    const fields = row ? dirtyKeys : FIELDS;
    const body = Object.fromEntries(fields.map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("logos", row.id, { ...body, expected: base }) : await api.create("logos", body); toast(saved.status === "published" ? "Logo published" : "Draft saved", "ok", { description: saved.name || saved.image }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this logo."); }
    finally { setBusy(false); }
  }
  async function reload() { if (busy || uploadPending.current || !row || !(await dialog.confirm({ title: "Reload this logo?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("logos", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.name || row.image}?`, message: "This removes the logo from your website. Save it as a draft to keep it privately.", confirmText: "Delete logo", danger: true }))) return; setBusy(true); try { await api.remove("logos", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  return <div className="cl-overlay"><section className="cl-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit ${row.name || row.image}` : "New logo"}><header className="cl-editor-header"><div><span className="cl-eyebrow">A COMPANY WORTH RECOGNIZING</span><h2>{draft.name || "New logo"}</h2><p>Edit the content. Check the card. Publish when ready.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="cl-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="cl-editor-body"><div className="cl-form" inert={busy}><label className="cl-field"><span>Company name</span><input maxLength={255} value={draft.name || ""} onChange={event => set("name", event.target.value)} placeholder="The company or partner name" /></label><div className="cl-field"><span>Logo image</span><div className="cl-upload" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); upload(event.dataTransfer.files?.[0]); }}><span className="cl-upload-preview"><LogoMark name={draft.name || "Company name"} image={draft.image || undefined} /></span><button type="button" className="sh-btn" onClick={() => fileRef.current?.click()}>{draft.image ? "Replace logo" : "Upload logo"}</button>{draft.image && <button type="button" className="sh-btn" onClick={() => set("image", null)}>Remove image</button>}<input ref={fileRef} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp,image/gif,image/avif" aria-label="Choose logo image" hidden onChange={event => { upload(event.target.files?.[0]); event.target.value = ""; }} /></div><small>Drop a logo here or choose a file. SVG or transparent PNG works best · up to 8 MB. Without an image, the company name appears.</small></div><div className="cl-pair"><div className="cl-field"><label htmlFor="cl-status">Publication status</label><Select id="cl-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="cl-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="logo" id={row.id} />}</div>
    <aside className="cl-preview"><span className="cl-eyebrow">PRIVATE LOGO PREVIEW</span><p>Check how this logo sits on the website. Uploading alone does not publish your changes.</p><article className="cl-preview-card"><div className="cl-preview-logo"><LogoMark name={draft.name || "Company name"} image={draft.image || undefined} /></div><p>{draft.name || "Company name"}</p></article><span className={`cl-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="cl-editor-footer">{row && <button type="button" className="sh-btn cl-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? uploadPending.current ? "Uploading logo…" : "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
