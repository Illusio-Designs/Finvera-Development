"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import RichText from "./RichText";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select" | "boolean" | "tags" | "image" | "date" | "richtext";
  options?: string[];
  placeholder?: string;
};
export type Column = { name: string; label: string; type?: "image" | "status" | "tags" | "text" };

type Props = {
  resource: string;
  title: string;
  subtitle?: string;
  columns: Column[];
  fields: Field[];
  defaults?: Record<string, any>;
};

const emptyFrom = (fields: Field[], defaults?: Record<string, any>) => {
  const o: Record<string, any> = { ...defaults };
  fields.forEach((f) => { if (o[f.name] === undefined) o[f.name] = f.type === "boolean" ? false : f.type === "tags" ? [] : ""; });
  return o;
};

function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr("");
    try { const { url } = await api.upload(file); onChange(url); }
    catch (e) { setErr(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="adm-uploader">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt="" /> : <div style={{ width: 88, height: 60, borderRadius: 9, border: "1px dashed var(--line-2)" }} />}
      <div>
        <button type="button" className="adm-btn ghost" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </button>
        {value && <button type="button" className="adm-btn ghost" style={{ marginLeft: 8 }} onClick={() => onChange("")}>Remove</button>}
        {err && <div className="adm-msg err" style={{ marginTop: 8 }}>{err}</div>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    </div>
  );
}

export default function ResourceManager({ resource, title, subtitle, columns, fields, defaults }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const PER_PAGE = 10;

  useEffect(() => { setPage(1); }, [query, sortKey, sortDir]);

  async function load() {
    setLoading(true); setError("");
    try { setRows(await api.list(resource)); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resource]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormErr("");
    try {
      const payload: Record<string, any> = { ...editing };
      // empty strings → null so blank dates/optionals don't fail validation
      Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
      const editingItem = editing?.id;
      if (editingItem) await api.update(resource, editing.id, payload);
      else await api.create(resource, payload);
      setEditing(null);
      await load();
      toast(editingItem ? "Changes saved" : "Item created");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setFormErr(msg); toast(msg, "err");
    }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await api.remove(resource, deleteTarget.id); setDeleteTarget(null); await load(); toast("Item deleted"); }
    catch (e) { toast(e instanceof Error ? e.message : "Delete failed", "err"); }
    finally { setDeleting(false); }
  }

  const toggleSort = (name: string) => {
    if (sortKey === name) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(name); setSortDir("asc"); }
  };

  const filtered = query
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(query.toLowerCase()))
    : rows;

  const sortVal = (r: any) => { const v = r[sortKey]; return Array.isArray(v) ? v.join(",") : v; };
  const sorted = !sortKey ? filtered : [...filtered].sort((a, b) => {
    const av = sortVal(a), bv = sortVal(b);
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av ?? "").localeCompare(String(bv ?? ""));
    return sortDir === "asc" ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pageSafe = Math.min(page, totalPages);
  const paged = sorted.slice((pageSafe - 1) * PER_PAGE, pageSafe * PER_PAGE);

  const setField = (name: string, value: any) => setEditing((s) => ({ ...(s || {}), [name]: value }));

  return (
    <>
      <div className="adm-top">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label className="adm-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /></svg>
            <input placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button className="adm-btn primary" onClick={() => { setFormErr(""); setEditing(emptyFrom(fields, defaults)); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
            New
          </button>
        </div>
      </div>

      {error && <div className="adm-msg err">{error}</div>}

      <div className="adm-panel">
        {loading ? (
          <div className="adm-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="adm-empty">No items yet. Click “New” to add one.</div>
        ) : sorted.length === 0 ? (
          <div className="adm-empty">No matches for “{query}”.</div>
        ) : (
          <>
          <table className="adm-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>#</th>
                {columns.map((c) => (
                  <th key={c.name} className={c.type !== "image" ? "adm-th-sort" : ""}
                    onClick={() => c.type !== "image" && toggleSort(c.name)}>
                    {c.label}
                    {sortKey === c.name && <span className="ar">{sortDir === "asc" ? "▲" : "▼"}</span>}
                  </th>
                ))}
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row, i) => (
                <tr key={row.id}>
                  <td style={{ color: "var(--muted-2)", fontVariantNumeric: "tabular-nums" }}>{(pageSafe - 1) * PER_PAGE + i + 1}</td>
                  {columns.map((c) => (
                    <td key={c.name}>
                      {c.type === "image" ? (
                        row[c.name]
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img className="adm-thumb" src={row[c.name]} alt="" />
                          : <span style={{ color: "var(--muted-2)" }}>—</span>
                      ) : c.type === "status" ? (
                        <span className={"adm-badge " + (row[c.name] || "published")}>{row[c.name]}</span>
                      ) : c.type === "tags" ? (
                        (Array.isArray(row[c.name]) ? row[c.name] : []).slice(0, 3).join(", ")
                      ) : (
                        String(row[c.name] ?? "").slice(0, 60)
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="adm-rowbtns">
                      <button className="adm-ibtn" data-tip="Edit" onClick={() => { setFormErr(""); setEditing({ ...row }); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                      </button>
                      <button className="adm-ibtn danger" data-tip="Delete" onClick={() => setDeleteTarget(row)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length > PER_PAGE && (
            <div className="adm-pager">
              <span>Showing {(pageSafe - 1) * PER_PAGE + 1}–{Math.min(pageSafe * PER_PAGE, sorted.length)} of {sorted.length}</span>
              <div className="pg">
                <button disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>Prev</button>
                <span>Page {pageSafe} / {totalPages}</span>
                <button disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>Next</button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {editing && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="adm-drawer" onSubmit={save}>
            <h2>{editing.id ? "Edit" : "New"} {title.replace(/s$/, "")}</h2>
            <p className="sub">{editing.id ? `ID #${editing.id}` : "Create a new item"}</p>
            {formErr && <div className="adm-msg err">{formErr}</div>}
            {fields.map((f) => (
              <div className="adm-field" key={f.name}>
                <label htmlFor={f.name}>{f.label}</label>
                {f.type === "richtext" ? (
                  <RichText key={String(editing.id ?? "new") + f.name} value={editing[f.name] ?? ""} onChange={(v) => setField(f.name, v)} />
                ) : f.type === "textarea" ? (
                  <textarea id={f.name} value={editing[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => setField(f.name, e.target.value)} />
                ) : f.type === "select" ? (
                  <select id={f.name} value={editing[f.name] ?? ""} onChange={(e) => setField(f.name, e.target.value)}>
                    {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "boolean" ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!editing[f.name]} onChange={(e) => setField(f.name, e.target.checked)} style={{ width: 18, height: 18 }} />
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>{f.placeholder || "Enabled"}</span>
                  </label>
                ) : f.type === "tags" ? (
                  <input id={f.name} value={Array.isArray(editing[f.name]) ? editing[f.name].join(", ") : (editing[f.name] ?? "")}
                    placeholder={f.placeholder || "comma, separated, tags"}
                    onChange={(e) => setField(f.name, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
                ) : f.type === "image" ? (
                  <ImageInput value={editing[f.name] ?? ""} onChange={(v) => setField(f.name, v)} />
                ) : (
                  <input id={f.name} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={f.type === "date" ? String(editing[f.name] ?? "").slice(0, 10) : (editing[f.name] ?? "")} placeholder={f.placeholder}
                    onChange={(e) => setField(f.name, f.type === "number" ? Number(e.target.value) : e.target.value)} />
                )}
              </div>
            ))}
            <div className="adm-drawer-actions">
              <button className="adm-btn primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              <button className="adm-btn ghost" type="button" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div className="adm-confirm">
            <div className="adm-confirm-ic">
              <svg viewBox="0 0 24 24" width={22} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </div>
            <h3>Delete this {title.replace(/s$/, "").toLowerCase()}?</h3>
            <p>{deleteTarget.title || deleteTarget.name || `Item #${deleteTarget.id}`} will be permanently removed. This can&apos;t be undone.</p>
            <div className="adm-confirm-actions">
              <button className="adm-btn ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="adm-btn danger" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
