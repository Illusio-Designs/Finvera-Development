"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";

export default function AdminContact() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<any | null>(null);

  async function load() {
    setLoading(true); setError("");
    try { setRows(await api.listContact()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggle(m: any) {
    try { await api.markContact(m.id, !m.isRead); await load(); } catch { /* */ }
  }
  async function del(id: number) {
    if (!(await dialog.confirm({ title: "Delete this message?", message: "This can't be undone.", danger: true, confirmText: "Delete" }))) return;
    try { await api.removeContact(id); setOpen(null); await load(); } catch { /* */ }
  }

  return (
    <>
      <div className="adm-top">
        <div><h1>Contact inbox</h1><p>Messages submitted from the website contact form.</p></div>
      </div>
      {error && <div className="adm-msg err">{error}</div>}
      <div className="adm-panel">
        {loading ? <div className="adm-empty">Loading…</div>
          : rows.length === 0 ? <div className="adm-empty">No messages yet.</div>
          : (
            <table className="adm-table">
              <thead><tr><th style={{ width: 44 }}>#</th><th>From</th><th>Email</th><th>Project</th><th>Received</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.id} style={{ fontWeight: m.isRead ? 400 : 600 }}>
                    <td style={{ color: "var(--muted-2)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                    <td>{m.name}</td>
                    <td>{m.email}</td>
                    <td>{m.projectType || "—"}</td>
                    <td style={{ color: "var(--muted-2)" }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                    <td><span className={"adm-badge " + (m.isRead ? "published" : "draft")}>{m.isRead ? "read" : "new"}</span></td>
                    <td>
                      <div className="adm-rowbtns">
                        <button className="adm-ibtn" title="View" onClick={() => setOpen(m)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>
                        <button className="adm-ibtn danger" title="Delete" onClick={() => del(m.id)}>
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

      {open && (
        <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="adm-drawer">
            <h2>{open.name}</h2>
            <p className="sub">{open.email}{open.company ? ` · ${open.company}` : ""}</p>
            <div className="adm-field"><label>Project type</label><div style={{ color: "var(--muted)" }}>{open.projectType || "—"}</div></div>
            <div className="adm-field"><label>Message</label>
              <div style={{ color: "var(--ink)", lineHeight: 1.7, whiteSpace: "pre-wrap", background: "rgba(255,255,255,.03)", border: "1px solid var(--line-2)", borderRadius: 10, padding: 14 }}>{open.message}</div>
            </div>
            <div className="adm-field"><label>Received</label><div style={{ color: "var(--muted-2)" }}>{new Date(open.createdAt).toLocaleString()}</div></div>
            <div className="adm-drawer-actions">
              <a className="adm-btn primary" href={`mailto:${open.email}`}>Reply by email</a>
              <button className="adm-btn ghost" onClick={() => toggle(open).then(() => setOpen({ ...open, isRead: !open.isRead }))}>
                Mark {open.isRead ? "unread" : "read"}
              </button>
              <button className="adm-btn ghost" onClick={() => del(open.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
