"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/adminApi";

type Notif = { id: number; type: string; title: string; body?: string | null; link?: string | null; isRead: boolean; createdAt: string };

const ICONS: Record<string, string> = { enquiry: "✉️", lead: "🎯", assigned: "👤", comment: "💬", due: "⏰", info: "🔔" };

function ago(iso: string) {
  try {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  } catch { return ""; }
}

export default function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    if (!getToken()) return;
    try {
      const r = await api.listNotifications();
      const list: Notif[] = Array.isArray(r) ? r : (r?.items || []);
      setItems(list);
      setUnread(typeof r?.unread === "number" ? r.unread : list.filter((n) => !n.isRead).length);
    } catch { /* ignore */ }
  }

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && unread > 0) {
      setUnread(0); setItems((xs) => xs.map((n) => ({ ...n, isRead: true })));
      try { await api.markAllNotifRead(); } catch { /* ignore */ }
    }
  };

  const openItem = (n: Notif) => { setOpen(false); if (n.link) router.push(n.link); };
  const clearAll = async () => { setItems([]); setUnread(0); try { await api.clearNotifs(); } catch { /* ignore */ } };

  return (
    <div className="adm-notif" ref={ref}>
      <button className="adm-notif-btn" onClick={toggle} aria-label="Notifications" aria-expanded={open}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="adm-notif-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="adm-notif-pop">
          <div className="adm-notif-head">
            <b>Notifications</b>
            {items.length > 0 && <button onClick={clearAll}>Clear all</button>}
          </div>
          <div className="adm-notif-list">
            {items.length === 0 ? (
              <div className="adm-notif-empty">You&apos;re all caught up 🎉</div>
            ) : items.map((n) => (
              <button key={n.id} className={"adm-notif-item" + (n.isRead ? "" : " unread")} onClick={() => openItem(n)}>
                <span className="adm-notif-ic">{ICONS[n.type] || ICONS.info}</span>
                <span className="adm-notif-txt">
                  <b>{n.title}</b>
                  {n.body && <span className="adm-notif-body">{n.body}</span>}
                  <small>{ago(n.createdAt)}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
