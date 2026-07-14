/* ── Role-based access control (frontend mirror) ─────────────────────
   Keep in sync with Backendjs/src/utils/permissions.js. The backend is the
   real gate (every write is checked there); this drives nav + route guards. */

export type Area = "content" | "board" | "leads" | "contact" | "seo" | "settings" | "users";

export const ROLE_AREAS: Record<string, "*" | Area[]> = {
  admin: "*",
  content: ["content"],
  editor: ["content"], // legacy alias
  projects: ["board"],
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
