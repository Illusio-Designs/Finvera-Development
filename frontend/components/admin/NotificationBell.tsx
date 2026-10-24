"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { playSound, isSoundOn, setSoundOn } from "@/lib/sound";

type Notif = { id: number; type: string; title: string; body?: string | null; link?: string | null; isRead: boolean; createdAt: string };

/* Per-type icon (stroke path) and tint. */
const KINDS: Record<string, { d: string; cls: string }> = {
  enquiry: { d: "M3 6h18v12H3zM3 7l9 6 9-6", cls: "blue" },
  lead: { d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01", cls: "violet" },
  assigned: { d: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-7 8-7s8 3 8 7", cls: "blue" },
  comment: { d: "M4 5h16v11H9l-5 4z", cls: "teal" },
  due: { d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2", cls: "orange" },
  renewal: { d: "M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4", cls: "green" },
  info: { d: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0", cls: "grey" },
};
const kindOf = (t: string) => KINDS[t] || KINDS.info;

/* "Social post assigned to you: Diwali reel" → label + subject. */
function split(title: string) {
  const i = title.indexOf(": ");
  return i > 0 ? { label: title.slice(0, i), subject: title.slice(i + 2) } : { label: "", subject: title };
}
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

function ago(iso: string) {
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  } catch { return ""; }
}

/* The layout mounts two bells (mobile bar + header); only the one with
   `announce` pops new notifications up as toasts, so each rings once. */
export default function NotificationBell({ announce: popUp = false }: { announce?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  // Highest notification id already seen — anything newer pops up as a toast.
  const seen = useRef<number | null>(null);

  async function load() {
    if (!getToken()) return;
    try {
      const r = await api.listNotifications();
      const list: Notif[] = Array.isArray(r) ? r : (r?.items || []);
      setItems(list);
      setUnread(typeof r?.unread === "number" ? r.unread : list.filter((n) => !n.isRead).length);
      announce(list);
    } catch { /* ignore */ }
  }

  /* Pop up notifications that arrived since the last check (not on first load). */
  function announce(list: Notif[]) {
    const maxId = list.reduce((m, n) => Math.max(m, n.id), 0);
    if (popUp && seen.current !== null) {
      const fresh = list.filter((n) => !n.isRead && n.id > (seen.current as number)).sort((a, b) => a.id - b.id);
      fresh.slice(0, 3).forEach((n) => toast(split(n.title).label || n.title, "info", {
        description: [split(n.title).label ? split(n.title).subject : "", n.body].filter(Boolean).join(" · ") || "New in your notifications",
        action: n.link ? { label: "Open", onClick: () => router.push(n.link as string) } : undefined,
        sound: false, duration: 7000,
      }));
      if (fresh.length > 3) toast(`${fresh.length - 3} more notifications`, "info", { description: "Open the bell to see them all.", sound: false });
      if (fresh.length) playSound("notify");
    }
    seen.current = Math.max(maxId, seen.current ?? 0);
  }

  useEffect(() => { setSound(isSoundOn()); load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  const toggleSound = () => { const on = !sound; setSound(on); setSoundOn(on); if (on) playSound("notify"); };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  /* Opening marks everything read on the server, but the new ones keep
     their highlight until the panel closes so you can see what's new. */
  const close = () => { setOpen(false); setItems((xs) => xs.map((n) => ({ ...n, isRead: true }))); };
  const toggle = async () => {
    if (open) { close(); return; }
    setOpen(true);
    if (unread > 0) {
      setUnread(0);
      try { await api.markAllNotifRead(); } catch { /* ignore */ }
    }
  };

  const openItem = (n: Notif) => { close(); if (n.link) router.push(n.link); };
  const clearAll = async () => { setItems([]); setUnread(0); try { await api.clearNotifs(); } catch { /* ignore */ } };

  const fresh = items.filter((n) => !n.isRead).length;
  const groups = [
    { label: "Today", list: items.filter((n) => isToday(n.createdAt)) },
    { label: "Earlier", list: items.filter((n) => !isToday(n.createdAt)) },
  ].filter((g) => g.list.length);

  return (
    <div className="adm-notif" ref={ref}>
      <button className="adm-notif-btn" onClick={toggle} aria-label="Notifications" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="adm-notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="adm-notif-pop" role="dialog" aria-label="Notifications">
          <div className="adm-notif-head">
            <b>Notifications</b>
            {fresh > 0 && <span className="adm-notif-new">{fresh} new</span>}
            <button className={"adm-notif-sound" + (sound ? " on" : "")} onClick={toggleSound} aria-pressed={sound}
              aria-label={sound ? "Turn notification sounds off" : "Turn notification sounds on"} title={sound ? "Sound on" : "Sound off"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H3v6h3l5 4z" />{sound ? <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /> : <path d="M16 9l5 6M21 9l-5 6" />}
              </svg>
            </button>
          </div>
          <div className="adm-notif-list">
            {items.length === 0 ? (
              <div className="adm-notif-empty">
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={KINDS.info.d} /></svg></span>
                <b>You&apos;re all caught up</b>
                <small>New assignments, enquiries and comments will show up here.</small>
              </div>
            ) : groups.map((g) => (
              <div key={g.label}>
                <div className="adm-notif-group">{g.label}</div>
                {g.list.map((n) => {
                  const k = kindOf(n.type), t = split(n.title);
                  return (
                    <button key={n.id} className={"adm-notif-item" + (n.isRead ? "" : " unread")} onClick={() => openItem(n)}>
                      <span className={"adm-notif-ic " + k.cls}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={k.d} /></svg>
                      </span>
                      <span className="adm-notif-txt">
                        {t.label && <small className="adm-notif-kind">{t.label}</small>}
                        <b>{t.subject}</b>
                        {n.body && <span className="adm-notif-body">{n.body}</span>}
                      </span>
                      <span className="adm-notif-time">{ago(n.createdAt)}</span>
                      {!n.isRead && <span className="adm-notif-dot" aria-label="New" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div className="adm-notif-foot">
              <button onClick={clearAll}>Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
