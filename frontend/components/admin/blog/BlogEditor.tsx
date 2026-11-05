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
export type BlogItem = Record<string, any> & { id: number; title: string; slug: string; status: string };
const FIELDS = ["title", "category", "excerpt", "content", "coverImage", "author", "tags", "publishedAt", "status", "seoTitle", "seoDescription", "seoKeywords"];
const list = (value: any): string[] => { if (Array.isArray(value)) return value; if (!value) return []; try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch {} return String(value).split(",").map(part => part.trim()).filter(Boolean); };
const normalize = (row: Record<string, any>) => ({ ...row, tags: list(row.tags) });
const localDateTime = (value: string) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const esc = (value: any) => String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
function preview(draft: Record<string, any>) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'"><style>body{font:15px/1.9 Arial,sans-serif;color:#23375c;margin:0;padding:32px;background:#fff}small{color:#7186a9}h1{font-size:34px;line-height:1.3;letter-spacing:-1px}h2{font-size:23px}img{max-width:100%;border-radius:16px}div{overflow-wrap:anywhere}</style></head><body><small>${esc(draft.category || "Article")} · ${esc(draft.author || "Finvera")}</small><h1>${esc(draft.title || "Untitled article")}</h1><p>${esc(draft.excerpt)}</p>${draft.coverImage ? `<img src="${esc(draft.coverImage)}" alt="Article cover">` : ""}<div>${draft.content || "<p>Your article will appear here.</p>"}</div>${draft.tags?.length ? `<p><small>${draft.tags.map(esc).join(" · ")}</small></p>` : ""}</body></html>`;
}
function ImageUpload({ label, value, onChange, onBusy }: { label: string; value?: string; onChange: (value: string) => void; onBusy: (busy: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { setError("Choose a JPG, PNG or WebP under 8 MB."); return; }
    setBusy(true); onBusy(true); setError("");
    try { const result = await api.upload(file); onChange(result.url); }
    catch (e) { setError(e instanceof Error ? e.message : "Upload failed. Try again."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <section className="bl-upload"><h3>{label}</h3>{value ? <img src={value} alt={label} /> : <div className="bl-upload-empty">Your artwork goes here</div>}<div className="bl-upload-actions"><button type="button" className="sh-btn sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Uploading…" : value ? "Replace image" : "Upload image"}</button><input ref={fileRef} aria-label={`Upload ${label}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} hidden onChange={event => { upload(event.target.files?.[0]); event.target.value = ""; }} />{value && <button type="button" className="sh-btn sm" disabled={busy} onClick={() => onChange("")}>Remove image</button>}</div>{error && <p className="bl-error" role="alert">{error}</p>}</section>;
}
export default function BlogEditor({ row, onClose, onSaved, onPatched, onDeleted }: { row: BlogItem | null; onClose: () => void; onSaved: (row: BlogItem) => void; onPatched: (row: BlogItem) => void; onDeleted: (id: number) => void }) {
  const editorRef = useRef<HTMLElement>(null);
  const [base, setBase] = useState<Record<string, any>>(() => normalize(row || { title: "", status: "draft", author: "Finvera", tags: [], content: "" }));
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
    if (dirty && !(await dialog.confirm({ title: "Discard your changes?", message: "Your article changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return;
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
    if (!String(draft.title || "").trim()) { setShowPreview(false); setTab("details"); setError("Add the article title."); return; }
    setSaving(true); setError(""); setConflict(false);
    try {
      const body = Object.fromEntries((row ? dirtyKeys : FIELDS.filter(key => draft[key] !== undefined)).map(key => [key, typeof draft[key] === "string" ? draft[key].trim() || null : draft[key]]));
      const saved = row ? await api.update("blog", row.id, { ...body, expected: base }) : await api.create("blog", body);
      toast(saved.status === "published" ? "Article published" : "Draft saved", "ok", { description: saved.title }); onSaved(saved);
    } catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save the article."); }
    finally { setSaving(false); }
  }
  async function reload() {
    if (!row || !(await dialog.confirm({ title: "Reload the saved version?", message: "This replaces your unsaved edits with the latest saved article.", confirmText: "Reload", cancelText: "Keep editing" }))) return;
    try { const saved = await api.get("blog", row.id); const normalized = normalize(saved); setBase(normalized); setDraft(normalized); onPatched(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); }
  }
  async function remove() {
    if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.title}?`, message: "This removes the article from the website. You can save it as a draft to keep it privately.", confirmText: "Delete article", danger: true }))) return;
    setSaving(true);
    try { await api.remove("blog", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setSaving(false); }
  }
  const text = (key: string, label: string, multiline = false) => <label className="bl-field" key={key}><span>{label}</span>{multiline ? <textarea rows={3} value={draft[key] || ""} disabled={saving} onChange={event => set(key, event.target.value)} /> : <input value={draft[key] ?? ""} disabled={saving} onChange={event => set(key, event.target.value)} />}</label>;
  const tags = (key: string, label: string) => <div className="bl-field" key={key}><label htmlFor={`bl-${key}`}>{label}</label><TagsInput id={`bl-${key}`} value={draft[key]} onChange={value => set(key, value)} /></div>;
  return <div className="bl-overlay"><section ref={editorRef} className="bl-editor" aria-busy={saving} role="dialog" aria-modal="true" aria-label={row ? `Edit ${row.title}` : "New article"}>
    <header className="bl-editor-head"><div><span className="bl-eyebrow">IDEAS WORTH SHARING</span><h2>{draft.title || "New article"}</h2><p>{row ? "Write, refine and share your perspective." : "Start with a draft. Publish when you’re ready."}</p></div><div className="bl-editor-head-actions"><button type="button" className="sh-btn sm" disabled={busy} aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Back to editor" : "Preview"}</button><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></div></header>
    <div className="bl-tabs" role="tablist" aria-label="Article sections">{[["details", "Article"], ["media", "Cover"], ["publish", "Publishing"], ["seo", "SEO"]].map(([key, label]) => <button type="button" role="tab" disabled={busy} aria-selected={!showPreview && tab === key} key={key} onClick={() => { setTab(key); setShowPreview(false); }}>{label}</button>)}</div>
    {error && <div className="bl-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="bl-editor-body"><main className="bl-edit-fields" inert={saving}>
      {showPreview ? <><p className="bl-preview-note">Private preview of your current edits. Previewing does not publish or save changes.</p><iframe title="Article preview" sandbox="" srcDoc={preview(draft)} className="bl-preview-frame" /></> : <>
      {tab === "details" && <div className="bl-form">{text("title", "Article title")}<div className="bl-pair">{text("category", "Category")}{text("author", "Author")}</div>{text("excerpt", "Excerpt", true)}<section className="bl-rich"><h3>Article content</h3><RichText value={draft.content || ""} onChange={value => set("content", value)} onUploadBusy={on => setUploads(count => count + (on ? 1 : -1))} /></section>{tags("tags", "Tags")}</div>}
      {tab === "media" && <div className="bl-form"><p className="bl-help">The cover appears on Blog cards and at the start of the article. JPG, PNG or WebP · up to 8 MB.</p><ImageUpload label="Cover image" value={draft.coverImage} onChange={value => set("coverImage", value)} onBusy={on => setUploads(count => count + (on ? 1 : -1))} /></div>}
      {tab === "publish" && <div className="bl-form"><div className="bl-field"><label htmlFor="bl-status">Publication status</label><Select id="bl-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><label className="bl-field"><span>Article date</span><input type="datetime-local" value={draft.publishedAt ? localDateTime(draft.publishedAt) : ""} onChange={event => set("publishedAt", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label><p className="bl-help">This date labels the article; it does not schedule publishing. Saving as Published makes it live immediately. If left blank, the first publication date is set automatically.</p>{row && <HistoryList entity="blog" id={row.id} />}</div>}
      {tab === "seo" && <div className="bl-form"><p className="bl-help">Leave these blank to use the article title and excerpt.</p>{text("seoTitle", "SEO title")}{text("seoDescription", "SEO description", true)}{text("seoKeywords", "SEO keywords")}</div>}
      </>}
    </main><aside className="bl-editor-context"><span className="bl-eyebrow">PUBLICATION</span><span className={`bl-status ${draft.status}`}>{draft.status === "published" ? "Published" : "Draft"}</span><p>{draft.status === "published" ? "Saving makes these changes visible on the website." : "This article stays private when saved."}</p>{!draft.coverImage && <p className="bl-advice">Add a cover to give your article a strong first impression.</p>}{row && <><span className="bl-eyebrow">SAVED WEBSITE URL</span><p className="bl-url">/blog/{base.slug}</p>{base.status === "published" && <a className="sh-btn sm" href={`/blog/${encodeURIComponent(base.slug)}`} target="_blank" rel="noopener noreferrer">Open published page ↗</a>}</>}</aside></div>
    <footer className="bl-editor-foot">{row && <button type="button" className="sh-btn bl-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{uploads ? "Uploading images…" : dirty ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirty)} onClick={save}>{saving ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
