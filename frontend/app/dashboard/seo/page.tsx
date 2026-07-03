"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/adminApi";

const PAGES = ["home", "about", "services", "solutions", "work", "blog", "contact"];

export default function AdminSeo() {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const rows: any[] = await api.listSeo();
        const map: Record<string, any> = {};
        PAGES.forEach((p) => { map[p] = rows.find((r) => r.page === p) || { page: p, title: "", description: "", keywords: "", ogImage: "", canonical: "", noindex: false }; });
        setData(map);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  const set = (page: string, field: string, value: any) => setData((d) => ({ ...d, [page]: { ...d[page], [field]: value } }));

  async function save(page: string) {
    setSaved(""); setError("");
    try { await api.saveSeo(page, data[page]); setSaved(page); setTimeout(() => setSaved(""), 2500); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  }

  if (loading) return <div className="adm-empty">Loading…</div>;

  return (
    <>
      <div className="adm-top"><div><h1>SEO</h1><p>Per-page search &amp; social metadata.</p></div></div>
      {error && <div className="adm-msg err">{error}</div>}
      {PAGES.map((page) => (
        <div className="adm-group" key={page}>
          <h3 style={{ textTransform: "capitalize" }}>{page}</h3>
          <p className="gsub">/{page === "home" ? "" : page}</p>
          {saved === page && <div className="adm-msg ok">Saved!</div>}
          <div className="adm-field"><label>Title</label>
            <input value={data[page].title || ""} onChange={(e) => set(page, "title", e.target.value)} /></div>
          <div className="adm-field"><label>Description</label>
            <textarea value={data[page].description || ""} onChange={(e) => set(page, "description", e.target.value)} /></div>
          <div className="adm-field"><label>Keywords</label>
            <input value={data[page].keywords || ""} onChange={(e) => set(page, "keywords", e.target.value)} placeholder="comma, separated" /></div>
          <div className="adm-field"><label>OG image URL</label>
            <input value={data[page].ogImage || ""} onChange={(e) => set(page, "ogImage", e.target.value)} /></div>
          <div className="adm-field">
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={!!data[page].noindex} onChange={(e) => set(page, "noindex", e.target.checked)} style={{ width: 18, height: 18 }} />
              <span style={{ color: "var(--muted)" }}>No-index this page</span>
            </label>
          </div>
          <button className="adm-btn primary" onClick={() => save(page)}>Save {page}</button>
        </div>
      ))}
    </>
  );
}
