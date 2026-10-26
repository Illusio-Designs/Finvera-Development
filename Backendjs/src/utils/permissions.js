/* ── Role-based access control (shared source of truth) ──────────────
   Mirror of frontend/lib/permissions.ts — keep the two in sync.

   Areas map to groups of API resources:
     content  → projects/work, services, testimonials, team, blog, pages,
                and all site-content collections (faqs, values, brands, …)
     board    → kanban boards + tasks + comments
     leads    → BD lead pipeline
     social   → social media calendar (clients + posts)
     contact  → website contact inbox
     seo      → SEO metadata
     settings → analytics / pixels / brand settings
     users    → admin user accounts
*/

// The project board ("board") is open to every team member.
const ROLE_AREAS = {
  admin: "*",                       // full access
  content: ["content", "social", "board"],
  editor: ["content", "social", "board"],    // legacy alias → content editor
  projects: ["board", "renewals", "social"],  // project board (kanban) + maintenance renewals + social calendar
  leads: ["leads", "contact", "board"],
  seo: ["seo", "settings", "board"],
  social: ["social", "board"],               // social media team — posts content (Ready to post → Posted)
  marketer: ["social", "board"],             // plans / shoots reels (Planned, Need from client)
  video: ["social", "board"],                // video editor — edits reels (In production)
  graphic: ["social", "board"],              // graphic designer — posts & carousels (auto-assigned)
};

/* Roles offered in the UI (legacy "editor" still accepted for existing users). */
const ALL_ROLES = ["admin", "content", "projects", "leads", "seo", "social", "marketer", "graphic", "video"];
const ACCEPTED_ROLES = [...ALL_ROLES, "editor"];

function roleCan(role, area) {
  const areas = ROLE_AREAS[role];
  if (!areas) return false;
  if (areas === "*") return true;
  return areas.includes(area);
}

/* A user's roles as an array. The `roles` JSON column can come back as a
   string on some MySQL setups — parse it, else fall back to legacy `role`. */
function rolesOf(user) {
  let r = user && user.roles;
  if (typeof r === "string") { try { r = JSON.parse(r); } catch { r = null; } }
  if (Array.isArray(r) && r.length) return r;
  return user && user.role ? [user.role] : [];
}

/* True if ANY of the user's roles grants the area. */
function rolesCan(roles, area) {
  if (!Array.isArray(roles)) return false;
  return roles.some((r) => roleCan(r, area));
}

module.exports = { ROLE_AREAS, ALL_ROLES, ACCEPTED_ROLES, roleCan, rolesCan, rolesOf };
