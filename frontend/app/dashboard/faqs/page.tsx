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
import HistoryList from "@/components/admin/HistoryList";
import "./faqs-workspace.css";
type Faq = { id: number; question: string; answer: string | null; position: number; status: string; createdAt?: string };
const FIELDS = ["question", "answer", "position", "status"] as const;
const sorted = (rows: Faq[]) => [...rows].sort((a, b) => a.position - b.position || String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || a.id - b.id);
export default function AdminFaqs() {
  const [rows, setRows] = useState<Faq[] | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: Faq | null; key: number } | null>(null), [ordering, setOrdering] = useState(false);
  const orderPending = useRef(false);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("faqs"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load faqs."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const filtered = !!(query.trim() || status);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.question, row.answer].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: Faq) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  async function move(index: number, direction: number) {
    if (!rows || filtered || orderPending.current || !rows[index + direction]) return;
    orderPending.current = true; setOrdering(true); setError("");
    const next = [...rows]; [next[index], next[index + direction]] = [next[index + direction], next[index]];
    try {
      const result = await api.reorderFaqs(next.map(row => row.id), rows);
      setRows(result.items); toast("Website order saved", "ok");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save the order."); }
    finally { orderPending.current = false; setOrdering(false); }
  }
  return <div className="faqs-workspace"><header className="fq-header"><div><span className="fq-eyebrow">CLEAR ANSWERS. CONFIDENT CLIENTS.</span><h1>FAQs</h1><p>Help visitors find the answers they need before they get in touch.</p></div><div className="fq-header-actions"><a className="sh-btn" href="/#faq" target="_blank" rel="noopener noreferrer">Open Home FAQs <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" disabled={ordering} onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New question</button></div></header>
    {!rows && busy && !error ? <PageLoading label="Loading FAQs…" variant="list" /> : <>
    <div className="fq-toolbar"><div className="fq-tabs" role="tablist" aria-label="FAQ status">{[["", "All questions"], ["published", "Published"], ["draft", "Drafts"]].map(([value, label]) => <button type="button" role="tab" aria-selected={status === value} key={value} onClick={() => setStatus(value)}>{label}{rows && <small>{rows.filter(row => !value || row.status === value).length}</small>}</button>)}</div><label className="fq-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search FAQs" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a question or answer…" /></label><button type="button" className="sh-icb" aria-label="Refresh FAQs" disabled={busy || ordering} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="fq-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy || ordering} onClick={load}>Try again</button></div>}
    <div className="fq-list-caption"><span>{rows ? `${shown.length} FAQs` : busy ? "Loading FAQs…" : "FAQs unavailable"}</span><span>{filtered ? "Clear filters to change the website order." : ordering ? "Saving website order…" : "Use the arrows to arrange FAQs on the website."}</span></div>
    <div className="fq-list">{shown.map((row, index) => <article className="fq-row" key={row.id}><span className="fq-number">{String(index + 1).padStart(2, "0")}</span><button type="button" className="fq-question" disabled={ordering} onClick={() => setEditing({ row, key: Date.now() })}><b>{row.question}</b><small>{row.answer || "Answer to be added"}</small></button><span className={`fq-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="fq-order"><button type="button" className="sh-icb sm" aria-label={`Move ${row.question} up`} disabled={filtered || ordering || busy || index === 0} onClick={() => move(index, -1)}><HugeiconsIcon icon={ArrowUp01Icon} size={15} /></button><button type="button" className="sh-icb sm" aria-label={`Move ${row.question} down`} disabled={filtered || ordering || busy || index === shown.length - 1} onClick={() => move(index, 1)}><HugeiconsIcon icon={ArrowDown01Icon} size={15} /></button></div><button type="button" className="sh-btn sm fq-edit" disabled={ordering} aria-label={`Edit ${row.question}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></button></article>)}</div>
    {rows && !shown.length && !error && <div className="fq-empty"><h2>{rows.length ? "No FAQs match" : "Start with the questions clients ask most"}</h2><p>{rows.length ? "Try another search or status." : "Draft a clear answer, preview it and publish when ready."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New question"}</button></div>}
    <p className="fq-note">Published FAQs appear on Home in this order. Draft questions stay private.</p>
    </>}
    {editing && <FaqEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function FaqEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: Faq | null; nextPosition: number; onClose: () => void; onSaved: (row: Faq) => void; onPatch: (row: Faq) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<Faq>>(row || { question: "", answer: "", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base);
  const { saving: busy, setSaving: setBusy, error, setError, conflict, setConflict } = useSaveWorkflow();
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof Faq, value: any) => { if (!busy) setDraft(current => ({ ...current, [field]: value })); };
  async function close() { if (busy) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your FAQ changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function save() {
    if (busy) return;
    if (!draft.question?.trim()) { setError("Add the FAQ question."); return; }
    if (draft.status === "published" && !draft.answer?.trim()) { setError("Add an answer before publishing."); return; }
    setBusy(true); setError(""); setConflict(false);
    const fields = row ? dirtyKeys : FIELDS;
    const body = Object.fromEntries(fields.map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("faqs", row.id, { ...body, expected: base }) : await api.create("faqs", body); toast(saved.status === "published" ? "FAQ published" : "Draft saved", "ok", { description: saved.question }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this FAQ."); }
    finally { setBusy(false); }
  }
  async function reload() { if (!row || !(await dialog.confirm({ title: "Reload this FAQ?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("faqs", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.question}?`, message: "This removes the FAQ from your website. Save it as a draft to keep it privately.", confirmText: "Delete FAQ", danger: true }))) return; setBusy(true); try { await api.remove("faqs", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  return <div className="fq-overlay"><section className="fq-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit ${row.question}` : "New question"}><header className="fq-editor-header"><div><span className="fq-eyebrow">A QUESTION WORTH ANSWERING</span><h2>{draft.question || "New question"}</h2><p>Write a clear answer. Preview it before publishing.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="fq-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="fq-editor-body"><div className="fq-form" inert={busy}><label className="fq-field"><span>Question</span><input maxLength={255} value={draft.question || ""} onChange={event => set("question", event.target.value)} /></label><label className="fq-field"><span>Answer</span><textarea aria-label="Answer" rows={6} value={draft.answer || ""} onChange={event => set("answer", event.target.value)} placeholder="Give visitors a direct, useful answer…" /></label><div className="fq-pair"><div className="fq-field"><label htmlFor="fq-status">Publication status</label><Select id="fq-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="fq-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="faq" id={row.id} />}</div>
    <aside className="fq-preview"><span className="fq-eyebrow">PRIVATE ANSWER PREVIEW</span><p>Your current edits, shown as an FAQ. Previewing does not save or publish.</p><details className="fq-preview-card" open><summary>{draft.question || "Your question goes here"}</summary><p>{draft.answer || "Your answer will appear here."}</p></details><span className={`fq-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="fq-editor-footer">{row && <button type="button" className="sh-btn fq-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
