"use client";
import { useEffect, useState } from "react";
import { api, opsApi } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import ExportButton from "@/components/admin/ExportButton";

export default function AdminContact() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<any | null>(null);
  // Spam view (?spam=1): suspected spam is kept out of the inbox and listed here.
  const [spam, setSpam] = useState<boolean | null>(null);
  const [spamCount, setSpamCount] = useState<number | null>(null);

  async function load(view = spam) {
    if (view == null) return;
    setLoading(true); setError("");
    try { setRows(await (view ? opsApi.listSpam() : api.listContact())); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
    opsApi.spamCount().then(setSpamCount).catch(() => {});
  }
  useEffect(() => { setSpam(new URLSearchParams(window.location.search).get("spam") === "1"); }, []);
  useEffect(() => { load(spam); }, [spam]); // eslint-disable-line react-hooks/exhaustive-deps
  /* Deep link from the dashboard home: /dashboard/contact?msg=ID opens that message once. */
  const [wantMsg, setWantMsg] = useState<number | null>(null);
  useEffect(() => { const id = Number(new URLSearchParams(window.location.search).get("msg")); if (id) setWantMsg(id); }, []);
  useEffect(() => {
    if (!wantMsg || loading) return;
    const m = rows.find((r) => Number(r.id) === wantMsg);
    setWantMsg(null);
    window.history.replaceState(null, "", window.location.pathname + (spam ? "?spam=1" : ""));
    if (m) setOpen(m); else toast("That message isn't in the inbox any more", "warn", { description: "It may have been deleted or moved to spam." });
  }, [wantMsg, loading, rows, spam]);
  function showSpam(on: boolean) {
    if (on === spam) return;
    setRows([]); setOpen(null); setSpam(on);
    window.history.replaceState(null, "", on ? "?spam=1" : window.location.pathname);
  }
  async function flagSpam(m: any, isSpam: boolean) {
    try {
      await opsApi.setSpam(m.id, isSpam);
      toast(isSpam ? "Moved to spam" : "Moved back to the inbox", "ok", { description: m.name, sound: false });
      setOpen(null); await load(); window.dispatchEvent(new Event("fv-badges"));
    } catch (e) { toast("Couldn't change it", "err", { description: e instanceof Error ? e.message : "" }); }
  }

  async function toggle(m: any) {
    try { await api.markContact(m.id, !m.isRead); await load(); window.dispatchEvent(new Event("fv-badges")); } catch { /* */ }
  }
  async function del(id: number) {
    if (!(await dialog.confirm({ title: "Delete this message?", message: "This can't be undone.", danger: true, confirmText: "Delete" }))) return;
    try { await api.removeContact(id); setOpen(null); await load(); window.dispatchEvent(new Event("fv-badges")); } catch { /* */ }
  }

  return (
    <>
      <div className="adm-top">
        <div><h1>Contact inbox</h1><p>Messages submitted from the website contact form.</p></div>
        <ExportButton entity="contact" file="contact-inbox" sheet="Contact inbox" label="Export to Excel" />
      </div>
      {error && <div className="adm-msg err">{error}</div>}
      <div className="ops-tabs" role="tablist" aria-label="Messages">
        <button type="button" role="tab" aria-selected={spam === false} className={spam === false ? "on" : ""} onClick={() => showSpam(false)}>Inbox</button>
        <button type="button" role="tab" aria-selected={spam === true} className={spam ? "on" : ""} onClick={() => showSpam(true)}>Spam{spamCount != null && <small>{spamCount}</small>}</button>
      </div>
      {spam && <p style={{ color: "var(--muted-2)", fontSize: 13, margin: "-4px 0 12px" }}>Messages that looked like spam. No one was notified about them. Click “Not spam” to move one back to the inbox.</p>}
      <div className="adm-panel">
        {loading ? <div className="adm-empty">Loading…</div>
          : rows.length === 0 ? <div className="adm-empty">{spam ? "No spam. Nice and clean." : "No messages yet."}</div>
          : (
            <table className="adm-table cardify">
              <thead><tr><th style={{ width: 44 }}>#</th><th>From</th><th>Email</th><th>Project</th><th>Received</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.id} style={{ fontWeight: m.isRead ? 400 : 600 }}>
                    <td className="c-num" style={{ color: "var(--muted-2)", fontVariantNumeric: "tabular-nums" }}>{i + 1}</td>
                    <td className="c-primary">{m.name}{m.spamReason && <span className="ops-spamchip" title="Why it was flagged">{m.spamReason}</span>}</td>
                    <td data-label="Email">{m.email}</td>
                    <td data-label="Project">{m.projectType || "—"}</td>
                    <td data-label="Received" style={{ color: "var(--muted-2)" }}>{new Date(m.createdAt).toLocaleDateString()}</td>
                    <td data-label="Status"><span className={"adm-badge " + (m.isRead ? "published" : "draft")}>{m.isRead ? "read" : "new"}</span></td>
                    <td className="c-act">
                      <div className="adm-rowbtns">
                        <button className="adm-ibtn ops-ibtn-txt" title={spam ? "Move back to the inbox" : "Move to spam"} onClick={() => flagSpam(m, !spam)}>{spam ? "Not spam" : "Mark as spam"}</button>
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
            <p className="sub">{open.email}{open.company ? ` · ${open.company}` : ""}{open.spamReason && <span className="ops-spamchip">Spam: {open.spamReason}</span>}</p>
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
              <button className="adm-btn ghost" onClick={() => flagSpam(open, !open.isSpam)}>{open.isSpam ? "Not spam" : "Mark as spam"}</button>
              <button className="adm-btn ghost" onClick={() => del(open.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
