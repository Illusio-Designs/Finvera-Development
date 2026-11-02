/* Small formatters for the ops screens (System page, studio check, inbox). */

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export function timeAgo(iso: string | number | Date | null | undefined, now = Date.now()): string {
  if (iso == null || iso === "") return "never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "never";
  const s = Math.round((now - t) / 1000);
  if (s < 0) return "just now";
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/** Hours since a time (Infinity when missing). */
export const hoursSince = (iso: string | null | undefined, now = Date.now()) =>
  iso ? (now - new Date(iso).getTime()) / 3600000 : Infinity;

/** "Up 3 days" / "Up 5 h" / "Up 12 min". */
export function uptime(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  if (sec < 3600) return `Up ${Math.max(1, Math.round(sec / 60))} min`;
  if (sec < 86400 * 2) return `Up ${Math.round(sec / 3600)} h`;
  return `Up ${Math.floor(sec / 86400)} days`;
}

/** 2.4 MB / 830 KB. */
export function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

/** "2 Nov 2026, 3:50 AM" in the viewer's time zone. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const h = d.getHours(), m = d.getMinutes();
  return `${date}, ${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Whole days until a time (negative = passed); null when missing. */
export const daysUntil = (iso: string | null | undefined, now = Date.now()) =>
  iso ? Math.floor((new Date(iso).getTime() - now) / 86400000) : null;
