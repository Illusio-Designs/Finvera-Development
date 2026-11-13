"use client";
import { useDisclosure } from "@/lib/useDisclosure";
import { readNotification } from "@/lib/notificationMachine";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { playSound, isSoundOn, setSoundOn } from "@/lib/sound";
import { pushState, enablePush, disablePush, type PushState } from "@/lib/push";
import { dialog } from "@/lib/dialog";
import { visibleInterval } from "@/lib/visibleInterval";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Mail01Icon, Target02Icon, UserAdd01Icon, Comment01Icon, Clock01Icon, RepeatIcon, Notification03Icon,
  Alert02Icon, CheckmarkCircle02Icon, VolumeHighIcon, VolumeOffIcon,
} from "@hugeicons/core-free-icons";

type Notif = { id: number; type: string; title: string; body?: string | null; link?: string | null; isRead: boolean; createdAt: string; meta?: Record<string, unknown> | null };
/* Old project-board alerts point at a page that no longer exists → no link. */
const hrefOf = (n: Notif) => (n.link && !n.link.startsWith("/dashboard/kanban") ? n.link : "");

/* Per-type icon and tint. */
type K = { icon: typeof Mail01Icon; cls: string };
const KINDS: Record<string, K> = {
  enquiry: { icon: Mail01Icon, cls: "blue" },
  lead: { icon: Target02Icon, cls: "green" },
  lead_followup: { icon: Target02Icon, cls: "amber" },
  assigned: { icon: UserAdd01Icon, cls: "blue" },
  comment: { icon: Comment01Icon, cls: "violet" },
  due: { icon: Clock01Icon, cls: "amber" },
  renewal: { icon: RepeatIcon, cls: "amber" },
  approval: { icon: CheckmarkCircle02Icon, cls: "violet" },
  publish: { icon: Alert02Icon, cls: "red" },
  failed: { icon: Alert02Icon, cls: "red" },
  info: { icon: Notification03Icon, cls: "grey" },
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
  const [open, setOpen] = useDisclosure(false);
  const [sound, setSound] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
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
      setItems(list);
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
        action: n.link ? { label: "Open", onClick: () => router.push(hrefOf(n)) } : undefined,
        sound: false, duration: 7000,
      }));
      if (fresh.length > 3) toast(`${fresh.length - 3} more notifications`, "info", { description: "Open the bell to see them all.", sound: false });
      if (fresh.length) playSound("notify");
    }
    seen.current = Math.max(maxId, seen.current ?? 0);
  }

  useEffect(() => {
    setSound(isSoundOn()); load();
    // Polls every 30s only while the tab is visible; catches up straight away
    // when the tab comes back.
    const stop = visibleInterval(load, 30000);
    // Also catch up when the layout switches bells.
    const wake = () => load();
    window.addEventListener("resize", wake);
    window.addEventListener("fv-push", wake); // a push just arrived (from the service worker)
    return () => { stop(); window.removeEventListener("resize", wake); window.removeEventListener("fv-push", wake); };
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

  /* Opening shows what's new; "Mark all read" clears it, and opening one
     item marks that one read and goes to its page. */
  const close = () => setOpen(false);
  const toggle = () => {
    if (open) { close(); return; }
    setOpen(true);
    pushState().then(setPush).catch(() => setPush("unsupported"));
  };
  const markAll = async () => {
    setItems((xs) => xs.map(readNotification)); setUnread(0);
    try { await api.markAllNotifRead(); } catch { /* ignore */ }
  };

  const openItem = (n: Notif) => {
    close();
    if (!n.isRead) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? readNotification(x) : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.markNotifRead(n.id).catch(() => {});
    }
    if (n.link) router.push(hrefOf(n));
  };

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
    <div className="adm-notif sh-bell" ref={ref}>
      <button type="button" className="sh-icb" onClick={toggle} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} aria-haspopup="dialog" aria-expanded={open}>
        <HugeiconsIcon icon={Notification03Icon} size={19} strokeWidth={1.8} className="hgi" />
        {unread > 0 && <span className="sh-ping">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="sh-pop sh-bellpop" role="dialog" aria-label="Notifications">
          <div className="sh-pop-h">
            <b>Notifications</b>
            {fresh > 0
              ? <button type="button" className="sh-link" onClick={markAll}>Mark all read</button>
              : <span className="sh-pill green">All caught up</span>}
            <button type="button" className="sh-icb sm plain" onClick={toggleSound} aria-pressed={sound}
              aria-label={sound ? "Turn notification sounds off" : "Turn notification sounds on"} title={sound ? "Sound on" : "Sound off"}>
              <HugeiconsIcon icon={sound ? VolumeHighIcon : VolumeOffIcon} size={17} strokeWidth={1.8} className="hgi" />
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
          <div className="sh-nlist">
            {items.length === 0 ? (
              <div className="sh-empty" style={{ margin: 14 }}>
                <HugeiconsIcon icon={Notification03Icon} size={20} strokeWidth={1.8} className="hgi" />
                <b>You&apos;re all caught up</b>
                <span>New assignments, enquiries and comments will show up here.</span>
              </div>
            ) : groups.map((g) => (
              <div key={g.label}>
                <div className="sh-ngroup">{g.label}</div>
                {g.list.map((n) => {
                  const k = kindOf(n.type), t = split(n.title);
                  return (
                    <button type="button" key={n.id} className={"sh-ni" + (n.isRead ? " read" : "")} onClick={() => openItem(n)}>
                      <span className={"sh-ni-ic " + k.cls}><HugeiconsIcon icon={k.icon} size={17} strokeWidth={1.8} className="hgi" /></span>
                      <span className="sh-ni-tx">
                        {t.label && <small className="sh-ni-kind">{t.label}</small>}
                        <b>{t.subject}</b>
                        {n.body && <span className="sh-ni-body">{n.body}</span>}
                        <small>{ago(n.createdAt)}</small>
                      </span>
                      <i className="sh-ni-u" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {items.length > 0 && (
            <div className="sh-pop-f">
              <button type="button" className="sh-link muted" onClick={clearAll}>Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
