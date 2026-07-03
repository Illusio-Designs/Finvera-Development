"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { TableSkeleton } from "@/components/admin/Skeleton";

const PAGES = ["home", "about", "services", "solutions", "work", "blog", "contact"];
type Seo = { page: string; title?: string; description?: string; keywords?: string; ogImage?: string; canonical?: string; noindex?: boolean };

export default function AdminSeo() {
  const [data, setData] = useState<Record<string, Seo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Seo | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const rows: Seo[] = await api.listSeo();
      const map: Record<string, Seo> = {};
      PAGES.forEach((p) => { map[p] = (Array.isArray(rows) ? rows : []).find((r) => r.page === p) || { page: p, title: "", description: "", keywords: "", ogImage: "", canonical: "", noindex: false }; });
      setData(map);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const setField = (field: keyof Seo, value: unknown) => setEditing((s) => (s ? { ...s, [field]: value } : s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api.saveSeo(editing.page, editing);
      setData((d) => ({ ...d, [editing.page]: editing }));
      setEditing(null); toast("SEO saved");
    } catch (err) { toast(err instanceof Error ? err.message : "Save failed", "err"); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="adm-top"><div><h1>SEO</h1><p>Per-page search &amp; social metadata.</p></div></div>
      {error && <div className="adm-msg err">{error}</div>}

      <div className="adm-panel">
        {loading ? (
          <TableSkeleton rows={7} cols={3} />
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                <th>Page</th>
                <th>Title</th>
                <th>Description</th>
                <th>Indexed</th>
                <th style={{ textAlign: "right" }}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {PAGES.map((p, i) => {
                const s = data[p] || { page: p };
                return (
                  <tr key={p}>
                    <td style={{ color: "var(--muted-2)" }}>{i + 1}</td>
                    <td><b style={{ textTransform: "capitalize" }}>{p}</b><small style={{ display: "block", color: "var(--muted-2)", fontSize: 11.5, fontFamily: "var(--mono)" }}>/{p === "home" ? "" : p}</small></td>
                    <td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || <span style={{ color: "var(--muted-2)" }}>—</span>}</td>
                    <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>{s.description || "—"}</td>
                    <td><span className={"adm-badge " + (s.noindex ? "draft" : "published")}>{s.noindex ? "No-index" : "Indexed"}</span></td>
                    <td>
                      <div className="adm-rowbtns">
                        <button className="adm-ibtn" onClick={() => setEditing({ ...s })} data-tip="Edit" aria-label="Edit">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="adm-drawer" onSubmit={save}>
            <h2 style={{ textTransform: "capitalize" }}>{editing.page} — SEO</h2>
            <p className="sub">/{editing.page === "home" ? "" : editing.page}</p>
            <div className="adm-field"><label>Title</label>
              <input value={editing.title || ""} onChange={(e) => setField("title", e.target.value)} autoFocus /></div>
            <div className="adm-field"><label>Description</label>
              <textarea value={editing.description || ""} onChange={(e) => setField("description", e.target.value)} /></div>
            <div className="adm-field"><label>Keywords</label>
              <input value={editing.keywords || ""} onChange={(e) => setField("keywords", e.target.value)} placeholder="comma, separated" /></div>
            <div className="adm-field"><label>OG image URL</label>
              <input value={editing.ogImage || ""} onChange={(e) => setField("ogImage", e.target.value)} /></div>
            <div className="adm-field"><label>Canonical URL</label>
              <input value={editing.canonical || ""} onChange={(e) => setField("canonical", e.target.value)} placeholder="https://…" /></div>
            <div className="adm-field">
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={!!editing.noindex} onChange={(e) => setField("noindex", e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ color: "var(--muted)" }}>No-index this page</span>
              </label>
            </div>
            <div className="adm-drawer-actions">
              <button className="adm-btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button className="adm-btn ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
