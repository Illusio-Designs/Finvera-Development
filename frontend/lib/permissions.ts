/* ── Role-based access control (frontend mirror) ─────────────────────
   Keep in sync with Backendjs/src/utils/permissions.js. The backend is the
   real gate (every write is checked there); this drives nav + route guards. */

export type Area = "content" | "board" | "leads" | "contact" | "seo" | "settings" | "users" | "renewals";

export const ROLE_AREAS: Record<string, "*" | Area[]> = {
  admin: "*",
  content: ["content"],
  editor: ["content"], // legacy alias
  projects: ["board", "renewals"],
  leads: ["leads", "contact"],
  seo: ["seo", "settings"],
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  content: "Content editor",
  editor: "Content editor",
  projects: "Project board",
  leads: "Leads",
  seo: "SEO",
};

/** Roles offered when creating/editing a user. */
export const ROLE_OPTIONS = ["admin", "content", "projects", "leads", "seo"];

/** area === null means "open to any signed-in user" (e.g. the Dashboard home). */
export function roleCan(role: string | undefined, area: Area | null): boolean {
  if (!area) return true;
  const a = ROLE_AREAS[role || ""];
  if (!a) return false;
  if (a === "*") return true;
  return a.includes(area);
}

/** True if ANY of the user's roles grants the area. */
export function rolesCan(roles: string[] | undefined, area: Area | null): boolean {
  if (!area) return true;
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => roleCan(r, area));
}

/** Normalise a user's roles from the API (new `roles[]` or legacy single `role`). */
export function userRoles(me: { roles?: string[]; role?: string } | null | undefined): string[] {
  if (!me) return [];
  if (Array.isArray(me.roles) && me.roles.length) return me.roles;
  return me.role ? [me.role] : [];
}

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
