"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import RichText from "./RichText";
import CalendlyButton from "./CalendlyButton";
import Select from "../Select";
import DatePicker from "../ui/DatePicker";
import Toggle from "../ui/Toggle";
import Tooltip from "../ui/Tooltip";
import { TableSkeleton } from "./Skeleton";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "password" | "textarea" | "number" | "select" | "boolean" | "tags" | "image" | "avatar" | "date" | "richtext" | "calendly";
  options?: string[];
  placeholder?: string;
};
export type Column = { name: string; label: string; type?: "image" | "avatar" | "status" | "tags" | "text" | "money" | "progress" | "stageprogress" };

/* Pipeline stage → completion score. Drives the stage-based progress bar so the
   bar always reflects where a lead sits in the funnel (no manual % to keep in sync). */
export const STAGE_SCORE: Record<string, number> = {
  new: 10, contacted: 35, qualified: 60, proposal: 85, won: 100, lost: 0,
};
const stageScore = (stage: string) => STAGE_SCORE[String(stage || "").toLowerCase()] ?? 0;

type Props = {
  resource: string;
  title: string;
  subtitle?: string;
  columns: Column[];
  fields: Field[];
  defaults?: Record<string, any>;
  calendlyUrl?: string;
  backHref?: string;
  backLabel?: string;
};

const emptyFrom = (fields: Field[], defaults?: Record<string, any>) => {
  const o: Record<string, any> = { ...defaults };
  fields.forEach((f) => { if (o[f.name] === undefined) o[f.name] = f.type === "boolean" ? false : f.type === "tags" ? [] : ""; });
  return o;
};

function ImageInput({ value, onChange, round }: { value: string; onChange: (v: string) => void; round?: boolean }) {
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
    <div className={"adm-uploader" + (round ? " round" : "")}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt="" /> : (
        <div className="up-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
        </div>
      )}
      <div>
        <button type="button" className="adm-btn ghost" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <><span className="spin" style={{ borderColor: "rgba(62,96,171,.35)", borderTopColor: "var(--blue-500)" }} /> Uploading…</> : value ? "Replace" : "Upload"}
        </button>
        {value && <button type="button" className="adm-btn ghost" style={{ marginLeft: 8 }} onClick={() => onChange("")}>Remove</button>}
        {err && <div className="adm-msg err" style={{ marginTop: 8 }}>{err}</div>}
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
      </div>
    </div>
  );
}

function PasswordInput({ id, value, placeholder, onChange }: { id: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="adm-pass">
      <input id={id} type={show ? "text" : "password"} value={value} placeholder={placeholder} autoComplete="new-password"
        onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="adm-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} title={show ? "Hide" : "Show"}>
        {show ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
        )}
      </button>
    </div>
  );
}

export default function ResourceManager({ resource, title, subtitle, columns, fields, defaults, calendlyUrl, backHref, backLabel }: Props) {
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
      {backHref && (
        <Link href={backHref} className="adm-back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          {backLabel || "Back"}
        </Link>
      )}
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
          <TableSkeleton rows={6} cols={Math.max(2, columns.length)} />
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
                      {c.type === "image" || c.type === "avatar" ? (
                        row[c.name]
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img className={c.type === "avatar" ? "adm-avatar-cell" : "adm-thumb"} src={row[c.name]} alt="" />
                          : (c.type === "avatar"
                              ? <span className="adm-avatar-cell adm-avatar-fb">{String(row.name || row.title || "?").slice(0, 1).toUpperCase()}</span>
                              : <span style={{ color: "var(--muted-2)" }}>—</span>)
                      ) : c.type === "status" ? (
                        <span className={"adm-badge " + (row[c.name] || "published")}>{row[c.name]}</span>
                      ) : c.type === "tags" ? (
                        (Array.isArray(row[c.name]) ? row[c.name] : []).slice(0, 3).join(", ")
                      ) : c.type === "money" ? (
                        Number(row[c.name]) ? `₹${Number(row[c.name]).toLocaleString("en-IN")}` : <span style={{ color: "var(--muted-2)" }}>—</span>
                      ) : c.type === "progress" ? (
                        <span className="adm-progress"><span className="adm-progress-track"><span className="adm-progress-fill" style={{ width: `${Math.max(0, Math.min(100, Number(row[c.name]) || 0))}%` }} /></span><b>{Math.max(0, Math.min(100, Number(row[c.name]) || 0))}%</b></span>
                      ) : c.type === "stageprogress" ? (
                        <span className="adm-progress"><span className="adm-progress-track"><span className={"adm-progress-fill st-" + String(row.stage || "new").toLowerCase()} style={{ width: `${stageScore(row.stage)}%` }} /></span><b>{stageScore(row.stage)}%</b></span>
                      ) : (
                        String(row[c.name] ?? "").slice(0, 60)
                      )}
                    </td>
                  ))}
                  <td>
                    <div className="adm-rowbtns">
                      <Tooltip label="Edit">
                        <button className="adm-ibtn" aria-label="Edit" onClick={() => { setFormErr(""); setEditing({ ...row }); }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete">
                        <button className="adm-ibtn danger" aria-label="Delete" onClick={() => setDeleteTarget(row)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                        </button>
                      </Tooltip>
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
                  <Select id={f.name} value={editing[f.name] ?? ""} onChange={(v) => setField(f.name, v)}
                    options={f.options || []} ariaLabel={f.label} />
                ) : f.type === "boolean" ? (
                  <Toggle checked={!!editing[f.name]} onChange={(v) => setField(f.name, v)} label={f.placeholder || "Enabled"} />
                ) : f.type === "tags" ? (
                  <input id={f.name} value={Array.isArray(editing[f.name]) ? editing[f.name].join(", ") : (editing[f.name] ?? "")}
                    placeholder={f.placeholder || "comma, separated, tags"}
                    onChange={(e) => setField(f.name, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
                ) : f.type === "image" ? (
                  <ImageInput value={editing[f.name] ?? ""} onChange={(v) => setField(f.name, v)} />
                ) : f.type === "avatar" ? (
                  <ImageInput round value={editing[f.name] ?? ""} onChange={(v) => setField(f.name, v)} />
                ) : f.type === "password" ? (
                  <PasswordInput id={f.name} value={editing[f.name] ?? ""} placeholder={f.placeholder} onChange={(v) => setField(f.name, v)} />
                ) : f.type === "calendly" ? (
                  <CalendlyButton url={calendlyUrl} name={editing.name} email={editing.email} />
                ) : f.type === "date" ? (
                  <DatePicker id={f.name} name={f.name} value={String(editing[f.name] ?? "").slice(0, 10)}
                    onChange={(v) => setField(f.name, v)} placeholder={f.placeholder || "Select a date"} />
                ) : (
                  <input id={f.name} type={f.type === "number" ? "number" : "text"}
                    value={editing[f.name] ?? ""} placeholder={f.placeholder}
                    onChange={(e) => setField(f.name, f.type === "number" ? Number(e.target.value) : e.target.value)} />
                )}
              </div>
            ))}
            <div className="adm-drawer-actions">
              <button className="adm-btn primary" type="submit" disabled={saving}>{saving ? <><span className="spin" /> Saving…</> : "Save"}</button>
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
              <button className="adm-btn danger" onClick={confirmDelete} disabled={deleting}>{deleting ? <><span className="spin" /> Deleting…</> : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
