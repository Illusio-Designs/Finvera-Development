/* setInterval that only runs while the tab is visible. The timer is stopped
   when the tab is hidden and restarted when it comes back; `onShow` (default
   true) also runs `fn` straight away on return so the data catches up.
   Returns a cleanup function. */
import { pollTransition, type PollState } from "./lifecycleMachine";
export function visibleInterval(fn: () => void, ms: number, { onShow = true }: { onShow?: boolean } = {}): () => void {
  let phase: PollState = document.hidden ? "hidden" : "running";
  let t: ReturnType<typeof setInterval> | null = null;
  const start = () => { if (phase === "running" && t == null) t = setInterval(fn, ms); };
  const stop = () => { if (t != null) { clearInterval(t); t = null; } };
  const onVis = () => {
    phase = pollTransition(phase, document.hidden ? "HIDDEN" : "VISIBLE");
    if (phase === "disposed") return;
    if (document.hidden) { stop(); return; }
    if (onShow) fn();
    start();
  };
  if (!document.hidden) start();
  document.addEventListener("visibilitychange", onVis);
  return () => { phase = pollTransition(phase, "CLEANUP"); stop(); document.removeEventListener("visibilitychange", onVis); };
}
