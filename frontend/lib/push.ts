"use client";
import { api } from "@/lib/adminApi";

/* Phone / desktop push notifications for this device.
   iPhone/iPad: only works in the Home Screen app (iOS 16.4+), and the
   permission prompt must come straight from a tap. */

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

const isIos = () => {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
};
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const keyBytes = (b64u: string) => {
  const s = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
};
const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => !!a && new Uint8Array(a).length === b.length && new Uint8Array(a).every((x, i) => x === b[i]);

export function registerWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register("/sw.js").catch(() => null);
}

async function currentSub() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIos() && !isStandalone()) return "ios-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  return (await currentSub()) ? "on" : "off";
}

/* Ask permission (call directly from a tap), subscribe, save on the server. */
export async function enablePush(): Promise<{ ok: boolean; reason?: "denied" | "dismissed" | "error"; message?: string }> {
  if (!supported()) return { ok: false, reason: "error", message: "This browser can't receive notifications." };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission === "denied" ? "denied" : "dismissed" };
  try {
    await registerWorker();
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await api.pushKey();
    const key = keyBytes(publicKey);
    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await api.pushSubscribe(sub.toJSON());
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export async function disablePush() {
  try {
    const sub = await currentSub();
    if (sub) { await api.pushUnsubscribe(sub.endpoint).catch(() => {}); await sub.unsubscribe(); }
  } catch { /* ignore */ }
}

/* On each dashboard load: if this device already has push on, make sure the
   server has it for the signed-in user (covers a different person signing in
   on the same phone, or a server-side key change). */
export async function syncPush() {
  try {
    if (!supported() || Notification.permission !== "granted") return;
    await registerWorker();
    const sub = await currentSub();
    if (!sub) return;
    const { publicKey } = await api.pushKey();
    if (!sameKey(sub.options.applicationServerKey, keyBytes(publicKey))) {
      await sub.unsubscribe();
      const reg = await navigator.serviceWorker.ready;
      const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      await api.pushSubscribe(fresh.toJSON());
      return;
    }
    await api.pushSubscribe(sub.toJSON());
  } catch { /* best effort */ }
}
