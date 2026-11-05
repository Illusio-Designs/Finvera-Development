"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import Select from "@/components/Select";
import { validPageSlug, fixedPageSlug } from "@/lib/websitePages";
import HistoryList from "@/components/admin/HistoryList";
const RichText = dynamic(() => import("@/components/admin/RichText"), { ssr: false, loading: () => <p role="status">Loading editor…</p> });
export type WebsitePage = Record<string, any> & { id: number; title: string; slug: string; status: string };
const FIELDS = ["title", "slug", "content", "status"];
const normalize = (row: Record<string, any>) => ({ ...row });
const esc = (value: any) => String(value || "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));
function preview(draft: Record<string, any>) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'"><style>body{font:16px/1.9 Arial,sans-serif;color:#23375c;margin:0;padding:32px;background:#fff}h1{font-size:34px;line-height:1.3;letter-spacing:-1px}h2{font-size:23px}img{max-width:100%;border-radius:16px}div{overflow-wrap:anywhere}</style></head><body><h1>${esc(draft.title || "Untitled page")}</h1><div>${draft.content || "<p>Your page content will appear here.</p>"}</div></body></html>`;
}
export default function PageEditor({ row, onClose, onSaved, onPatched, onDeleted }: { row: WebsitePage | null; onClose: () => void; onSaved: (row: WebsitePage) => void; onPatched: (row: WebsitePage) => void; onDeleted: (id: number) => void }) {
  const editorRef = useRef<HTMLElement>(null);
  const [base, setBase] = useState<Record<string, any>>(() => normalize(row || { title: "", status: "draft", slug: "", content: "" }));
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
    if (dirty && !(await dialog.confirm({ title: "Discard your changes?", message: "Your page changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return;
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
    if (!String(draft.title || "").trim()) { setShowPreview(false); setTab("details"); setError("Add the page title."); return; }
    if (!validPageSlug(draft.slug)) { setShowPreview(false); setTab("publish"); setError("Use a short URL starting with a letter, with lowercase letters, numbers and single hyphens. Built-in website routes are reserved."); return; }
    if (row && base.status === "published" && draft.slug !== base.slug && !(await dialog.confirm({ title: "Change this page’s URL?", message: `Links to /${base.slug} will stop working. The page will move to /${draft.slug} after saving.`, confirmText: "Change URL", cancelText: "Keep editing" }))) return;
    setSaving(true); setError(""); setConflict(false);
    try {
      const body = Object.fromEntries((row ? dirtyKeys : FIELDS.filter(key => draft[key] !== undefined)).map(key => [key, typeof draft[key] === "string" ? draft[key].trim() || null : draft[key]]));
      const saved = row ? await api.update("pages", row.id, { ...body, expected: base }) : await api.create("pages", body);
      toast(saved.status === "published" ? "Page published" : "Draft saved", "ok", { description: saved.title }); onSaved(saved);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn’t save the page.";
      const stale = (e as { status?: number }).status === 409 && /changed while/.test(message);
      setConflict(!!row && stale);
      if ((e as { status?: number }).status === 409 && !stale) { setShowPreview(false); setTab("publish"); setError("That page URL is already in use. Choose another URL."); }
      else setError(message);
    }
    finally { setSaving(false); }
  }
  async function reload() {
    if (!row || !(await dialog.confirm({ title: "Reload the saved version?", message: "This replaces your unsaved edits with the latest saved page.", confirmText: "Reload", cancelText: "Keep editing" }))) return;
    try { const saved = await api.get("pages", row.id); const normalized = normalize(saved); setBase(normalized); setDraft(normalized); onPatched(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); }
  }
  async function remove() {
    if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.title}?`, message: "This removes the page from the website. You can save it as a draft to keep it privately.", confirmText: "Delete page", danger: true }))) return;
    setSaving(true);
    try { await api.remove("pages", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setSaving(false); }
  }
  const text = (key: string, label: string, multiline = false) => <label className="wp-field" key={key}><span>{label}</span>{multiline ? <textarea rows={3} value={draft[key] || ""} disabled={saving} onChange={event => set(key, event.target.value)} /> : <input value={draft[key] ?? ""} disabled={saving} onChange={event => set(key, event.target.value)} />}</label>;
  return <div className="wp-overlay"><section ref={editorRef} className="wp-editor" aria-busy={saving} role="dialog" aria-modal="true" aria-label={row ? `Edit ${row.title}` : "New page"}>
    <header className="wp-editor-head"><div><span className="wp-eyebrow">A CLEAR PLACE FOR EVERY WORD</span><h2>{draft.title || "New page"}</h2><p>{row ? "Keep important information clear and current." : "Start with a draft. Publish when you’re ready."}</p></div><div className="wp-editor-head-actions"><button type="button" className="sh-btn sm" disabled={busy} aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}>{showPreview ? "Back to editor" : "Preview"}</button><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></div></header>
    <div className="wp-tabs" role="tablist" aria-label="Page sections">{[["details", "Content"], ["publish", "URL & publishing"]].map(([key, label]) => <button type="button" role="tab" disabled={busy} aria-selected={!showPreview && tab === key} key={key} onClick={() => { setTab(key); setShowPreview(false); }}>{label}</button>)}</div>
    {error && <div className="wp-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="wp-editor-body"><main className="wp-edit-fields" inert={saving}>
      {showPreview ? <><p className="wp-preview-note">Private preview of your current edits. Previewing does not publish or save changes.</p><iframe title="Page preview" sandbox="" srcDoc={preview(draft)} className="wp-preview-frame" /></> : <>
      {tab === "details" && <div className="wp-form">{text("title", "Page title")}<section className="wp-rich"><h3>Page content</h3><RichText value={draft.content || ""} onChange={value => set("content", value)} onUploadBusy={on => setUploads(count => count + (on ? 1 : -1))} /></section></div>}
      {tab === "publish" && <div className="wp-form"><label className="wp-field"><span>Page URL</span><input aria-label="Page URL" value={draft.slug || ""} disabled={!!row && fixedPageSlug(base.slug)} onChange={event => set("slug", event.target.value)} placeholder="e.g. accessibility" maxLength={200} /><small>{row && fixedPageSlug(base.slug) ? "This address is fixed because the website links to this policy page." : "Use lowercase letters, numbers and single hyphens. Changing a published URL breaks its old links."}</small></label><div className="wp-field"><label htmlFor="wp-status">Publication status</label><Select id="wp-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on website" }]} /></div><p className="wp-help">Published pages are available at their URL. Add links from your website content to help visitors find them.</p>{row && <HistoryList entity="page" id={row.id} />}</div>}
      </>}
    </main><aside className="wp-editor-context"><span className="wp-eyebrow">PUBLICATION</span><span className={`wp-status ${draft.status}`}>{draft.status === "published" ? "Published" : "Draft"}</span><p>{draft.status === "published" ? "Saving makes these changes visible on the website." : "This page stays private when saved."}</p><span className="wp-eyebrow">PAGE ADDRESS</span><p className="wp-url">/{draft.slug || "your-page"}</p>{row && <><span className="wp-eyebrow">SAVED WEBSITE URL</span><p className="wp-url">/{base.slug}</p>{base.status === "published" && <a className="sh-btn sm" href={`/${encodeURIComponent(base.slug)}`} target="_blank" rel="noopener noreferrer">Open published page ↗</a>}</>}</aside></div>
    <footer className="wp-editor-foot">{row && <button type="button" className="sh-btn wp-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{uploads ? "Uploading images…" : dirty ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirty)} onClick={save}>{saving ? "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
