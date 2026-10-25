/* Finvera service worker — receives Web Push messages and shows them as
   phone / desktop notifications, even when the dashboard is closed.
   No offline caching: the dashboard always loads fresh from the network. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data ? event.data.text() : "" }; }

  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // An open dashboard refreshes its bell at once (and plays the Finvera sound).
    wins.forEach((c) => c.postMessage({ type: "fv-push", data: d }));
    const appOnScreen = wins.some((c) => c.visibilityState === "visible");

    // Unread count on the app icon (iPhone Home Screen app, installed desktop app).
    if (typeof d.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
      try { d.badge > 0 ? await self.navigator.setAppBadge(d.badge) : await self.navigator.clearAppBadge(); } catch { /* not supported */ }
    }

    // Browsers require every push to show a notification. When the app is open
    // on screen it stays quiet, because the app plays its own sound.
    await self.registration.showNotification(d.title || "Finvera", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: d.tag || undefined,
      data: { url: d.url || "/dashboard" },
      silent: appOnScreen,
      vibrate: appOnScreen ? undefined : [120, 60, 120],
      timestamp: Date.now(),
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(self.location.origin) && "focus" in c) {
        await c.focus();
        if ("navigate" in c) { try { await c.navigate(url); } catch { /* cross-scope */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
