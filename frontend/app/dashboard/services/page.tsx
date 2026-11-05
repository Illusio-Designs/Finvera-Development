"use client";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon, Refresh01Icon, ArrowUp01Icon, ArrowDown01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";
import ServiceIcon from "@/components/serviceIcons";
import HistoryList from "@/components/admin/HistoryList";
import "./services-workspace.css";
type Service = { id: number; title: string; slug: string; icon: string; description: string | null; position: number; status: string; createdAt?: string };
const ICONS = [["saas", "Product / SaaS"], ["crm", "CRM"], ["cloud", "Cloud"], ["api", "API"], ["design", "Design"], ["ai", "AI"]];
const FIELDS = ["title", "icon", "description", "position", "status"] as const;
const sorted = (rows: Service[]) => [...rows].sort((a, b) => a.position - b.position || String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || b.id - a.id);
export default function AdminServices() {
  const [rows, setRows] = useState<Service[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: Service | null; key: number } | null>(null), [ordering, setOrdering] = useState(false);
  const orderPending = useRef(false);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("services"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load services."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const filtered = !!(query.trim() || status);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.title, row.description, row.icon].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: Service) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  async function move(index: number, direction: number) {
    if (!rows || filtered || orderPending.current || !rows[index + direction]) return;
    orderPending.current = true; setOrdering(true); setError("");
    const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    try {
      const result = await api.reorderServices(next.map(row => row.id), rows);
      setRows(result.items); toast("Website order saved", "ok");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the order."); }
    finally { orderPending.current = false; setOrdering(false); }
  }
  return <div className="services-workspace"><header className="sv-header"><div><span className="sv-eyebrow">MAKE YOUR EXPERTISE CLEAR</span><h1>Services</h1><p>Keep your service offering clear and current.</p></div><div className="sv-header-actions"><a className="sh-btn" href="/services" target="_blank" rel="noopener noreferrer">Open Services page <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" disabled={ordering} onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New service</button></div></header>
    <div className="sv-toolbar"><div className="sv-tabs" role="tablist" aria-label="Service status">{[["", "All services"], ["published", "Published"], ["draft", "Drafts"]].map(([value, label]) => <button type="button" role="tab" aria-selected={status === value} key={value} onClick={() => setStatus(value)}>{label}{rows && <small>{rows.filter(row => !value || row.status === value).length}</small>}</button>)}</div><label className="sv-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search services" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a service…" /></label><button type="button" className="sh-icb" aria-label="Refresh services" disabled={busy || ordering} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="sv-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy || ordering} onClick={load}>Try again</button></div>}
    <div className="sv-list-caption"><span>{rows ? `${shown.length} services` : busy ? "Loading services…" : "Services unavailable"}</span><span>{filtered ? "Clear filters to change the website order." : ordering ? "Saving website order…" : "Use the arrows to arrange services on the website."}</span></div>
    <div className="sv-list">{shown.map((row, index) => <article className="sv-row" key={row.id}><span className="sv-number">{String(index + 1).padStart(2, "0")}</span><span className={`sv-icon ${row.icon}`}><ServiceIcon name={row.icon} /></span><button type="button" className="sv-title" disabled={ordering} onClick={() => setEditing({ row, key: Date.now() })}><b>{row.title}</b><small>{ICONS.find(([value]) => value === row.icon)?.[1] || "Service"}</small></button><span className={`sv-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="sv-order"><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} up`} disabled={filtered || ordering || busy || index === 0} onClick={() => move(index, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={15} /></button><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} down`} disabled={filtered || ordering || busy || index === shown.length - 1} onClick={() => move(index, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={15} /></button></div><button type="button" className="sh-btn sm sv-edit" disabled={ordering} aria-label={`Edit ${row.title}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></button></article>)}</div>
    {rows && !shown.length && !error && <div className="sv-empty"><h2>{rows.length ? "No services match" : "What can you help clients achieve?"}</h2><p>{rows.length ? "Try another search or status." : "Start with a draft and shape your next service."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New service"}</button></div>}
    <p className="sv-note">Descriptions stay inside the editor. Published services appear on Home and Services; drafts remain private.</p>
    {editing && <ServiceEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function ServiceEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: Service | null; nextPosition: number; onClose: () => void; onSaved: (row: Service) => void; onPatch: (row: Service) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<Service>>(row || { title: "", description: "", icon: "saas", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base), [busy, setBusy] = useState(false), [error, setError] = useState(""), [conflict, setConflict] = useState(false);
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof Service, value: any) => { if (!busy) setDraft(current => ({ ...current, [field]: value })); };
  async function close() { if (busy) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your service changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function save() {
    if (busy) return;
    if (!draft.title?.trim()) { setError("Add the service title."); return; }
    setBusy(true); setError(""); setConflict(false);
    const fields = row ? dirtyKeys : FIELDS;
    const body = Object.fromEntries(fields.map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("services", row.id, { ...body, expected: base }) : await api.create("services", body); toast(saved.status === "published" ? "Service published" : "Draft saved", "ok", { description: saved.title }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this service."); }
    finally { setBusy(false); }
  }
  async function reload() { if (!row || !(await dialog.confirm({ title: "Reload this service?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("services", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.title}?`, message: "This removes the service from your website. Save it as a draft to keep it privately.", confirmText: "Delete service", danger: true }))) return; setBusy(true); try { await api.remove("services", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  return <div className="sv-overlay"><section className="sv-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit ${row.title}` : "New service"}><header className="sv-editor-header"><div><span className="sv-eyebrow">A CLEAR OFFERING</span><h2>{draft.title || "New service"}</h2><p>Edit the content. Check the card. Publish when ready.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="sv-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="sv-editor-body"><div className="sv-form" inert={busy}><label className="sv-field"><span>Service title</span><input value={draft.title || ""} onChange={event => set("title", event.target.value)} /></label><div className="sv-field"><span>Service icon</span><div className="sv-icon-picker" role="radiogroup" aria-label="Service icon">{ICONS.map(([value, label]) => <button key={value} type="button" role="radio" aria-checked={draft.icon === value} onClick={() => set("icon", value)}><ServiceIcon name={value} /><span>{label}</span></button>)}</div></div><label className="sv-field"><span>Description</span><textarea aria-label="Description" rows={6} value={draft.description || ""} onChange={event => set("description", event.target.value)} placeholder="What does this service help your clients achieve?" /></label><div className="sv-pair"><div className="sv-field"><label htmlFor="sv-status">Publication status</label><Select id="sv-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="sv-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="service" id={row.id} />}</div>
    <aside className="sv-preview"><span className="sv-eyebrow">PRIVATE CARD PREVIEW</span><p>Preview of your current edits. Changes appear on the website after saving as Published.</p><article className="sv-preview-card"><span className="sv-preview-icon"><ServiceIcon name={draft.icon || "saas"} /></span><h3>{draft.title || "Your next service"}</h3><p>{draft.description || "Your service description will appear here."}</p><span>Get a quote ↗</span></article><span className={`sv-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="sv-editor-footer">{row && <button type="button" className="sh-btn sv-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
