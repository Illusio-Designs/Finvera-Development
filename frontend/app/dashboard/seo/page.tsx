"use client";
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Refresh01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/adminApi";
import PageLoading from "@/components/admin/PageLoading";
import SeoEditor, { type SeoItem } from "@/components/admin/seo/SeoEditor";
import { SEO_PAGES, seoLabel, seoPresentation } from "@/lib/seoMetadata";
import "./seo-workspace.css";
export default function AdminSeo() {
  const [rows, setRows] = useState<SeoItem[] | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{ row: SeoItem; key: number } | null>(null);
  async function load() { setBusy(true); setError(""); try { const result = await api.listSeo(); setRows(Array.isArray(result) ? result : []); } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load SEO settings."); } finally { setBusy(false); } }
  useEffect(() => { load(); }, []);
  const pages = SEO_PAGES.map(page => rows?.find(row => row.page === page) || { page, title: "", description: "", keywords: "", canonical: "", ogImage: "", noindex: false });
  const shown = pages.filter(row => (!filter || (filter === "noindex" ? row.noindex : !row.id)) && (!query.trim() || [row.page, row.title, row.description].join(" ").toLowerCase().includes(query.trim().toLowerCase())));
  const patch = (row: SeoItem) => setRows(current => [...(current || []).filter(item => item.page !== row.page), row]);
  return <div className="seo-workspace"><header className="se-header"><div><span className="se-eyebrow">MAKE EVERY FIRST IMPRESSION COUNT</span><h1>SEO</h1><p>Shape how your main website pages appear in search and social sharing.</p></div><a className="sh-btn" href="/" target="_blank" rel="noopener noreferrer">Open website <HugeiconsIcon icon={ArrowUpRight01Icon} size={15} /></a></header>
    {!rows && !error ? <PageLoading label="Loading SEO settings…" variant="list" /> : <><div className="se-toolbar"><div className="se-segments" role="tablist" aria-label="SEO filter">{[["", "All pages"], ["defaults", "Using defaults"], ["noindex", "No-index"]].map(([value, label]) => <button type="button" role="tab" aria-selected={filter === value} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div><label className="se-search"><HugeiconsIcon icon={Search01Icon} size={16} /><input type="search" aria-label="Search SEO pages" placeholder="Find a page or search title…" value={query} onChange={event => setQuery(event.target.value)} /></label><button type="button" className="sh-icb" aria-label="Refresh SEO" disabled={busy} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button></div>
    {error && <div className="se-error" role="alert">{error}<button type="button" className="sh-btn sm" disabled={busy} onClick={load}>Try again</button></div>}
    {rows && <><span className="se-result-count">{shown.length} pages{busy ? " · refreshing…" : ""}</span><div className="se-page-list">{shown.map((row, index) => <article className="se-page-row" key={row.page}><span className="se-page-number">{String(index + 1).padStart(2, "0")}</span><button type="button" className="se-page-title" aria-label={`Edit ${seoLabel(row.page)} SEO`} onClick={() => setEditing({ row, key: Date.now() })}><b>{seoLabel(row.page)}</b><span>/{row.page === "home" ? "" : row.page}</span><p className="se-summary">{seoPresentation(row).title}</p><small className="se-saved">{row.id ? "Saved settings" : "Using page defaults"}</small></button><span className={`se-status ${row.noindex ? "draft" : "published"}`}>{row.noindex ? "No-index requested" : "Indexing allowed"}</span><div className="se-page-actions"><button type="button" className="sh-btn sm" onClick={() => setEditing({ row, key: Date.now() })}>Edit SEO ↗</button></div></article>)}</div>{!shown.length && <div className="se-empty"><h2>No pages match</h2><p>Try another page name, title or filter.</p><button type="button" className="sh-btn" onClick={() => { setQuery(""); setFilter(""); }}>Clear filters</button></div>}<p className="se-help">These settings cover the seven main website pages. Article and case-study SEO stays in their own editors.</p></>}
    </>}
    {editing && <SeoEditor key={editing.key} row={editing.row} onClose={() => setEditing(null)} onSaved={row => { patch(row); setEditing(null); }} onPatched={patch} />}
  </div>;
}
