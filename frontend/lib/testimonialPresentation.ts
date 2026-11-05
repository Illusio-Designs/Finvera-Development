// Keep the editor preview and public rendering aligned, including older records.
export function testimonialRating(value: unknown): number {
  const rating = value == null || value === "" ? 5 : Number(value);
  return Number.isFinite(rating) ? Math.min(5, Math.max(1, Math.round(rating))) : 5;
}
export function testimonialInitials(name?: string | null, avatar?: string | null): string {
  return avatar?.trim() || String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
}
