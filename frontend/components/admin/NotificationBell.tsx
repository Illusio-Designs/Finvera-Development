"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { playSound, isSoundOn, setSoundOn } from "@/lib/sound";
import { pushState, enablePush, disablePush, type PushState } from "@/lib/push";
import { dialog } from "@/lib/dialog";

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

/* The layout mounts two bells (phone bar + desktop header) and only one is
   on screen at a time. Only the visible bell polls and pops up toasts, so
   there is one request every 30s and each notification rings once. The
   `announce` prop is kept for callers but no longer needed. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NotificationBell({ announce: _announce = false }: { announce?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  // Highest notification id already seen — anything newer pops up as a toast.
  const seen = useRef<number | null>(null);

  const onScreen = () => !!ref.current && ref.current.offsetParent !== null;

  async function load() {
    if (!getToken() || document.hidden || !onScreen()) return;
    try {
      const r = await api.listNotifications();
      const list: Notif[] = Array.isArray(r) ? r : (r?.items || []);
      // While the panel is open, keep the "new" highlight on items the
      // server has already marked read (opening the panel marks them).
      setItems((prev) => (openRef.current ? list.map((n) => (prev.some((p) => p.id === n.id && !p.isRead) ? { ...n, isRead: false } : n)) : list));
      setUnread(typeof r?.unread === "number" ? r.unread : list.filter((n) => !n.isRead).length);
      announce(list);
    } catch { /* ignore */ }
  }

  /* Pop up notifications that arrived since the last check (not on first load). */
  function announce(list: Notif[]) {
    const maxId = list.reduce((m, n) => Math.max(m, n.id), 0);
    if (seen.current !== null) {
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

  useEffect(() => {
    setSound(isSoundOn()); load();
    const t = setInterval(load, 30000);
    // Catch up straight away when the tab comes back or the layout switches bells.
    const wake = () => load();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("resize", wake);
    window.addEventListener("fv-push", wake); // a push just arrived (from the service worker)
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", wake); window.removeEventListener("resize", wake); window.removeEventListener("fv-push", wake); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  useEffect(() => { openRef.current = open; }, [open]);
  const close = () => { setOpen(false); setItems((xs) => xs.map((n) => ({ ...n, isRead: true }))); };
  const toggle = async () => {
    if (open) { close(); return; }
    setOpen(true);
    pushState().then(setPush).catch(() => setPush("unsupported"));
    if (unread > 0) {
      setUnread(0);
      try { await api.markAllNotifRead(); } catch { /* ignore */ }
    }
  };

  const openItem = (n: Notif) => { close(); if (n.link) router.push(n.link); };

  /* Turn on phone / desktop notifications for this device, then send one
     test notification so the person sees it working straight away. */
  const turnOnPush = async () => {
    setPushBusy(true);
    const r = await enablePush();
    setPushBusy(false);
    if (r.ok) {
      setPush("on");
      toast("Notifications are on", "ok", { description: "A test notification is on its way to this device." });
      api.pushTest().catch(() => {});
    } else if (r.reason === "denied") {
      setPush("denied");
    } else if (r.reason === "dismissed") {
      toast("Notifications not turned on", "info", { description: "Tap Enable again and choose Allow when your device asks." });
    } else {
      toast("Couldn't turn on notifications", "err", { description: r.message || "Please try again." });
    }
  };
  const turnOffPush = async () => { setPushBusy(true); await disablePush(); setPushBusy(false); setPush("off"); toast("Notifications turned off for this device", "info"); };
  const iosSteps = () => dialog.alert({
    title: "Add Finvera to your Home Screen",
    message: "iPhone and iPad only send notifications to the Home Screen app.\n\n1. In Safari, tap the Share button (the square with an arrow).\n2. Tap \u201cAdd to Home Screen\u201d, then \u201cAdd\u201d.\n3. Open Finvera from its new icon, tap the bell and tap Enable.",
    confirmText: "Got it",
  });
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
          {push && push !== "unsupported" && (
            push === "on" ? (
              <div className="adm-push on">
                <i aria-hidden="true" />
                <span>Notifications are on for this device</span>
                <button type="button" onClick={turnOffPush} disabled={pushBusy}>Turn off</button>
              </div>
            ) : (
              <div className="adm-push">
                <span className="adm-push-ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M10 18h4M12 6.5a3 3 0 0 0-3 3c0 2.5-1 3.5-1 3.5h8s-1-1-1-3.5a3 3 0 0 0-3-3z" /></svg>
                </span>
                <span className="adm-push-txt">
                  {push === "off" && <><b>Get notifications on this device</b><small>Assignments, updates and reminders, even when Finvera is closed.</small></>}
                  {push === "ios-install" && <><b>Add Finvera to your Home Screen first</b><small>On iPhone and iPad, notifications only work in the Home Screen app.</small></>}
                  {push === "denied" && <><b>Notifications are blocked</b><small>Allow them for Finvera in your device or browser settings, then reopen the app.</small></>}
                </span>
                {push === "off" && <button type="button" className="adm-push-btn" onClick={turnOnPush} disabled={pushBusy}>{pushBusy ? "Enabling…" : "Enable"}</button>}
                {push === "ios-install" && <button type="button" className="adm-push-btn ghost" onClick={iosSteps}>How</button>}
              </div>
            )
          )}
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
