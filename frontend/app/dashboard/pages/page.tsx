"use client";
import { WorkspaceHero } from "@/components/admin/Workspace";
import PageLoading from "@/components/admin/PageLoading";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon, Refresh01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/adminApi";
import PageEditor, { type WebsitePage } from "@/components/admin/pages/PageEditor";
import "./pages-workspace.css";
const sortPages = (rows: WebsitePage[]) => [...rows].sort((a, b) => a.title.localeCompare(b.title));
export default function AdminWebsitePages() {
  const [rows, setRows] = useState<WebsitePage[] | null>(null), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("");
  const [busy, setBusy] = useState(true), [editing, setEditing] = useState<{ row: WebsitePage | null; key: number } | null>(null);
  async function load() { setBusy(true); setError(""); try { const result = await api.list("pages"); setRows(Array.isArray(result) ? sortPages(result) : []); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load website pages."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const shown = (rows || []).filter(row => (!status || row.status === status) && (!query.trim() || [row.title, row.slug].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const open = (row: WebsitePage | null) => setEditing({ row, key: Date.now() });
  const patched = (row: WebsitePage) => setRows(current => sortPages(current?.some(item => item.id === row.id) ? current.map(item => item.id === row.id ? row : item) : [row, ...(current || [])]));
  return <div className="pages-workspace"><WorkspaceHero eyebrow="THE DETAILS THAT BUILD TRUST" title="Website pages" description="Keep policies and supporting pages clear, current and easy to find." actions={<> <div className="wp-header-actions"><a className="sh-btn" href="/" target="_blank" rel="noopener noreferrer">Open website <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a><button type="button" className="sh-btn pri" onClick={() => open(null)}><HugeiconsIcon icon={Add01Icon} size={16} />New page</button></div> </>} />
    {!rows && !error ? <PageLoading label="Loading website pages…" variant="list" /> : <>
    <div className="wp-toolbar"><div className="wp-segments" role="tablist" aria-label="Page status">{[["", "All pages"], ["published", "Published"], ["draft", "Drafts"]].map(([value, label]) => <button type="button" role="tab" aria-selected={status === value} key={value} onClick={() => setStatus(value)}>{label}{rows && <small>{rows.filter(row => !value || row.status === value).length}</small>}</button>)}</div><label className="wp-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search pages" placeholder="Find a page title or URL…" value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" className="sh-icb" aria-label="Refresh website pages" disabled={busy} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="wp-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy} onClick={load}>Try again</button></div>}
    <div className="wp-result-count" aria-live="polite">{rows ? `${shown.length} ${shown.length === 1 ? "page" : "pages"}${busy ? " · refreshing…" : ""}` : "Pages unavailable"}</div><div className="wp-page-list">{shown.map((row, index) => <article className="wp-page-row" key={row.id}><span className="wp-page-number">{String(index + 1).padStart(2, "0")}</span><button type="button" className="wp-page-title" aria-label={`Edit ${row.title}`} onClick={() => open(row)}><b>{row.title}</b><span>/{row.slug}</span></button><span className={`wp-status ${row.status}`}>{row.status === "published" ? "Published" : "Draft"}</span><div className="wp-page-actions"><button type="button" className="sh-btn sm" onClick={() => open(row)}>Edit page ↗</button>{row.status === "published" && <a href={`/${encodeURIComponent(row.slug)}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${row.title} on website`}>View live ↗</a>}</div></article>)}</div>{!shown.length && !error && <div className="wp-empty"><h2>{rows?.length ? "No pages match" : "Give important information a home"}</h2><p>{rows?.length ? "Try a different search or filter." : "Create a draft, shape your page and publish when it’s ready."}</p><button type="button" className="sh-btn" onClick={() => { if (rows?.length) { setQuery(""); setStatus("");  } else open(null); }}>{rows?.length ? "Clear filters" : "New page"}</button></div>}</>}
    {editing && <PageEditor key={editing.key} row={editing.row} onClose={() => setEditing(null)} onSaved={row => { patched(row); setEditing(null); }} onPatched={patched} onDeleted={id => { setRows(current => current?.filter(row => row.id !== id) || []); setEditing(null); }} />}
  </div>;
}
