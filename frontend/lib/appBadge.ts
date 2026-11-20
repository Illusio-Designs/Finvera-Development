export async function syncAppBadge(unread: number) {
  if (typeof navigator === "undefined" || !Number.isSafeInteger(unread) || unread < 0) return;
  try {
    if (unread === 0) await navigator.clearAppBadge?.();
    else await navigator.setAppBadge?.(unread);
  } catch { /* Device settings can block badge updates. */ }
}
