const RESERVED = new Set(["about", "services", "solutions", "work", "blog", "contact", "data-deletion", "widgets", "dashboard", "login", "reset-password", "api", "auth", "uploads", "_next", "sitemap", "robots", "favicon"]);
export const fixedPageSlug = (slug: string) => ["privacy", "terms"].includes(slug);
export const validPageSlug = (slug: unknown): slug is string => typeof slug === "string" && slug.length <= 200 && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED.has(slug);
