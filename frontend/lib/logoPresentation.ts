const API = (process.env.NEXT_PUBLIC_API_URL || "https://api.finvera.solutions").replace(/\/$/, "");

export function logoImage(value?: string | null): string | undefined {
  if (typeof value !== "string" || !value.trim() || /\s/.test(value.trim())) return undefined;
  const input = value.trim();
  try {
    const url = new URL(input.startsWith("/uploads/") ? `${API}${input}` : input);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
