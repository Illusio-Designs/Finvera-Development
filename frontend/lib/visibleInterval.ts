/* setInterval that only runs while the tab is visible. The timer is stopped
   when the tab is hidden and restarted when it comes back; `onShow` (default
   true) also runs `fn` straight away on return so the data catches up.
   Returns a cleanup function. */
export function visibleInterval(fn: () => void, ms: number, { onShow = true }: { onShow?: boolean } = {}): () => void {
  let t: ReturnType<typeof setInterval> | null = null;
  const start = () => { if (t == null) t = setInterval(fn, ms); };
  const stop = () => { if (t != null) { clearInterval(t); t = null; } };
  const onVis = () => {
    if (document.hidden) { stop(); return; }
    if (onShow) fn();
    start();
  };
  if (!document.hidden) start();
  document.addEventListener("visibilitychange", onVis);
  return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
}
