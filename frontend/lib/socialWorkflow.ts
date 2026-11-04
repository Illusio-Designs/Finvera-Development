export type SocialRole = "marketer" | "video" | "graphic" | "admin" | "social";

export const isVideoFormat = (format?: string | null) => /reel|video/i.test(format || "");
export const makerFor = (format?: string | null): SocialRole => isVideoFormat(format) ? "video" : "graphic";
export const chainFor = (format?: string | null): SocialRole[] => [makerFor(format), "social"];

// Legacy production steps must not put a post into another format's role.
export const roleFor = (status: string, format?: string | null, _step?: string | null): SocialRole =>
  ["approval", "ready", "posted"].includes(status) ? "social" : makerFor(format);
