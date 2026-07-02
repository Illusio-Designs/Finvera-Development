"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
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
      if (editing?.id) await api.update(resource, editing.id, payload);
      else await api.create(resource, payload);
      setEditing(null);
      await load();
    } catch (e) { setFormErr(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    try { await api.remove(resource, id); await load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
  }

  const setField = (name: string, value: any) => setEditing((s) => ({ ...(s || {}), [name]: value }));

  return (
    <>
      <div className="adm-top">
        <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
        <button className="adm-btn primary" onClick={() => { setFormErr(""); setEditing(emptyFrom(fields, defaults)); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 5v14M5 12h14" /></svg>
          New
        </button>
      </div>

      {error && <div className="adm-msg err">{error}</div>}

      <div className="adm-panel">
        {loading ? (
          <div className="adm-empty">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="adm-empty">No items yet. Click “New” to add one.</div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>{columns.map((c) => <th key={c.name}>{c.label}</th>)}<th style={{ textAlign: "right" }}>Actions</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
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
                      <button className="adm-ibtn" title="Edit" onClick={() => { setFormErr(""); setEditing({ ...row }); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                      </button>
                      <button className="adm-ibtn danger" title="Delete" onClick={() => del(row.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </>
  );
}
