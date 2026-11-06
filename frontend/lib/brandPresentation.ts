export function brandWebsite(value?: string | null): string | undefined {
  if (!value) return undefined;
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.toString() : undefined; } catch { return undefined; }
}
