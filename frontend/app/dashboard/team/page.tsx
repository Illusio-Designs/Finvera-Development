"use client";
import { useResourceState } from "@/lib/useResourceState";
import { useSaveWorkflow } from "@/lib/useSaveWorkflow";
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon, Refresh01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import { testimonialInitials } from "@/lib/testimonialPresentation";
import PageLoading from "@/components/admin/PageLoading";
import Select from "@/components/Select";
import HistoryList from "@/components/admin/HistoryList";
import "./team-workspace.css";
type Member = { id: number; name: string; role: string | null; bio: string | null; initials: string | null; photo: string | null; position: number; status: string; createdAt?: string };
const FIELDS = ["name", "role", "bio", "initials", "photo", "position", "status"] as const;
const sorted = (rows: Member[]) => [...rows].sort((a, b) => a.position - b.position || String(b.createdAt || "").localeCompare(String(a.createdAt || "")) || b.id - a.id);
function MemberContent({ row, full = false }: { row: Partial<Member>; full?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [row.photo]);
  return <><div className="wt-portrait">{row.photo && !failed ? <img src={row.photo} alt={row.name || "Profile photo"} onError={() => setFailed(true)} /> : <span>{testimonialInitials(row.name, row.initials)}</span>}</div><div className="wt-person"><h3>{row.name || "Team member"}</h3><span>{row.role || "Role to be added"}</span></div>{full && <p className="wt-bio">{row.bio || "Their story will appear here."}</p>}</>;
}
export default function AdminWebsiteTeam() {
  const { data: rows, setData: setRows, loading: busy, setLoading: setBusy, error, setError } = useResourceState<Member[] | null>(null, true);
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [editing, setEditing] = useState<{ row: Member | null; key: number } | null>(null);
  async function load() { setBusy(true); setError(""); try { const data = await api.list("team"); setRows(sorted(Array.isArray(data) ? data : [])); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load team."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.name, row.role, row.bio].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: Member) => setRows(current => sorted(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  return <div className="team-workspace"><header className="wt-header"><div><span className="wt-eyebrow">THE PEOPLE BEHIND THE WORK</span><h1>Website team</h1><p>Introduce the people behind your work on the About page.</p></div><div className="wt-header-actions"><a className="sh-btn" href="/about" target="_blank" rel="noopener noreferrer">Open About page <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" onClick={() => setEditing({ row: null, key: Date.now() })}><HugeiconsIcon icon={Add01Icon} size={16} />New member</button></div></header>
    {!rows && busy && !error ? <PageLoading label="Loading team…" /> : <><div className="wt-toolbar"><div className="wt-tabs" role="tablist" aria-label="Profile status">{[["", "All members"], ["published", "Published"], ["draft", "Drafts"]].map(([value, label]) => <button type="button" role="tab" aria-selected={status === value} key={value} onClick={() => setStatus(value)}>{label}{rows && <small>{rows.filter(row => !value || row.status === value).length}</small>}</button>)}</div><label className="wt-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search team" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a name, role or bio…" /></label><button type="button" className="sh-icb" aria-label="Refresh team" disabled={busy} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="wt-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy} onClick={load}>Try again</button></div>}
    <div className="wt-count" aria-live="polite">{rows ? `${shown.length} members${busy ? " · refreshing…" : ""}` : "Website team unavailable"}</div>
    <div className="wt-grid">{shown.map(row => <article className="wt-card" key={row.id}><MemberContent row={row} /><footer><span className={`wt-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><button type="button" aria-label={`Edit profile for ${row.name}`} onClick={() => setEditing({ row, key: Date.now() })}>Edit profile ↗</button></footer></article>)}</div>
    {rows && !shown.length && !error && <div className="wt-empty"><h2>{rows.length ? "No members match" : "Introduce your team"}</h2><p>{rows.length ? "Try a different name, role or status." : "Create a private profile, add their story, then publish to About."}</p><button type="button" className="sh-btn" onClick={() => { if (rows.length) { setQuery(""); setStatus(""); } else setEditing({ row: null, key: Date.now() }); }}>{rows.length ? "Clear filters" : "New member"}</button></div>}</>}
    {editing && <MemberEditor key={editing.key} row={editing.row} nextPosition={rows?.length ? Math.max(...rows.map(row => row.position)) + 1 : 0} onClose={() => setEditing(null)} onPatch={patch} onSaved={row => { patch(row); setEditing(null); }} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
function MemberEditor({ row, nextPosition, onClose, onSaved, onPatch, onDeleted }: { row: Member | null; nextPosition: number; onClose: () => void; onSaved: (row: Member) => void; onPatch: (row: Member) => void; onDeleted: (id: number) => void }) {
  const [base, setBase] = useState<Partial<Member>>(row || { name: "", bio: "", photo: "", initials: "", role: "", status: "draft", position: nextPosition });
  const [draft, setDraft] = useState(base);
  const { saving: busy, setSaving: setBusy, error, setError, conflict, setConflict } = useSaveWorkflow();
  const fileRef = useRef<HTMLInputElement>(null), uploadPending = useRef(false);
  const ref = useRef<HTMLElement>(null), dirtyKeys = FIELDS.filter(field => String(draft[field] ?? "") !== String(base[field] ?? ""));
  const set = (field: keyof Member, value: any) => { if (!busy) setDraft(current => ({ ...current, [field]: value })); };
  async function close() { if (busy || uploadPending.current) return; if (dirtyKeys.length && !(await dialog.confirm({ title: "Discard your changes?", message: "Your profile changes have not been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true }))) return; onClose(); }
  useEffect(() => { const previous = document.body.style.overflow, focused = document.activeElement as HTMLElement | null; document.body.style.overflow = "hidden"; ref.current?.querySelector<HTMLInputElement>("input")?.focus(); return () => { document.body.style.overflow = previous; if (focused?.isConnected) focused.focus(); }; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => { if (document.querySelector(".adm-overlay")) return; if (event.key === "Escape" && !document.querySelector(".cselect.open")) close(); if (event.key === "Tab") { const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]") || []).filter(element => element.getClientRects().length && !element.closest("[inert]")); const first = elements[0], last = elements[elements.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  async function save() {
    if (busy || uploadPending.current) return;
    if (!draft.name?.trim()) { setError("Add the member’s name."); return; }
    setBusy(true); setError(""); setConflict(false);
    const body = Object.fromEntries((row ? dirtyKeys : FIELDS.filter(field => draft[field] !== undefined)).map(field => [field, typeof draft[field] === "string" ? String(draft[field]).trim() || null : draft[field]]));
    try { const saved = row ? await api.update("team", row.id, { ...body, expected: base }) : await api.create("team", body); toast(saved.status === "published" ? "Profile published" : "Draft saved", "ok", { description: saved.name }); onSaved(saved); }
    catch (e) { setConflict((e as { status?: number }).status === 409); setError(e instanceof Error ? e.message : "Couldn’t save this profile."); }
    finally { setBusy(false); }
  }
  async function reload() { if (!row || !(await dialog.confirm({ title: "Reload this profile?", message: "This replaces your unsaved edits with the latest saved version.", confirmText: "Reload", cancelText: "Keep editing" }))) return; try { const saved = await api.get("team", row.id); setBase(saved); setDraft(saved); onPatch(saved); setError(""); setConflict(false); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t reload."); } }
  async function remove() { if (!row || busy || !(await dialog.confirm({ title: `Delete ${row.name}’s profile?`, message: "This removes the profile from the About page. Save it as a draft to keep it privately.", confirmText: "Delete profile", danger: true }))) return; setBusy(true); try { await api.remove("team", row.id); onDeleted(row.id); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t delete."); } finally { setBusy(false); } }
  const text = (field: "name" | "role" | "initials", label: string) => <label className="wt-field"><span>{label}</span><input value={draft[field] || ""} onChange={event => set(field, event.target.value)} maxLength={field === "initials" ? 8 : 255} /></label>;
  async function upload(file?: File) {
    if (!file || busy || uploadPending.current) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) { setError("Choose a JPG, PNG or WebP photo under 8 MB."); return; }
    uploadPending.current = true; setBusy(true); setError("");
    try { const result = await api.upload(file); setDraft(current => ({ ...current, photo: result.url })); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t upload the photo. Try again."); }
    finally { uploadPending.current = false; setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  return <div className="wt-overlay"><section className="wt-editor" ref={ref} role="dialog" aria-modal="true" aria-busy={busy} aria-label={row ? `Edit profile for ${row.name}` : "New member"}><header className="wt-editor-header"><div><span className="wt-eyebrow">A FACE BEHIND THE WORK</span><h2>{draft.name ? draft.name : "New member"}</h2><p>Shape their profile, preview it, then publish to About.</p></div><button type="button" className="sh-icb" aria-label="Close editor" onClick={close}>×</button></header>
    {error && <div className="wt-error" role="alert">{error}{conflict && <button type="button" className="sh-btn sm" onClick={reload}>Reload saved version</button>}</div>}
    <div className="wt-editor-body"><div className="wt-form" inert={busy}>{text("name", "Member name")}{text("role", "Role")}<div className="wt-field"><span>Profile photo</span><div className="wt-photo-actions"><button type="button" className="sh-btn" onClick={() => fileRef.current?.click()}>{draft.photo ? "Replace photo" : "Upload photo"}</button>{draft.photo && <button type="button" className="sh-btn" onClick={() => set("photo", null)}>Remove photo</button>}<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload profile photo" hidden onChange={event => upload(event.target.files?.[0])} /></div><small>JPG, PNG or WebP · up to 8 MB. Uploading does not publish.</small></div>{text("initials", "Initials · optional fallback")}<label className="wt-field"><span>Bio</span><textarea aria-label="Bio" rows={5} value={draft.bio || ""} onChange={event => set("bio", event.target.value)} placeholder="A little about their experience and perspective…" /></label><div className="wt-pair"><div className="wt-field"><label htmlFor="wt-status">Publication status</label><Select id="wt-status" ariaLabel="Publication status" value={draft.status} onChange={value => set("status", value)} options={[{ value: "draft", label: "Draft · private" }, { value: "published", label: "Published · visible on About" }]} /></div><label className="wt-field"><span>Display order</span><input type="number" min={0} step={1} value={draft.position ?? 0} onChange={event => set("position", Number(event.target.value))} /></label></div>{row && <HistoryList entity="team-member" id={row.id} />}</div>
    <aside className="wt-preview"><span className="wt-eyebrow">PRIVATE PROFILE PREVIEW</span><p>Your current edits, shown as a profile card. Previewing does not save or publish.</p><article className="wt-card"><MemberContent row={draft} full /></article><span className={`wt-status ${draft.status}`}>{draft.status === "published" ? "Published on save" : "Private draft"}</span></aside></div>
    <footer className="wt-editor-footer">{row && <button type="button" className="sh-btn wt-delete" disabled={busy} onClick={remove}>Delete</button>}<span>{dirtyKeys.length ? "Unsaved changes" : row ? "Saved version" : "New draft"}</span><button type="button" className="sh-btn" disabled={busy} onClick={close}>Cancel</button><button type="button" className="sh-btn pri" disabled={busy || (!!row && !dirtyKeys.length)} onClick={save}>{busy ? uploadPending.current ? "Uploading photo…" : "Saving…" : draft.status === "published" ? "Save & publish" : "Save draft"}</button></footer>
  </section></div>;
}
