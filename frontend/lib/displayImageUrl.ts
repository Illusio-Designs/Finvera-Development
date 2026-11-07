const API = (process.env.NEXT_PUBLIC_API_URL || "https://api.finvera.solutions").replace(/\/$/, "");
/** Presentation only: never save this URL to a post or use it for publishing. */
export function displayImageUrl(input: string): string {
  if (!input || input.startsWith('data:') || input.startsWith('blob:')) return input;
  try {
    const url = new URL(input.startsWith('/uploads/') ? API + input : input);
    if (url.origin === new URL(API).origin && url.pathname.startsWith('/uploads/') && /\.(jpe?g|png|avif|gif)$/i.test(url.pathname)) {
      return `${API}/api/image-display?file=${encodeURIComponent(url.pathname)}`;
    }
  } catch {}
  return input;
}
