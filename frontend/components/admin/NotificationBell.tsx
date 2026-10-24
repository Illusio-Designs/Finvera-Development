"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { playSound, isSoundOn, setSoundOn } from "@/lib/sound";

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
      fresh.slice(0, 3).forEach((n) => toast(`${ICONS[n.type] || ICONS.info} ${n.title}`, "info", {
        description: n.body || "New in your notifications",
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
            <button onClick={toggleSound} aria-pressed={sound} title={sound ? "Turn notification sounds off" : "Turn notification sounds on"}>
              {sound ? "🔔 Sound on" : "🔕 Sound off"}
            </button>
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
