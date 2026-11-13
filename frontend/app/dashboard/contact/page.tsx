"use client";
import { useSaveWorkflow } from "@/lib/useSaveWorkflow";
import PageLoading from "@/components/admin/PageLoading";
import "./inbox.css";
import "./inbox-workspace.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon, Cancel01Icon, ArrowLeft01Icon, Copy01Icon, CallIcon, WhatsappIcon, Delete02Icon, MailReply01Icon,
  MailSend01Icon, Target02Icon, Alert02Icon, InboxIcon, SpamIcon, MailOpen01Icon, Mail01Icon, Refresh01Icon,
  ArrowUpRight01Icon, CheckmarkCircle02Icon, InboxUnreadIcon, LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { API_BASE, getToken, inboxApi, opsApi, type ContactMsg, type ContactReply, type InboxCounts } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { useShell } from "@/components/admin/shell/ShellContext";
import { rolesCan } from "@/lib/permissions";
import ExportButton from "@/components/admin/ExportButton";
import HistoryList from "@/components/admin/HistoryList";
import { initials, avatarColor } from "@/lib/activityText";

/* Contact inbox: a mail-style list (All / Unread / Spam, search, paging)
   with a reading pane. Opening a message marks it read; from the pane you
   can reply by email, convert it to a lead, flag spam or delete it (with
   Undo — the DELETE is only sent once the toast's undo window has passed).
   On phones the list and the message take turns. Deep links: ?msg=ID opens
   a message, ?spam=1 opens the Spam tab. Keys: j/k or ↑/↓ move, e toggles
   read, Esc closes. */

type Ic = typeof Mail01Icon;
const I = ({ i, size = 17 }: { i: Ic; size?: number }) => <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} className="hgi" />;
type ReplyDraft = { subject: string; text: string };
type View = "all" | "unread" | "spam";
const PAGE = 50;
const UNDO_MS = 6000;
const TZ = "Asia/Kolkata";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/* "now", "12 min", "2 h", "Yesterday", "26 Oct", "26 Oct 2025". */
const dayKey = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
function shortTime(iso: string) {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = (Date.now() - t) / 1000;
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  const today = dayKey(Date.now());
  if (dayKey(t) === today) return `${Math.floor(s / 3600)} h`;
  if (dayKey(t) === dayKey(Date.now() - 864e5)) return "Yesterday";
  const sameYear = dayKey(t).slice(0, 4) === today.slice(0, 4);
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: TZ });
}
const fullTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
/* WhatsApp wants digits with the country code: a bare 10-digit Indian number gets 91. */
function waDigits(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = "91" + d;
  return d;
}
const telOf = (phone: string) => phone.replace(/[^\d+]/g, "");
const snippet = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
const firstName = (n: string) => String(n || "").split(/\s+/)[0] || "there";

async function copy(text: string, what: string) {
  try { await navigator.clipboard.writeText(text); toast(`${what} copied`, "ok", { description: text.length > 80 ? text.slice(0, 80) + "…" : text, sound: false }); }
  catch { toast(`Copy the ${what.toLowerCase()} by hand`, "info", { description: text.slice(0, 120) }); }
}

const TEMPLATES: { label: string; text: (m: ContactMsg) => string }[] = [
  { label: "Thanks — we'll call you", text: (m) => `Thanks for getting in touch! We've read your message and someone from our team will call you within one working day${m.phone ? ` on ${m.phone}` : ""}.\n\nIf there's a better time to reach you, just reply to this email.` },
  { label: "Please share more details", text: () => "Thanks for reaching out. To give you an accurate plan and estimate, could you share a little more?\n\n• What you'd like to build and who will use it\n• Any examples you like\n• Your timeline and budget range" },
  { label: "Here's our availability", text: () => "Thanks for your message — we'd love to talk. We're available Monday to Friday, 10 am – 7 pm IST.\n\nLet us know a slot that suits you and we'll send a calendar invite." },
];

export default function AdminContact() {
  const { roles } = useShell();
  const canLeads = rolesCan(roles, "leads");
  const [view, setView] = useState<View | null>(null);
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [rows, setRows] = useState<ContactMsg[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<InboxCounts | null>(null);
  const [sel, setSel] = useState<ContactMsg | null>(null);
  const [wantMsg, setWantMsg] = useState<number | null>(null);
  const pending = useRef(new Map<number, { timer: ReturnType<typeof setTimeout>; msg: ContactMsg }>());
  const listRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLElement>(null);
  const loadSeq = useRef(0);
  const [drafts, setDrafts] = useState<Record<number, ReplyDraft>>({});
  const readPending = useRef(new Set<number>());
  const [readBusy, setReadBusy] = useState<number[]>([]);
  const [actionError, setActionError] = useState("");

  const badges = () => window.dispatchEvent(new Event("fv-badges"));
  const hidden = (m: ContactMsg) => pending.current.has(m.id);

  const loadCounts = useCallback(async () => {
    try { setCounts(await inboxApi.counts()); }
    catch {
      // Older API without /contact/counts: three one-row pages carry the totals.
      try {
        const [a, u, s] = await Promise.all([inboxApi.list({ limit: 1 }), inboxApi.list({ limit: 1, unread: true }), opsApi.spamCount()]);
        setCounts({ all: a.total, unread: u.total, spam: s });
      } catch { /* counts stay hidden */ }
    }
  }, []);

  const load = useCallback(async (v: View, query: string, p = 1) => {
    const seq = ++loadSeq.current;
    if (p === 1) { setLoading(true); setError(""); } else setMore(true);
    try {
      const r = await inboxApi.list({ page: p, limit: PAGE, q: query, unread: v === "unread", spam: v === "spam" });
      if (seq !== loadSeq.current) return;
      const items = Array.isArray(r) ? (r as unknown as ContactMsg[]) : r.items || [];
      setRows((old) => (p === 1 ? items : [...old, ...items.filter((x) => !old.some((o) => o.id === x.id))]));
      setTotal(Array.isArray(r) ? items.length : Number(r.total) || 0);
      setPage(p);
    } catch (e) { if (seq === loadSeq.current) { if (p === 1) setError(errMsg(e)); else toast("Couldn't load more", "err", { description: errMsg(e) }); } }
    finally { if (seq === loadSeq.current) { setLoading(false); setMore(false); } }
  }, []);

  /* First load: view and message from the URL. */
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setView(sp.get("spam") === "1" ? "spam" : "all");
    const id = Number(sp.get("msg"));
    if (id) setWantMsg(id);
    loadCounts();
  }, [loadCounts]);
  /* Debounced search. */
  useEffect(() => { const t = setTimeout(() => setQ(qLive), 300); return () => clearTimeout(t); }, [qLive]);
  useEffect(() => { if (view) load(view, q, 1); }, [view, q, load]);

  const syncUrl = useCallback((v: View | null, msgId: number | null) => {
    const sp = new URLSearchParams();
    if (v === "spam") sp.set("spam", "1");
    if (msgId) sp.set("msg", String(msgId));
    const s = sp.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (s ? `?${s}` : ""));
  }, []);

  /* Open a message: show it, mark it read (optimistically). */
  const open = useCallback((m: ContactMsg | null, focusPane = false) => {
    setSel(m);
    setActionError("");
    syncUrl(view, m?.id ?? null);
    if (!m) return;
    if (!m.isRead && !m.isSpam && !readPending.current.has(m.id)) {
      readPending.current.add(m.id); setReadBusy([...readPending.current]);
      const upd = { ...m, isRead: true };
      setSel(upd);
      setRows((rs) => rs.map((r) => (r.id === m.id ? upd : r)));
      setCounts((c) => (c ? { ...c, unread: Math.max(0, c.unread - 1) } : c));
      inboxApi.setRead(m.id, true).then(() => {
        badges();
      }).catch((e) => {
        setRows((rs) => rs.map((r) => (r.id === m.id ? { ...r, isRead: false } : r)));
        setSel((current) => current?.id === m.id ? { ...current, isRead: m.isRead } : current);
        setActionError(`Couldn’t mark the message read: ${errMsg(e)}`);
        loadCounts();
      }).finally(() => { readPending.current.delete(m.id); setReadBusy([...readPending.current]); });
    }
    if (focusPane) requestAnimationFrame(() => readRef.current?.focus({ preventScroll: true }));
    if (window.matchMedia("(max-width: 860px)").matches) window.scrollTo({ top: 0 });
  }, [view, syncUrl, loadCounts]);

  /* ?msg=ID: open it once the list is in (fetch it if it's not on the first page). */
  useEffect(() => {
    if (!wantMsg || loading || !view) return;
    const id = wantMsg;
    setWantMsg(null);
    const m = rows.find((r) => r.id === id);
    if (m) { open(m); return; }
    inboxApi.get(id).then((x) => {
      if (x.isSpam && view !== "spam") { setView("spam"); setRows([]); }
      open(x);
    }).catch(() => {
      syncUrl(view, null);
      toast("That message isn't in the inbox any more", "warn", { description: "It may have been deleted." });
    });
  }, [wantMsg, loading, rows, view, open, syncUrl]);

  function switchView(v: View) {
    if (v === view) return;
    setRows([]); setSel(null); setView(v); syncUrl(v, null);
  }
  const patchRow = (m: ContactMsg) => { setRows((rs) => rs.map((r) => (r.id === m.id ? { ...r, ...m } : r))); setSel((s) => (s && s.id === m.id ? { ...s, ...m } : s)); };
  /* Drop from the list (and move the selection to the next row on desktop). */
  const dropRow = (id: number) => {
    const visible = rows.filter((r) => !hidden(r));
    const i = visible.findIndex((r) => r.id === id);
    const next = visible[i + 1] || visible[i - 1] || null;
    setRows((rs) => rs.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    if (sel?.id === id) {
      const desktop = !window.matchMedia("(max-width: 860px)").matches;
      if (desktop && next) open(next); else open(null);
    }
  };

  async function setRead(m: ContactMsg, isRead: boolean) {
    if (readPending.current.has(m.id) || !!m.isRead === isRead) return;
    readPending.current.add(m.id); setReadBusy([...readPending.current]); setActionError("");
    patchRow({ ...m, isRead });
    setCounts((c) => (c ? { ...c, unread: Math.max(0, c.unread + (isRead ? -1 : 1)) } : c));
    try { await inboxApi.setRead(m.id, isRead); badges(); if (!isRead) toast("Marked as unread", "ok", { description: m.name, sound: false }); }
    catch (e) { patchRow(m); loadCounts(); setActionError(errMsg(e)); toast("Couldn't change it", "err", { description: errMsg(e) }); }
    finally { readPending.current.delete(m.id); setReadBusy([...readPending.current]); }
  }

  async function flagSpam(m: ContactMsg, isSpam: boolean) {
    try {
      await opsApi.setSpam(m.id, isSpam);
      dropRow(m.id);
      toast(isSpam ? "Moved to spam" : "Moved back to the inbox", "ok", { description: m.name, sound: false });
      loadCounts(); badges();
    } catch (e) { toast("Couldn't change it", "err", { description: errMsg(e) }); }
  }

  /* Delete with Undo: hide now, DELETE after the undo window. */
  const flush = useCallback((id: number) => {
    const p = pending.current.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.current.delete(id);
    inboxApi.remove(id).then(() => { loadCounts(); badges(); }).catch((e) => {
      toast("Couldn't delete the message", "err", { description: errMsg(e) });
      if (view) load(view, q, 1);
    });
  }, [loadCounts, load, view, q]);
  function del(m: ContactMsg) {
    dropRow(m.id);
    const timer = setTimeout(() => flush(m.id), UNDO_MS + 300);
    pending.current.set(m.id, { timer, msg: m });
    setCounts((c) => (c ? { ...c, all: m.isSpam ? c.all : Math.max(0, c.all - 1), unread: !m.isSpam && !m.isRead ? Math.max(0, c.unread - 1) : c.unread, spam: m.isSpam ? Math.max(0, c.spam - 1) : c.spam } : c));
    toast("Message deleted", "ok", {
      description: `From ${m.name}`, sound: false, duration: UNDO_MS,
      action: { label: "Undo", onClick: () => {
        const p = pending.current.get(m.id);
        if (!p) return;
        clearTimeout(p.timer); pending.current.delete(m.id);
        setRows((rs) => [...rs, m].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id));
        setTotal((t) => t + 1);
        loadCounts();
        open(m);
      } },
    });
  }
  /* Leaving the page (or closing the tab) inside the undo window still deletes. */
  useEffect(() => {
    const map = pending.current;
    const onHide = () => {
      for (const [id, p] of map) {
        clearTimeout(p.timer);
        try { fetch(`${API_BASE}/api/contact/${id}`, { method: "DELETE", keepalive: true, headers: { Authorization: `Bearer ${getToken() || ""}` } }); } catch { /* */ }
      }
      map.clear();
    };
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); onHide(); };
  }, []);

  async function toLead(m: ContactMsg) {
    try {
      const r = await inboxApi.toLead(m.id);
      patchRow(r.contact);
      loadCounts(); badges();
      toast(r.created ? "Lead created" : "Already a lead", "ok", {
        description: r.created ? `${m.name} added to New` : m.name,
        action: canLeads ? { label: "Open lead", onClick: () => { window.location.href = `/dashboard/leads?lead=${r.lead.id}`; } } : undefined,
      });
    } catch (e) { toast("Couldn't create the lead", "err", { description: errMsg(e) }); }
  }

  const visible = useMemo(() => rows.filter((r) => !pending.current.has(r.id)), [rows]);

  /* Keyboard: j/k or ↑/↓ open the next / previous message, e toggles read, Esc closes. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector(".sh-cmd, .sh-scrim2, [role=dialog]")) return;
      const i = sel ? visible.findIndex((r) => r.id === sel.id) : -1;
      const k = e.key;
      if (k === "j" || k === "ArrowDown" || k === "k" || k === "ArrowUp") {
        const n = k === "j" || k === "ArrowDown" ? Math.min(visible.length - 1, i + 1) : Math.max(0, i - 1);
        if (!visible[n] || n === i) return;
        e.preventDefault();
        open(visible[n]);
        requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>(`[data-id="${visible[n].id}"]`)?.scrollIntoView({ block: "nearest" }));
      } else if (k === "e" && sel && !sel.isSpam) { e.preventDefault(); setRead(sel, !sel.isRead); }
      else if (k === "Escape" && sel) { open(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const unread = counts?.unread ?? null;
  const tabs: { v: View; label: string; n: number | null | undefined; icon: Ic }[] = [
    { v: "all", label: "All", n: counts?.all, icon: InboxIcon },
    { v: "unread", label: "Unread", n: counts?.unread, icon: InboxUnreadIcon },
    { v: "spam", label: "Spam", n: counts?.spam, icon: SpamIcon },
  ];

  return (
    <div className={"ib inbox-workspace" + (sel ? " ib-reading" : "")}>
      <header className="ib-head">
        <div className="ib-head-tx">
          <div className="td-eyebrow">EVERY CONVERSATION COUNTS</div>
          <h1>Contact inbox</h1>
          <p>Turn incoming messages into the right next step.</p>
        </div>
        <div className="ib-head-acts">
          {unread != null && <span className={"sh-pill nodot " + (unread ? "blue" : "green")}>{unread ? plural(unread, "unread message") : "All read"}</span>}
          <ExportButton entity="contact" file="contact-inbox" sheet="Contact inbox" label="Export" className="ib-export" params={{ q: q.trim() || undefined, unread: view === "unread" ? 1 : undefined, spam: view === "spam" ? 1 : undefined }} />
        </div>
      </header>

      {actionError && <div className="ib-action-error" role="alert">{actionError}</div>}
      {loading && !rows.length && !sel ? <PageLoading label="Loading contact inbox…" variant="list" /> : <div className={"ib-mail" + (sel ? " reading" : "")}>
        <aside className="ib-list" aria-label="Messages">
          <div className="ib-tools">
            <div className="ib-list-title"><b>Conversations</b><button type="button" className="sh-icb sm" aria-label="Refresh messages" disabled={loading} onClick={() => { if (view) load(view, q, 1); loadCounts(); }}><I i={Refresh01Icon} size={15} /></button></div>
            <div className="ib-seg" role="tablist" aria-label="Show">
              {tabs.map((t) => (
                <button key={t.v} type="button" role="tab" aria-selected={view === t.v} className={view === t.v ? "on" : ""} onClick={() => switchView(t.v)}>
                  {t.label}{t.n != null && <em>{t.n}</em>}
                </button>
              ))}
            </div>
            <label className="ib-search">
              <I i={Search01Icon} size={16} />
              <span className="sh-sr">Search messages</span>
              <input type="search" value={qLive} onChange={(e) => setQLive(e.target.value)} placeholder="Search messages" title="Search by name, email, company, phone or message" />
              {qLive && <button type="button" className="ib-x" aria-label="Clear search" onClick={() => setQLive("")}><I i={Cancel01Icon} size={14} /></button>}
            </label>
          </div>
          {view === "spam" && <p className="ib-note"><I i={Alert02Icon} size={15} />Messages held out of the inbox. Open one and choose “Not spam” to move it back.</p>}

          <div className="ib-rows" ref={listRef}>
            {loading && !rows.length ? (
              Array.from({ length: 6 }, (_, i) => <div key={i} className="ib-skel" aria-hidden><i /><span><b /><b /><b /></span></div>)
            ) : error ? (
              <div className="sh-empty err ib-empty" role="alert"><I i={Alert02Icon} size={20} /><b>Couldn&apos;t load the messages</b><span>{error}</span>
                <button type="button" className="sh-btn sm" onClick={() => view && load(view, q, 1)}><I i={Refresh01Icon} size={15} />Try again</button></div>
            ) : !visible.length ? (
              <div className="sh-empty ib-empty">
                <I i={q ? Search01Icon : view === "unread" ? CheckmarkCircle02Icon : view === "spam" ? SpamIcon : Mail01Icon} size={20} />
                <b>{q ? "No messages match" : view === "unread" ? "No unread messages" : view === "spam" ? "No spam" : "No messages yet"}</b>
                <span>{q ? `Nothing for “${q}”. Try a name, email or a word from the message.` : view === "unread" ? "You're all caught up." : view === "spam" ? "Nice and clean." : "Messages from the website contact form land here."}</span>
              </div>
            ) : (
              <>
                {visible.map((m) => {
                  const unreadRow = !m.isRead && !m.isSpam;
                  const sub = [m.company, m.projectType].filter(Boolean).join(" · ") || m.email;
                  return (
                    <button key={m.id} type="button" data-id={m.id} className={"ib-row" + (unreadRow ? " unread" : "") + (sel?.id === m.id ? " on" : "")}
                      aria-current={sel?.id === m.id ? "true" : undefined} onClick={() => open(m, true)}>
                      {unreadRow && <span className="ib-dot" aria-label="Unread" />}
                      <span className="sh-av ib-av" style={{ background: avatarColor(m.name) }} aria-hidden>{initials(m.name)}</span>
                      <span className="ib-row-tx">
                        <span className="ib-l1"><b>{m.name}</b><time dateTime={m.createdAt} title={fullTime(m.createdAt)}>{shortTime(m.createdAt)}</time></span>
                        <span className="ib-l2">{sub}</span>
                        <span className="ib-l3">{snippet(m.message)}</span>
                        {(m.leadId || m.spamReason || drafts[m.id]?.text) && (
                          <span className="ib-chips">
                            {drafts[m.id]?.text && <span className="sh-pill amber nodot">Draft</span>}
                            {m.leadId ? <span className="sh-pill violet nodot">Lead</span> : null}
                            {m.spamReason && <span className="sh-pill red nodot" title="Why it was flagged">{m.spamReason}</span>}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
                <div className="ib-more">
                  <span>{visible.length < total ? `Showing ${visible.length} of ${total}` : plural(total, "message")}</span>
                  {rows.length < total && view && (
                    <button type="button" className="sh-btn sm" disabled={more} onClick={() => load(view, q, page + 1)}>{more ? "Loading…" : "Load more"}</button>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        <section className="ib-read" ref={readRef} tabIndex={-1} aria-label={sel ? `Message from ${sel.name}` : "Message"}>
          {sel ? (
            <Reader key={sel.id} m={sel} canLeads={canLeads}
              onBack={() => open(null)} onRead={(r) => setRead(sel, r)} onSpam={(s) => flagSpam(sel, s)} onDelete={() => del(sel)}
              readBusy={readBusy.includes(sel.id)} draft={drafts[sel.id]} onDraft={(draft) => setDrafts((ds) => { const next = { ...ds }; if (draft) next[sel.id] = draft; else delete next[sel.id]; return next; })}
              onLead={() => toLead(sel)} onReplied={() => { if (!sel.isRead) patchRow({ ...sel, isRead: true }); loadCounts(); badges(); }} />
          ) : (
            <div className="sh-empty ib-pick"><I i={MailOpen01Icon} size={20} /><b>Pick a message to read it</b><span>Unread messages have a blue dot. Use j and k to move between them.</span></div>
          )}
        </section>
      </div>}
    </div>
  );
}

/* ── The reading pane ── */
function Reader({ m, canLeads, readBusy, draft, onDraft, onBack, onRead, onSpam, onDelete, onLead, onReplied }: {
  m: ContactMsg; canLeads: boolean; readBusy: boolean; draft?: ReplyDraft; onDraft: (draft: ReplyDraft | null) => void; onBack: () => void; onRead: (isRead: boolean) => void; onSpam: (isSpam: boolean) => void;
  onDelete: () => void; onLead: () => Promise<void>; onReplied: () => void;
}) {
  const [replying, setReplying] = useState(!!draft?.text);
  const [replies, setReplies] = useState<ContactReply[] | null>(null);
  const [busyLead, setBusyLead] = useState(false);
  const [histKey, setHistKey] = useState(0);
  const [repliesError, setRepliesError] = useState("");
  const loadReplies = useCallback(() => { setRepliesError(""); inboxApi.replies(m.id).then(setReplies).catch((e) => setRepliesError(errMsg(e))); }, [m.id]);
  useEffect(() => { loadReplies(); }, [loadReplies]);

  const phone = m.phone?.trim() || "";
  const wa = phone ? waDigits(phone) : "";
  return (
    <div className="ib-msg">
      <div className="ib-backbar"><button type="button" className="sh-btn sm" onClick={onBack}><I i={ArrowLeft01Icon} size={15} />Inbox</button></div>
      <div className="ib-rh">
        <span className="sh-av ib-av lg" style={{ background: avatarColor(m.name) }} aria-hidden>{initials(m.name)}</span>
        <div className="ib-rh-tx">
          <h2>{m.name}</h2>
          <p>{m.email} · <time dateTime={m.createdAt}>{fullTime(m.createdAt)}</time></p>
          {(m.spamReason || m.leadId) && (
            <div className="ib-chips">
              {m.spamReason && <span className="sh-pill red nodot">Spam: {m.spamReason}</span>}
              {m.leadId ? <span className="sh-pill violet nodot">Converted to a lead</span> : null}
            </div>
          )}
        </div>
        <div className="ib-rh-acts">
          {!m.isSpam && (
            <button type="button" className="sh-btn sm" disabled={readBusy} onClick={() => onRead(!m.isRead)} title="Keyboard: e">
              <I i={m.isRead ? Mail01Icon : MailOpen01Icon} size={15} />{m.isRead ? "Mark unread" : "Mark read"}
            </button>
          )}
          <button type="button" className="sh-btn sm" disabled={readBusy} onClick={() => onSpam(!m.isSpam)}><I i={m.isSpam ? InboxIcon : SpamIcon} size={15} />{m.isSpam ? "Not spam" : "Mark as spam"}</button>
          <button type="button" className="sh-icb sm ib-del" disabled={readBusy} onClick={onDelete} aria-label="Delete message" title="Delete"><I i={Delete02Icon} size={16} /></button>
        </div>
      </div>

      <div className="ib-reader-layout">
      <aside className="ib-context" aria-label="Sender details"><details open><summary>Sender details</summary><div className="ib-facts">
          <div className="ib-fact">
            <small>Email</small>
            <span className="ib-fact-v"><a href={`mailto:${m.email}`}>{m.email}</a>
              <button type="button" className="ib-mini" onClick={() => copy(m.email, "Email")} aria-label="Copy email" title="Copy email"><I i={Copy01Icon} size={14} /></button></span>
          </div>
          <div className="ib-fact">
            <small>Phone</small>
            {phone ? (
              <span className="ib-fact-v"><span>{phone}</span>
                <a className="ib-mini" href={`tel:${telOf(phone)}`} aria-label={`Call ${phone}`} title="Call"><I i={CallIcon} size={14} /></a>
                {wa.length >= 10 && <a className="ib-mini wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" title="WhatsApp"><I i={WhatsappIcon} size={14} /></a>}
              </span>
            ) : <span className="ib-fact-v muted">—</span>}
          </div>
          <div className="ib-fact"><small>Company</small><span className="ib-fact-v">{m.company || <span className="muted">—</span>}</span></div>
          <div className="ib-fact"><small>Project type</small><span className="ib-fact-v">{m.projectType || <span className="muted">—</span>}</span></div>
        </div>

        <HistoryList entity="contact" id={m.id} refreshKey={histKey} />
      </details></aside>
      <div className="ib-rb">
        <div className="ib-message-title"><span>WEBSITE ENQUIRY</span><h3>{m.projectType || "A new conversation"}</h3></div>
        {m.isSpam && <p className="ib-action-error">Restore this message with “Not spam” before replying or creating a lead.</p>}
        <div className="ib-body">{m.message}</div>

        <div className="ib-acts">
          {!replying && !m.isSpam && <button type="button" className="sh-btn pri" disabled={readBusy} onClick={() => setReplying(true)}><I i={MailReply01Icon} size={16} />Reply</button>}
          {m.leadId ? (
            canLeads ? <Link className="sh-btn" href={`/dashboard/leads?lead=${m.leadId}`}><I i={ArrowUpRight01Icon} size={16} />Open lead</Link>
              : <span className="sh-pill violet nodot">Lead #{m.leadId}</span>
          ) : (
            <button type="button" className="sh-btn" disabled={busyLead || readBusy || !!m.isSpam} onClick={async () => { setBusyLead(true); await onLead(); setBusyLead(false); setHistKey((k) => k + 1); }}>
              <I i={Target02Icon} size={16} />{busyLead ? "Creating…" : "Convert to lead"}
            </button>
          )}
          {phone && wa.length >= 10 && <a className="sh-btn" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer"><I i={WhatsappIcon} size={16} />WhatsApp</a>}
        </div>

        {replying && !m.isSpam && <Composer m={m} draft={draft} onDraft={onDraft} onClose={() => setReplying(false)} onAttempt={() => { loadReplies(); onReplied(); }} onSent={() => { onDraft(null); setReplying(false); loadReplies(); onReplied(); setHistKey((k) => k + 1); }} />}
        {repliesError && <div className="ib-action-error" role="alert">Couldn’t load replies: {repliesError}<button type="button" className="sh-btn sm" onClick={loadReplies}>Try again</button></div>}

        {!!replies?.length && (
          <section className="ib-replies" aria-label="Replies">
            <h3>Replies</h3>
            {replies.map((r) => (
              <article key={r.id} className={"ib-reply" + (r.sent ? "" : " failed")}>
                <header>
                  <span className="sh-av ib-av sm" style={{ background: avatarColor(r.userName || "?") }} aria-hidden>{initials(r.userName || "?")}</span>
                  <b>{r.userName || "Someone"}</b>
                  <span className="ib-reply-meta">{r.sent ? "emailed" : "not sent"} · <time dateTime={r.createdAt} title={fullTime(r.createdAt)}>{shortTime(r.createdAt)}</time></span>
                </header>
                {r.subject && <div className="ib-reply-sub">{r.subject}</div>}
                <div className="ib-reply-body">{r.message}</div>
                {!r.sent && r.error && <div className="ib-reply-err">{r.error}</div>}
              </article>
            ))}
          </section>
        )}

      </div></div>
    </div>
  );
}

/* ── Reply by email ── */
function Composer({ m, draft, onDraft, onClose, onSent, onAttempt }: { m: ContactMsg; draft?: ReplyDraft; onDraft: (draft: ReplyDraft | null) => void; onClose: () => void; onSent: () => void; onAttempt: () => void }) {
  const [subject, setSubject] = useState(draft?.subject ?? `Re: your enquiry to Finvera${m.projectType ? ` (${m.projectType})` : ""}`);
  const [text, setText] = useState(draft?.text || "");
  const { saving: busy, setSaving: setBusy, error: fallback, setError: setFallback } = useSaveWorkflow();
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ta.current?.focus(); }, []);
  const full = `Hi ${firstName(m.name)},\n\n${text.trim()}`;
  const mailto = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`;

  function applyTemplate(t: string) {
    const next = text.trim() ? `${text.replace(/\s+$/, "")}\n\n${t}` : t; setText(next); onDraft({ subject, text: next });
    requestAnimationFrame(() => ta.current?.focus());
  }
  async function send() {
    if (!text.trim() || busy) return;
    setBusy(true); setFallback("");
    try {
      const result = await inboxApi.reply(m.id, { subject, message: text.trim() });
      if (!result.emailed) throw new Error("The server did not confirm that the reply was sent.");
      toast("Reply sent", "ok", { description: `To ${m.email}` });
      onSent();
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 400 && /set up/i.test(err.message)) setFallback(err.message);
      else { setFallback(errMsg(e)); if (err.status === 502) onAttempt(); }
    } finally { setBusy(false); }
  }

  async function close() {
    if (busy) return;
    if (text.trim() && !(await dialog.confirm({ title: "Discard this reply?", message: "Your reply has not been sent.", confirmText: "Discard", cancelText: "Keep writing", danger: true }))) return;
    onDraft(null); onClose();
  }
  return (
    <section className="ib-compose" aria-label={`Reply to ${m.name}`}>
      <div className="ib-compose-h"><b>Reply to {m.name}</b><span>{m.email}</span>
        <button type="button" className="sh-icb sm plain" onClick={close} disabled={busy} aria-label="Close reply"><I i={Cancel01Icon} size={15} /></button></div>
      <label className="ib-field"><span>Subject</span><input value={subject} disabled={busy} onChange={(e) => { setSubject(e.target.value); onDraft({ subject: e.target.value, text }); }} maxLength={300} /></label>
      <div className="ib-tpls" role="group" aria-label="Quick replies">
        {TEMPLATES.map((t) => <button key={t.label} type="button" className="ib-tpl" disabled={busy} onClick={() => applyTemplate(t.text(m))}>{t.label}</button>)}
      </div>
      <label className="ib-field"><span>Message <small>“Hi {firstName(m.name)},” is added at the top, your name at the end.</small></span>
        <textarea ref={ta} value={text} disabled={busy} onChange={(e) => { setText(e.target.value); onDraft({ subject, text: e.target.value }); }} rows={7} maxLength={10000}
          onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); send(); } }} placeholder="Write your reply…" />
      </label>
      {fallback && (
        <div className="ib-fallback" role="alert">
          <I i={Alert02Icon} size={16} />
          <span>{fallback}</span>
          <span className="ib-fallback-acts">
            <a className="sh-btn sm pri" href={mailto}><I i={LinkSquare02Icon} size={14} />Open in mail app</a>
            <button type="button" className="sh-btn sm" onClick={() => copy(full, "Reply")}><I i={Copy01Icon} size={14} />Copy text</button>
          </span>
        </div>
      )}
      <div className="ib-compose-f">
        <button type="button" className="sh-btn pri" disabled={busy || !text.trim()} onClick={send}><I i={MailSend01Icon} size={16} />{busy ? "Sending…" : "Send reply"}</button>
        <a className={"sh-btn" + (text.trim() ? "" : " ib-dim")} href={mailto}>Open in mail app</a>
        <button type="button" className="sh-btn" onClick={close} disabled={busy}>Cancel</button>
        <kbd className="ib-hint">Ctrl Enter</kbd>
      </div>
    </section>
  );
}
