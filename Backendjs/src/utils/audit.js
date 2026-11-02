/* Activity history (audit log).

   record(req, { action, entity, entityId, entityLabel, summary, before, after, changes })
     action  create | update | delete | other
     entity  lead, renewal, user, setting, seo, project, blog, page, task, board,
             social-client, social-post, contact, … (see ENTITY_OF / docs in routes)
     changes { field: [old, new] } — built from before/after when not given.
   The row is written in the background (setImmediate) and every error is
   swallowed: an audit write can never slow down or break the save itself.
   Passwords, tokens and other secrets are never stored, only "(changed)".

   track(entity, opts) — Express middleware for routes that don't go through
   the crud factory (users, settings, SEO …): loads the row before the
   handler, and once the response went out OK, reloads it and records the
   difference. The handler itself is untouched. */

const IGNORE = new Set(["id", "createdAt", "updatedAt", "position", "timerStart", "timerBy"]);
/* Field / setting names whose values are never stored. */
const SECRET = /(pass(word)?|secret|token|otp|totp|2fa|twofactor|recovery|backupcode|p256dh|apikey|api_key|private|credential|^auth$|hash$)/i;
const MAX_TEXT = 300;     // characters kept of a long text value
const MAX_JSON = 600;     // characters kept of a JSON value (as text)
const MAX_FIELDS = 40;    // fields kept per row

// toJSON() is a copy; get({ plain: true }) can hand back the live dataValues.
const asPlain = (row) => (row && typeof row.toJSON === "function" ? row.toJSON() : row || null);

/* A value as it's stored in the log: dates → ISO, long text trimmed, objects
   as (trimmed) JSON when large. */
/* JSON columns can come back as text on some MySQL setups. */
function unjson(v) {
  if (typeof v !== "string" || !/^\s*[\[{]/.test(v)) return v;
  try { return JSON.parse(v); } catch { return v; }
}
function norm(v) {
  v = unjson(v);
  if (v === undefined || v === "") return null;
  if (v === null) return null;
  if (v instanceof Date) return isNaN(v) ? null : v.toISOString();
  if (typeof v === "string") return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  if (typeof v === "object") {
    const s = JSON.stringify(v);
    return s.length > MAX_JSON ? `${s.slice(0, MAX_JSON)}…` : v;
  }
  return v;
}
/* Comparison key: "5" vs 5, true vs 1, Date vs ISO string are the same value. */
function key(v) {
  v = unjson(v);
  if (v === undefined || v === null || v === "") return "";
  if (Array.isArray(v) && !v.length) return "";                                  // [] ≈ empty
  if (v && typeof v === "object" && !(v instanceof Date) && !Object.keys(v).length) return ""; // {} ≈ empty
  if (v instanceof Date) return isNaN(v) ? "" : v.toISOString();
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  // A date-time string and the Date it becomes compare equal.
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) { const d = new Date(s); if (!isNaN(d)) return d.toISOString(); }
  return s;
}

/* { field: [old, new] } for fields that differ. Either side may be null
   (create: before = null; delete: after = null). */
function diff(before, after, { only = null, skip = [] } = {}) {
  const b = asPlain(before) || {};
  const a = asPlain(after) || {};
  const fields = only || [...new Set([...Object.keys(b), ...Object.keys(a)])];
  const out = {};
  for (const f of fields) {
    if (IGNORE.has(f) || skip.includes(f)) continue;
    const ov = b[f], nv = a[f];
    if (key(ov) === key(nv)) continue;
    if (SECRET.test(f)) { out[f] = [ov == null || ov === "" ? null : "(hidden)", "(changed)"]; continue; }
    out[f] = [norm(ov), norm(nv)];
    if (Object.keys(out).length >= MAX_FIELDS) break;
  }
  if (out.nextFollowUp && out.nextFollowUpAt) delete out.nextFollowUp; // leads: the same date twice
  return out;
}

/* A short human name for a row. */
function labelOf(row) {
  const r = asPlain(row);
  if (!r) return null;
  const v = r.title || r.name || r.theme || r.client || r.question || r.label || r.page || r.key || r.email || r.year || r.value;
  return v == null ? null : String(v).slice(0, 250);
}

let Model = null;
const model = () => (Model || (Model = require("../models").ActivityLog));

function record(req, entry) {
  try {
    const user = (req && req.user) || {};
    // Snapshot now: the row may change again before the background write.
    const e = { ...entry, before: asPlain(entry.before), after: asPlain(entry.after) };
    setImmediate(async () => {
      try {
        const changes = e.changes !== undefined ? e.changes : diff(e.before, e.after, e.diffOpts);
        // Nothing actually changed on an update → no row.
        if ((e.action || "update") === "update" && !e.summary && (!changes || !Object.keys(changes).length)) return;
        const id = e.entityId != null ? e.entityId : (asPlain(e.after) || asPlain(e.before) || {}).id;
        await model().create({
          userId: e.userId !== undefined ? e.userId : (user.id || null),
          userName: String(e.userName !== undefined ? e.userName || "" : user.name || "").slice(0, 250) || null,
          action: ["create", "update", "delete", "other"].includes(e.action) ? e.action : "other",
          entity: String(e.entity || "other").slice(0, 40),
          entityId: id != null ? String(id).slice(0, 64) : null,
          entityLabel: (e.entityLabel !== undefined ? e.entityLabel : labelOf(e.after) || labelOf(e.before)) || null,
          summary: e.summary ? String(e.summary).slice(0, 500) : null,
          changes: changes && Object.keys(changes).length ? changes : null,
          ip: req ? String(req.ip || "").slice(0, 64) || null : null,
        });
      } catch (err) { console.warn("audit:", err.message); }
    });
  } catch (err) { console.warn("audit:", err.message); }
}

/* Middleware for non-crud routes. opts:
     load(req)           → Promise<row|plain|null> current state (before and after)
     action              create | update | delete (default from the method)
     idFrom(req, body)   → entity id (default req.params.id, or the response body's id)
     label(row, req)     → entity label
     summary(req, body)  → one-line summary
     skip                fields left out of the diff */
function track(entity, opts = {}) {
  return async (req, res, next) => {
    let before = null;
    const action = opts.action || (req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update");
    try { if (opts.load && action !== "create") before = asPlain(await opts.load(req)); } catch (e) { console.warn("audit load:", e.message); }
    let body;
    const json = res.json.bind(res);
    res.json = (b) => { body = b; return json(b); };
    res.on("finish", () => {
      if (res.statusCode >= 400) return;
      setImmediate(async () => {
        try {
          let after = null;
          if (action !== "delete") after = opts.load ? asPlain(await opts.load(req, body)) : asPlain(body);
          if (action === "create" && !after) after = asPlain(body);
          const ref = after || before || {};
          record(req, {
            action, entity,
            entityId: opts.idFrom ? opts.idFrom(req, body) : (req.params.id || ref.id || (body && body.id)),
            entityLabel: opts.label ? opts.label(ref, req) : labelOf(ref),
            summary: opts.summary ? opts.summary(req, body) : undefined,
            before: action === "create" ? null : before,
            after: action === "delete" ? null : after,
            diffOpts: { skip: opts.skip || [] },
          });
        } catch (e) { console.warn("audit track:", e.message); }
      });
    });
    next();
  };
}

/* Retention: rows older than `days` (default 365) are deleted — called by
   the daily run. Batched so a large first purge doesn't lock the table. */
async function purgeOld(days = Number(process.env.ACTIVITY_RETENTION_DAYS || 365)) {
  const { Op } = require("sequelize");
  const cutoff = new Date(Date.now() - days * 86400000);
  let total = 0;
  try {
    for (let i = 0; i < 50; i++) {
      const n = await model().destroy({ where: { createdAt: { [Op.lt]: cutoff } }, limit: 5000 });
      total += n;
      if (n < 5000) break;
    }
  } catch (e) { console.warn("audit purge:", e.message); }
  return total;
}

module.exports = { record, track, diff, labelOf, purgeOld, SECRET };
