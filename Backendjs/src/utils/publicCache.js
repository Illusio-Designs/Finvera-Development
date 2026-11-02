/* ── Public (signed-out) read cache ───────────────────────
   One in-memory store shared by every public content endpoint (the crud
   lists/details, settings, SEO and /public/bootstrap). Bodies are kept as
   ready-to-send JSON strings for PUBLIC_CACHE_TTL_MS (default 60 s).

   Any content write through the admin API calls clear(), which empties the
   whole store at once: writes are rare and the next public read simply
   rebuilds. With several app processes (Passenger) the other processes
   catch up within the TTL.

   Only signed-out requests are ever stored or served from here, so nothing
   user-specific can leak between callers. */

const TTL_MS = Number(process.env.PUBLIC_CACHE_TTL_MS || 60 * 1000);
const MAX_ENTRIES = 500;

const store = new Map(); // key → { at, body: Promise<string> }

/* Return the cached JSON string for `key`, or build it with `build()` (which
   resolves to any JSON-serialisable value) and keep it. Concurrent misses for
   the same key share one build. */
function get(key, build) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body;
  const body = Promise.resolve().then(build).then((v) => JSON.stringify(v));
  if (store.size >= MAX_ENTRIES) store.clear();
  store.set(key, { at: Date.now(), body });
  // A failed build is not kept. (A build still running when clear() is
  // called was already dropped from the store with everything else.)
  body.catch(() => { if (store.get(key)?.body === body) store.delete(key); });
  return body;
}

function clear() {
  store.clear();
}

/* Headers for a public, cacheable response. Browsers keep it 60 s, shared
   caches (a CDN in front of the API, if one is added) 5 min, and either may
   serve a stale copy for up to 10 min while refreshing in the background.
   `Vary: Authorization` keeps a signed-in (admin) request from being answered
   with the public copy by any HTTP cache. */
const PUBLIC_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

function setPublicHeaders(res) {
  res.set("Cache-Control", PUBLIC_CACHE_CONTROL);
  res.vary("Authorization");
}

/* Send a cached public JSON body (express still adds the weak ETag and
   answers If-None-Match with 304). */
function sendPublic(res, body) {
  setPublicHeaders(res);
  return res.type("json").send(body);
}

module.exports = { get, clear, sendPublic, setPublicHeaders, PUBLIC_CACHE_CONTROL, TTL_MS };
