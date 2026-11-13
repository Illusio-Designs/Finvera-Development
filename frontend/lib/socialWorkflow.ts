export type SocialRole = "marketer" | "video" | "graphic" | "admin" | "social";
export type SocialStage = "planned" | "client" | "production" | "approval" | "ready" | "posted";

// Mirrored across the independently deployed frontend/backend. The workflow
// contract test verifies both definitions, including every invalid edge.
export const POST_TRANSITIONS = {
  planned: { START: "production", REQUEST_CLIENT: "client" },
  client: { START: "production", RETURN_TO_PLAN: "planned" },
  production: { SUBMIT: "approval", RETURN_TO_PLAN: "planned", REQUEST_CLIENT: "client" },
  approval: { APPROVE: "ready", REQUEST_CHANGES: "production" },
  ready: { REVOKE_APPROVAL: "approval", CONFIRM_PUBLICATION: "posted" },
  posted: {},
} as const;
const NEXT_STAGE: Partial<Record<SocialStage, SocialStage>> = { planned: "production", client: "production", production: "approval", approval: "ready" };
export const nextStage = (state: SocialStage): SocialStage | null => NEXT_STAGE[state] || null;
export const canMove = (from: SocialStage, to: SocialStage): boolean => from === to || (Object.values(POST_TRANSITIONS[from]) as string[]).includes(to);

export const isVideoFormat = (format?: string | null) => /reel|video/i.test(format || "");
export const makerFor = (format?: string | null): SocialRole => isVideoFormat(format) ? "video" : "graphic";
export const chainFor = (format?: string | null): SocialRole[] => [makerFor(format), "social"];

// Legacy production steps must not put a post into another format's role.
export const roleFor = (status: string, format?: string | null, _step?: string | null): SocialRole =>
  ["approval", "ready", "posted"].includes(status) ? "social" : makerFor(format);

export const indiaToday = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
export function goLiveAt(post: { postDate?: string | null; postTime?: string | null }) {
  if (!post.postDate) return null;
  const date = new Date(`${post.postDate.slice(0, 10)}T${post.postTime || "10:00"}:00+05:30`);
  return Number.isFinite(+date) ? date : null;
}
export const overdueAt = (post: { status?: string; postDate?: string | null; postTime?: string | null }, now = new Date()) => post.status !== "posted" && !!goLiveAt(post) && +goLiveAt(post)! < +now;
export function moveArtwork<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}
