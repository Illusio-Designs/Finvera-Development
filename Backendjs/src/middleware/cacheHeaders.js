/* Cache-Control for /api.

   Signed-out GET/HEAD reads of public site content (what the marketing site
   fetches) may be cached briefly by browsers / CDNs:
     Cache-Control: public, max-age=60, stale-while-revalidate=300
   Everything else — any request carrying Authorization, every write, every
   admin-only path, errors — is `no-store`, so admin data never sits in a
   browser or proxy cache. `Vary: Authorization` is always sent so a shared
   cache never hands a signed-out copy to a signed-in request (or back). */

const PUBLIC_PREFIXES = new Set([
  "projects", "services", "testimonials", "team", "blog", "pages", "faqs", "values", "brands",
  "milestones", "process-steps", "stats", "logos", "features", "seo",
  "public", // /public/bootstrap — everything the marketing site needs in one call
]);
// Same value the shared public cache sends (utils/publicCache.js).
const { PUBLIC_CACHE_CONTROL: PUBLIC_CC } = require("../utils/publicCache");

function isPublicRead(req) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  if (req.headers.authorization) return false;
  const parts = String(req.path || "").split("/").filter(Boolean); // mounted at /api → "projects/abc"
  if (!parts.length) return false;
  if (parts[0] === "settings") return parts.length === 1;           // flat public settings only (not /settings/all)
  if (!PUBLIC_PREFIXES.has(parts[0])) return false;
  return parts.length <= 2;                                          // list or one item
}

function cacheHeaders(req, res, next) {
  res.vary("Authorization");
  const pub = isPublicRead(req);
  res.setHeader("Cache-Control", pub ? PUBLIC_CC : "no-store");
  if (!pub) res.setHeader("X-LiteSpeed-Cache-Control", "no-cache"); // LiteSpeed's own page cache, if enabled
  if (pub) {
    // Errors (404 for a missing slug, 5xx) are never cached.
    const writeHead = res.writeHead;
    res.writeHead = function patched(code, ...rest) {
      const status = typeof code === "number" ? code : res.statusCode;
      if (status >= 400) res.setHeader("Cache-Control", "no-store");
      return writeHead.call(this, code, ...rest);
    };
  }
  next();
}

module.exports = { cacheHeaders, isPublicRead };
