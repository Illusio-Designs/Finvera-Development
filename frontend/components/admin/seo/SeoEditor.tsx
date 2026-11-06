"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { seoLabel, seoPresentation, siteUrl, type SeoValues } from "@/lib/seoMetadata";
import HistoryList from "@/components/admin/HistoryList";
export type SeoItem = SeoValues & { id?: number };
const FIELDS = ["title", "description", "keywords", "ogImage", "canonical", "noindex"];
export default function SeoEditor({ row, onClose, onSaved, onPatched }: { row: SeoItem; onClose: () => void; onSaved: (row: SeoItem) => void; onPatched: (row: SeoItem) => void }) {
  const editorRef = useRef<HTMLElement>(null);
  const [base, setBase] = useState<Record<string, any>>(() => ({ ...row }));
  const [draft, setDraft] = useState<Record<string, any>>(base);
  const [tab, setTab] = useState("search");
  const [saving, setSaving] = useState(false), [uploads, setUploads] = useState(0), [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const dirtyKeys = FIELDS.filter(key => JSON.stringify(draft[key] ?? "") !== JSON.stringify(base[key] ?? ""));
  const dirty = dirtyKeys.length > 0;
  const busy = saving || uploads > 0;
  const set = (key: string, value: any) => { if (!saving) setDraft(current => ({ ...current, [key]: value })); };
  async function close() {
    if (busy) return;
    if (dirty && !(await dialog.confirm({ title: "Discard your changes?", message: "Your SEO changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return;
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
    setSaving(true); setError(""); setConflict(false);
    try {
      const body = Object.fromEntries((base.id ? dirtyKeys : FIELDS.filter(key => draft[key] !== undefined)).map(key => [key, typeof draft[key] === "string" ? draft[key].trim() || null : draft[key]]));
      const saved = await api.saveSeo(row.page, { ...body, expected: base.id ? base : null });
      toast("SEO saved", "ok", { description: saved.title }); onSaved(saved);
    } catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save SEO settings."); }
    finally { setSaving(false); }
  }
  async function reload() {
    if (!row || !(await dialog.confirm({ title: "Reload the saved version?", message: "This replaces your unsaved edits with the latest saved SEO settings.", confirmText: "Reload", cancelText: "Keep editing" }))) return;
    try { const saved = await api.get("seo", row.page); const normalized = saved; setBase(normalized); setDraft(normalized); onPatched(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); }
  }
  const fileRef = useRef<HTMLInputElement>(null);
  async function upload(file?: File) {
    if (!file || busy) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { setError("Choose a JPG, PNG or WebP under 8 MB."); return; }
    setUploads(1); setError("");
    try { const result = await api.upload(file); set("ogImage", result.url); }
    catch (e) { setError(e instanceof Error ? e.message : "Photo upload failed. Try again."); }
    finally { setUploads(0); if (fileRef.current) fileRef.current.value = ""; }
  }
  const text = (key: string, label: string, multiline = false) => <label className="se-field" key={key}><span>{label}</span>{multiline ? <textarea rows={3} value={draft[key] || ""} disabled={saving} onChange={event => set(key, event.target.value)} /> : <input value={draft[key] ?? ""} disabled={saving} onChange={event => set(key, event.target.value)} />}</label>;
  const presentation = seoPresentation({ ...draft, page: row.page });
  return <div className="se-overlay"><section ref={editorRef} className="se-editor" aria-busy={busy} role="dialog" aria-modal="true" aria-label={`Edit ${seoLabel(row.page)} SEO`}>
    <header className="se-editor-head"><div><span className="se-eyebrow">A CLEAR FIRST IMPRESSION</span><h2>{seoLabel(row.page)} — SEO</h2><p>Refine how this page appears in search and sharing previews.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    <div className="se-tabs" role="tablist" aria-label="SEO sections">{[["search", "Search"], ["sharing", "Sharing"], ["advanced", "Advanced"]].map(([key, label]) => <button type="button" role="tab" disabled={busy} aria-selected={tab === key} key={key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {error && <div className="se-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="se-editor-body"><main className="se-edit-fields" inert={busy}>
      {tab === "search" && <div className="se-form">{text("title", "Search title")}<small className="se-help">{String(draft.title || "").length} characters · around 50–60 usually displays well. Blank uses the page default.</small>{text("description", "Search description", true)}<small className="se-help">{String(draft.description || "").length} characters · around 140–160 usually displays well. Search engines may show different text.</small>{text("keywords", "Keywords")}<p className="se-help">Optional, comma separated. Keywords do not guarantee search ranking.</p></div>}
      {tab === "sharing" && <div className="se-form"><p className="se-help">The sharing image appears with this page’s title and description. Use a landscape image, ideally 1200 × 630.</p><div className="se-upload">{draft.ogImage ? <img src={draft.ogImage} alt="Sharing image" /> : <div className="se-upload-empty">Give your link a visual identity</div>}<div className="se-upload-actions"><button type="button" className="sh-btn" onClick={() => fileRef.current?.click()}>{draft.ogImage ? "Replace image" : "Upload image"}</button>{draft.ogImage && <button type="button" className="sh-btn" onClick={() => set("ogImage", null)}>Remove image</button>}<input ref={fileRef} type="file" aria-label="Upload sharing image" accept="image/jpeg,image/png,image/webp" hidden onChange={event => upload(event.target.files?.[0])} /></div></div>{text("ogImage", "Sharing image URL")}<p className="se-help">Upload an image or use an existing image URL. Uploading alone does not save the SEO settings.</p></div>}
      {tab === "advanced" && <div className="se-form">{text("canonical", "Canonical URL")}<p className="se-help">Use an absolute URL to identify the preferred version of this page. Leave blank to use its normal website address.</p><label className="se-check"><input type="checkbox" checked={!!draft.noindex} onChange={event => set("noindex", event.target.checked)} />Ask search engines not to index this page</label><p className="se-help">No-index keeps the page public. It asks search engines to exclude it from results; it does not restrict access.</p>{base.id && <HistoryList entity="seo" id={row.page} />}</div>}
    </main><aside className="se-editor-context"><span className="se-eyebrow">PRIVATE SEARCH PREVIEW</span><div className="se-search-preview"><small>{presentation.url}</small><h3>{presentation.title}</h3><p>{presentation.description}</p></div><span className="se-eyebrow">SHARING PREVIEW</span><div className="se-sharing-preview">{draft.ogImage && <img src={draft.ogImage} alt="Sharing preview" />}<div><small>{siteUrl.replace(/^https?:\/\//, "")}</small><h3>{presentation.title}</h3><p>{presentation.description}</p></div></div><span className={`se-status ${draft.noindex ? "draft" : "published"}`}>{draft.noindex ? "No-index requested" : "Indexing allowed"}</span><p>Preview reflects unsaved edits. Search engines and social platforms control their final display and refresh timing.</p><a className="sh-btn sm" href={row.page === "home" ? "/" : `/${row.page}`} target="_blank" rel="noopener noreferrer">Open website page ↗</a></aside></div>
    <footer className="se-editor-foot"><span>{uploads ? "Uploading image…" : dirty ? "Unsaved changes" : base.id ? "Saved version" : "Using page defaults"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (base.id !== undefined && !dirty)} onClick={save}>{saving ? "Saving…" : "Save SEO"}</button></footer>
  </section></div>;
}
