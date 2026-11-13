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
import HistoryList from "@/components/admin/HistoryList";
import "./timeline-workspace.css";
type Milestone = { id: number; title: string; year: string | null; description: string | null; position: number; status: string; createdAt?: string };
const FIELDS = ["title", "year", "description", "position", "status"] as const;
const sorted = (rows: Milestone[]) => [...rows].sort((a, b) => a.position - b.position || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id - b.id);
export default function AdminMilestones() {
  const { data: rows, setData: setRows, loading: busy, setLoading: setBusy, error, setError } = useResourceState<Milestone[] | null>(null, true);
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: Milestone | null; key: number } | null>(null), [ordering, setOrdering] = useState(false);
  const orderPending = useRef(false);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("milestones"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load milestones."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const filtered = !!(query.trim() || status);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.title, row.description, row.year].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: Milestone) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  async function move(index: number, direction: number) {
    if (!rows || filtered || orderPending.current || !rows[index + direction]) return;
    orderPending.current = true; setOrdering(true); setError("");
    const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    try {
      const result = await api.reorderMilestones(next.map(row => row.id), rows);
      setRows(result.items); toast("Website order saved", "ok");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the order."); }
    finally { orderPending.current = false; setOrdering(false); }
  }
  return <div className="milestones-workspace"><header className="tlw-header"><div><span className="tlw-eyebrow">THE MOMENTS THAT MOVED YOU FORWARD</span><h1>Company timeline</h1><p>Tell your company’s story, one milestone at a time.</p></div><div className="tlw-header-actions"><a className="sh-btn" href="/about" target="_blank" rel="noopener noreferrer">Open About page <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" disabled={ordering} onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New milestone</button></div></header>
    {!rows && busy && !error ? <PageLoading label="Loading milestones…" variant="list" /> : <>
    <div className="tlw-toolbar"><div className="tlw-tabs" role="tablist" aria-label="Milestone status">{[["", "All milestones"], ["published", "Published"], ["draft", "Drafts"]].map(([milestone, label]) => <button type="button" role="tab" aria-selected={status === milestone} key={milestone} onClick={() => setStatus(milestone)}>{label}{rows && <small>{rows.filter(row => !milestone || row.status === milestone).length}</small>}</button>)}</div><label className="tlw-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search milestones" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a milestone…" /></label><button type="button" className="sh-icb" aria-label="Refresh milestones" disabled={busy || ordering} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="tlw-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy || ordering} onClick={load}>Try again</button></div>}
    <div className="tlw-list-caption"><span>{rows ? `${shown.length} milestones` : busy ? "Loading milestones…" : "Milestones unavailable"}</span><span>{filtered ? "Clear filters to change the website order." : ordering ? "Saving website order…" : "Use the arrows to arrange milestones on the website."}</span></div>
    <div className="tlw-list">{shown.map((row, index) => <article className="tlw-row" key={row.id}><span className="tlw-number">{String(index + 1).padStart(2, "0")}</span><span className="tlw-year">{row.year || "—"}</span><button type="button" className="tlw-title" disabled={ordering} onClick={() => setEditing({ row, key: Date.now() })}><b>{row.title}</b><small>{row.description || "Description to be added"}</small></button><span className={`tlw-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="tlw-order"><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} up`} disabled={filtered || ordering || busy || index === 0} onClick={() => move(index, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={15} /></button><button type="button" className="sh-icb sm" aria-label={`Move ${row.title} down`} disabled={filtered || ordering || busy || index === shown.length - 1} onClick={() => move(index, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={15} /></button></div><button type="button" className="sh-btn sm tlw-edit" disabled={ordering} aria-label={`Edit ${row.title}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></button></article>)}</div>
    {rows && !shown.length && !error && <div className="tlw-empty"><h2>{rows.length ? "No milestones match" : "Where did your journey begin?"}</h2><p>{rows.length ? "Try another search or status." : "Start with a draft and shape your next milestone."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New milestone"}</button></div>}
    <p className="tlw-note">Published milestones appear on About in this order. Drafts stay private.</p>
    </>}
    {editing && <MilestoneEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function MilestoneEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: Milestone | null; nextPosition: number; onClose: () => void; onSaved: (row: Milestone) => void; onPatch: (row: Milestone) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<Milestone>>(row || { title: "", description: "", year: "", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base);
  const { saving: busy, setSaving: setBusy, error, setError, conflict, setConflict } = useSaveWorkflow();
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof Milestone, milestone: any) => { if (!busy) setDraft(current => ({ ...current, [field]: milestone })); };
  async function close() { if (busy) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your milestone changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function save() {
    if (busy) return;
    if (!draft.title?.trim()) { setError("Add the milestone title."); return; }
    if (draft.status === "published" && !draft.description?.trim()) { setError("Add a description before publishing."); return; }
    setBusy(true); setError(""); setConflict(false);
    const fields = row ? dirtyKeys : FIELDS;
    const body = Object.fromEntries(fields.map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("milestones", row.id, { ...body, expected: base }) : await api.create("milestones", body); toast(saved.status === "published" ? "Milestone published" : "Draft saved", "ok", { description: saved.title }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this milestone."); }
    finally { setBusy(false); }
  }
  async function reload() { if (!row || !(await dialog.confirm({ title: "Reload this milestone?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("milestones", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.title}?`, message: "This removes the milestone from your website. Save it as a draft to keep it privately.", confirmText: "Delete milestone", danger: true }))) return; setBusy(true); try { await api.remove("milestones", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  return <div className="tlw-overlay"><section className="tlw-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit ${row.title}` : "New milestone"}><header className="tlw-editor-header"><div><span className="tlw-eyebrow">A MOMENT WORTH REMEMBERING</span><h2>{draft.title || "New milestone"}</h2><p>Edit the content. Check the card. Publish when ready.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="tlw-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="tlw-editor-body"><div className="tlw-form" inert={busy}><label className="tlw-field"><span>Milestone title</span><input maxLength={255} value={draft.title || ""} onChange={event => set("title", event.target.value)} /></label><label className="tlw-field"><span>Year or period</span><input maxLength={255} value={draft.year || ""} onChange={event => set("year", event.target.value)} placeholder="e.g. 2024 or Today" /></label><label className="tlw-field"><span>Description</span><textarea aria-label="Description" rows={6} value={draft.description || ""} onChange={event => set("description", event.target.value)} placeholder="What happened, and why did it matter?" /></label><div className="tlw-pair"><div className="tlw-field"><label htmlFor="tlw-status">Publication status</label><Select id="tlw-status" ariaLabel="Publication status" value={draft.status} onChange={milestone => set("status", milestone)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="tlw-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="milestone" id={row.id} />}</div>
    <aside className="tlw-preview"><span className="tlw-eyebrow">PRIVATE CARD PREVIEW</span><p>Preview of your current edits. Changes appear on the website after saving as Published.</p><article className="tlw-preview-card"><span className="tlw-preview-year">{draft.year || "Year / period"}</span><h3>{draft.title || "Your next milestone"}</h3><p>{draft.description || "Your milestone description will appear here."}</p></article><span className={`tlw-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="tlw-editor-footer">{row && <button type="button" className="sh-btn tlw-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
