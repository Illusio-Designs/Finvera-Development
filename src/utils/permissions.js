/* ── Role-based access control (shared source of truth) ─────────────────
   Mirror of frontend/lib/permissions.ts — keep the two in sync.

   Areas map to groups of API resources:
     content  → projects/work, services, testimonials, team, blog, pages,
                and all site-content collections (faqs, values, brands, …)
     board    → kanban boards + tasks + comments
     leads    → BD lead pipeline
     contact  → website contact inbox
     seo      → SEO metadata
     settings → analytics / pixels / brand settings
     users    → admin user accounts
*/

const ROLE_AREAS = {
  admin: "*",                       // full access
  content: ["content"],
  editor: ["content"],              // legacy alias → content editor
  projects: ["board"],              // project board (kanban) only
  leads: ["leads", "contact"],
  seo: ["seo", "settings"],
};

/* Roles offered in the UI (legacy "editor" still accepted for existing users). */
const ALL_ROLES = ["admin", "content", "projects", "leads", "seo"];
const ACCEPTED_ROLES = [...ALL_ROLES, "editor"];

function roleCan(role, area) {
  const areas = ROLE_AREAS[role];
  if (!areas) return false;
  if (areas === "*") return true;
  return areas.includes(area);
}

module.exports = { ROLE_AREAS, ALL_ROLES, ACCEPTED_ROLES, roleCan };
