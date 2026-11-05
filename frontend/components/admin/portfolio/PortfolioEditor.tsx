"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import Select from "@/components/Select";
import TagsInput from "@/components/ui/TagsInput";
import HistoryList from "@/components/admin/HistoryList";
const RichText = dynamic(() => import("@/components/admin/RichText"), { ssr: false, loading: () => <p role="status">Loading editor…</p> });
export type PortfolioItem = Record<string, any> & { id: number; title: string; slug: string; status: string };
const FIELDS = ["title", "category", "client", "url", "blurb", "industry", "year", "duration", "role", "challenge", "approach", "content", "results", "tech", "tags", "testimonialQuote", "testimonialName", "testimonialRole", "desktopImage", "mobileImage", "coverImage", "featured", "position", "status", "seoTitle", "seoDescription"];
const list = (value: any) => { if (Array.isArray(value)) return value; if (!value) return []; try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {} return String(value).split(",").map(part => part.trim()).filter(Boolean); };
const normalize = (row: Record<string, any>) => ({ ...row, tags: list(row.tags), results: list(row.results), tech: list(row.tech), gallery: list(row.gallery) });
const esc = (value: any) => String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
function preview(draft: Record<string, any>) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'"><style>body{font:15px/1.8 Arial,sans-serif;color:#23375c;margin:0;padding:32px;background:#fff}small{color:#7186a9}h1{font-size:34px;line-height:1.3;letter-spacing:-1px}h2{font-size:21px;margin-top:34px}img{max-width:100%;border-radius:16px}blockquote{background:#f0f4fd;border-radius:15px;padding:22px;margin:30px 0}div{overflow-wrap:anywhere}</style></head><body><small>${esc(draft.category)} · ${esc(draft.client || draft.title)}</small><h1>${esc(draft.title || "Untitled case study")}</h1><p>${esc(draft.blurb)}</p>${draft.coverImage || draft.desktopImage ? `<img src="${esc(draft.coverImage || draft.desktopImage)}" alt="Case study artwork">` : ""}${["challenge", "approach", "content"].map((field, i) => draft[field] ? `<h2>${["The challenge", "Our approach", "The story"][i]}</h2><div>${draft[field]}</div>` : "").join("")}${draft.results?.length ? `<h2>Results</h2><p>${draft.results.map(esc).join(" · ")}</p>` : ""}${draft.testimonialQuote ? `<blockquote>${esc(draft.testimonialQuote)}<br><small>${esc(draft.testimonialName)} · ${esc(draft.testimonialRole)}</small></blockquote>` : ""}</body></html>`;
}
function ImageUpload({ label, value, onChange, onBusy }: { label: string; value?: string; onChange: (value: string) => void; onBusy: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    setBusy(true); onBusy(true); setError("");
    try { const result = await api.upload(file); onChange(result.url); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Try again."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <section className="pf-upload"><h3>{label}</h3>{value ? <img src={value} alt={label} /> : <div className="pf-upload-empty">Your artwork goes here</div>}<div className="pf-upload-actions"><label className="sh-btn sm">{busy ? "Uploading…" : value ? "Replace image" : "Upload image"}<input aria-label={`Upload ${label}`} type="file" accept="image/*" disabled={busy} hidden onChange={event => { upload(event.target.files?.[0]); event.target.value = ""; }} /></label>{value && <button type="button" className="sh-btn sm" disabled={busy} onClick={() => onChange("")}>Remove image</button>}</div>{error && <p className="pf-error" role="alert">{error}</p>}</section>;
}
export default function PortfolioEditor({ row, onClose, onSaved, onPatched, onDeleted }: { row: PortfolioItem | null; onClose: () => void; onSaved: (row: PortfolioItem) => void; onPatched: (row: PortfolioItem) => void; onDeleted: (id: number) => void }) {
  const editorRef = useRef<HTMLElement>(null);
  const [base, setBase] = useState<Record<string, any>>(() => normalize(row || { title: "", status: "draft", featured: false, position: 0 }));
  const [draft, setDraft] = useState<Record<string, any>>(base);
  const [tab, setTab] = useState("details"), [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false), [uploads, setUploads] = useState(0), [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const dirtyKeys = FIELDS.filter(key => JSON.stringify(draft[key] ?? "") !== JSON.stringify(base[key] ?? ""));
  const dirty = dirtyKeys.length > 0;
  const busy = saving || uploads > 0;
  const set = (key: string, value: any) => { if (!saving) setDraft(current => ({ ...current, [key]: value })); };
  async function close() {
    if (busy) return;
    if (dirty && !(await dialog.confirm({ title: "Discard your changes?", message: "Your case study changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return;
    onClose();
  }
  useEffect(() => { const previous = document.body.style.overflow; const focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; editorRef.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (document.querySelector(".adm-overlay")) return;
      if (event.key === "Escape" && !document.querySelector(".cselect.open")) close();
      if (event.key === "Tab") {
        const focusable = Array.from(editorRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],iframe,[contenteditable=true]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]"));
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key);
  });
  async function save() {
    if (busy) return;
    if (!String(draft.title || "").trim()) { setShowPreview(false); setTab("details"); setError("Add the case study title."); return; }
    setSaving(true); setError(""); setConflict(false);
    try {
      const body = Object.fromEntries((row ? dirtyKeys : FIELDS.filter(key => draft[key] !== undefined)).map(key => [key, typeof draft[key] === "string" ? draft[key].trim() || null : draft[key]]));
      const saved = row ? await api.update("projects", row.id, { ...body, expected: base }) : await api.create("projects", body);
      toast(saved.status === "published" ? "Case study published" : "Draft saved", "ok", { description: saved.title }); onSaved(saved);
    } catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save the case study."); }
    finally { setSaving(false); }
  }
  async function reload() {
    if (!row || !(await dialog.confirm({ title: "Reload the saved version?", message: "This replaces your unsaved edits with the latest saved case study.", confirmText: "Reload", cancelText: "Keep editing" }))) return;
    try { const saved = await api.get("projects", row.id); const normalized = normalize(saved); setBase(normalized); setDraft(normalized); onPatched(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); }
  }
  async function remove() {
    if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.title}?`, message: "This removes the case study from the website. You can save it as a draft to keep it privately.", confirmText: "Delete case study", danger: true }))) return;
    setSaving(true);
    try { await api.remove("projects", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setSaving(false); }
  }
  const text = (key: string, label: string, multiline = false) => <label className="pf-field" key={key}><span>{label}</span>{multiline ? <textarea rows={3} value={draft[key] || ""} disabled={saving} onChange={event => set(key, event.target.value)} /> : <input value={draft[key] ?? ""} disabled={saving} onChange={event => set(key, event.target.value)} />}</label>;
  const tags = (key: string, label: string) => <div className="pf-field" key={key}><label htmlFor={`pf-${key}`}>{label}</label><TagsInput id={`pf-${key}`} value={draft[key]} onChange={value => set(key, value)} /></div>;
  return <div className="pf-overlay"><section ref={editorRef} className="pf-editor" aria-busy={saving} role="dialog" aria-modal="true" aria-label={row ? `Edit ${row.title}` : "New case study"}>
    <header className="pf-editor-head"><div><span className="pf-eyebrow">YOUR WORK, TOLD WELL</span><h2>{draft.title || "New case study"}</h2><p>{row ? "Edit the story behind your work." : "Start with a draft. Publish when you’re ready."}</p></div><div className="pf-editor-head-actions"><button type="button" className="sh-btn sm" aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Back to editor" : "Preview"}</button><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></div></header>
    <div className="pf-tabs" role="tablist" aria-label="Case study sections">{[["details", "Details"], ["story", "Story"], ["media", "Media"], ["publish", "Publishing"]].map(([key, label]) => <button type="button" role="tab" aria-selected={!showPreview && tab === key} key={key} onClick={() => { setTab(key); setShowPreview(false); }}>{label}</button>)}</div>
    {error && <div className="pf-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="pf-editor-body"><main className="pf-edit-fields" inert={saving}>
      {showPreview ? <><p className="pf-preview-note">Private preview of your current edits. Previewing does not publish or save changes.</p><iframe title="Case study preview" sandbox="" srcDoc={preview(draft)} className="pf-preview-frame" /></> : <>
      {tab === "details" && <div className="pf-form"><div className="pf-pair">{text("title", "Case study title")}{text("client", "Client / company")}</div><div className="pf-pair">{text("category", "Category")}{text("url", "Live website URL")}</div>{text("blurb", "Short description", true)}<div className="pf-pair">{text("industry", "Industry")}{text("year", "Year")}</div><div className="pf-pair">{text("duration", "Timeline")}{text("role", "Our role")}</div>{tags("tags", "Services & tags")}</div>}
      {tab === "story" && <div className="pf-form">{[["challenge", "The challenge"], ["approach", "Our approach"], ["content", "Case study story"]].map(([key, label]) => <section className="pf-rich" key={key}><h3>{label}</h3><RichText value={draft[key] || ""} onChange={value => set(key, value)} /></section>)}{tags("results", "Results · enter each as value — label")}{tags("tech", "Tech stack")}{text("testimonialQuote", "Client quote", true)}<div className="pf-pair">{text("testimonialName", "Quote — name")}{text("testimonialRole", "Quote — role")}</div></div>}
      {tab === "media" && <div className="pf-form"><p className="pf-help">The main image appears on Work and Home cards. The cover leads the case study and its sharing preview.</p>{[["desktopImage", "Main image"], ["coverImage", "Cover image"], ["mobileImage", "Mobile screenshot"]].map(([key, label]) => <ImageUpload key={key} label={label} value={draft[key]} onChange={value => set(key, value)} onBusy={on => setUploads(count => count + (on ? 1 : -1))} />)}</div>}
      {tab === "publish" && <div className="pf-form"><div className="pf-field"><label htmlFor="pf-status">Publication status</label><Select id="pf-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="pf-check"><input type="checkbox" checked={!!draft.featured} disabled={saving} onChange={event => set("featured", event.target.checked)} />Feature on the home page</label><label className="pf-field"><span>Display order</span><input type="number" value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value) || 0)} /></label>{text("seoTitle", "SEO title")}{text("seoDescription", "SEO description", true)}{row && <HistoryList entity="project" id={row.id} />}</div>}
      </>}
    </main><aside className="pf-editor-context"><span className="pf-eyebrow">PUBLICATION</span><span className={`pf-status ${draft.status}`}>{draft.status === "published" ? "Published" : "Draft"}</span><p>{draft.status === "published" ? "Saving makes these changes visible on the website." : "This case study stays private when saved."}</p>{!draft.desktopImage && <p className="pf-advice">Add a main image to give this work a strong first impression.</p>}{row && <><span className="pf-eyebrow">SAVED WEBSITE URL</span><p className="pf-url">/work/{base.slug}</p>{base.status === "published" && <a className="sh-btn sm" href={`/work/${encodeURIComponent(base.slug)}`} target="_blank" rel="noopener noreferrer">Open published page ↗</a>}</>}</aside></div>
    <footer className="pf-editor-foot">{row && <button type="button" className="sh-btn pf-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{uploads ? "Uploading artwork…" : dirty ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirty)} onClick={save}>{saving ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
