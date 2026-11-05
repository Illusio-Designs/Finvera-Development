const slugify = require("slugify");
const pubCache = require("./publicCache");

/* Wrap async route handlers to forward errors */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/*
 * Build a set of REST handlers for a Sequelize model.
 * options:
 *   slugFrom   – field used to auto-generate a unique slug
 *   hasStatus  – model has draft/published status (public list hides drafts)
 *   order      – default ordering
 *   searchable – fields for ?q= search (LIKE)
 */
function crudController(Model, options = {}) {
  const {
    slugFrom = null,
    hasStatus = false,
    order = [["position", "ASC"], ["createdAt", "DESC"]],
    searchable = [],
    onCreate = null,   // async (item, req) => {}  — side effects (e.g. notifications)
    onUpdate = null,   // async (item, req, before) => {}
    removeRecord = null,
    updateRecord = null, // optional atomic write: (req) => { item, before }
    load = null,       // (req) => Promise<item> — reuse a row an earlier middleware already loaded
    publicCache = false, // serve signed-out reads from the shared public cache (marketing site)
    publicListExclude = [], // heavy fields left out of signed-out list reads (detail endpoint keeps them)
    canReadDrafts = (req) => !!req.user,
    entity = null,     // activity-history name (e.g. "lead"); null = not recorded
    onRemove = null,   // async (item, req) => {} — after a delete
  } = options;
  const audit = require("./audit");
  const { pageOf, sortOf, paged } = require("./paginate");
  const SORTABLE = Object.keys(Model.rawAttributes);
  // ?fields=list → leave out the heavy long-text body (blog / projects / pages).
  const LIST_OMIT = ["content"].filter((f) => SORTABLE.includes(f));

  const { Op } = require("sequelize");

  async function uniqueSlug(source, ignoreId = null) {
    let base = slugify(String(source || "item"), { lower: true, strict: true }) || "item";
    let slug = base;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await Model.findOne({ where: { slug, ...(ignoreId ? { id: { [Op.ne]: ignoreId } } : {}) } })) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  /* Signed-out reads (the public site) are served from the shared public
     cache (utils/publicCache, ~60 s) with Cache-Control headers; any write
     through a cached controller clears it. Signed-in (admin) reads always go
     to the database and get no cache headers, so an editor never sees their
     own change missing. */
  const cacheable = (req) => publicCache && !req.user;
  const clearPub = () => { if (publicCache) pubCache.clear(); };

  /* Columns sent to signed-out list reads. `publicListExclude` drops heavy
     detail-only fields (long HTML bodies etc.) from the public list; the
     single-item endpoint still returns everything. `?fields=full` keeps the
     old full shape for any caller that needs it. */
  const publicAttributes = (req) =>
    (publicListExclude.length && req.query.fields !== "full" ? { exclude: publicListExclude } : undefined);

  function listWhere(req) {
    const where = {};
    // public callers only see published items
    if (hasStatus && !canReadDrafts(req)) where.status = "published";
    if (hasStatus && canReadDrafts(req) && req.query.status) where.status = req.query.status;
    if (req.query.q && searchable.length) {
      where[Op.or] = searchable.map((f) => ({ [f]: { [Op.like]: `%${req.query.q}%` } }));
    }
    return where;
  }

  /* The public list as /public/bootstrap uses it (signed-out, no filters):
     a promise of the JSON string, shared with GET / through the cache. */
  const publicListBody = () =>
    pubCache.get(`${Model.name}:list:/`, () =>
      Model.findAll({ where: hasStatus ? { status: "published" } : {}, order, attributes: publicListExclude.length ? { exclude: publicListExclude } : undefined }));

  return {
    uniqueSlug,
    clearCache: clearPub,
    publicListBody,

    list: asyncHandler(async (req, res) => {
      // Opt-in: ?page=&limit= → { items, total, page, limit }; ?sort=field|-field;
      // ?fields=list. Without them the answer is exactly as before.
      const p = pageOf(req);
      const sorted = sortOf(req, SORTABLE, order);
      const extra = p || req.query.sort || req.query.fields === "list";
      const attrs = req.query.fields === "list" && LIST_OMIT.length
        ? { attributes: { exclude: LIST_OMIT } }
        : (cacheable(req) && publicAttributes(req) ? { attributes: publicAttributes(req) } : {});
      if (extra) {
        const run = async () => {
          if (!p) return Model.findAll({ where: listWhere(req), order: sorted, ...attrs });
          const r = await Model.findAndCountAll({ where: listWhere(req), order: sorted, limit: p.limit, offset: p.offset, ...attrs });
          return { items: r.rows, total: r.count, page: p.page, limit: p.limit };
        };
        if (cacheable(req)) return pubCache.sendPublic(res, await pubCache.get(`${Model.name}:list:${req.originalUrl}`, run));
        return res.json(await run());
      }
      if (cacheable(req)) {
        const plain = !req.query.q && !req.query.status && req.query.fields !== "full";
        const body = plain
          ? await publicListBody()
          : await pubCache.get(`${Model.name}:list:${req.originalUrl}`, () =>
            Model.findAll({ where: listWhere(req), order, attributes: publicAttributes(req) }));
        return pubCache.sendPublic(res, body);
      }
      const items = await Model.findAll({ where: listWhere(req), order });
      res.json(items);
    }),

    getOne: asyncHandler(async (req, res) => {
      const key = req.params.id;
      const where = /^\d+$/.test(key) ? { id: key } : { slug: key };
      if (Model.name === "Seo") Object.assign(where, { page: key }, { id: undefined });
      if (cacheable(req)) {
        // null = missing or unpublished (404); cached too, briefly, like a hit.
        const body = await pubCache.get(`${Model.name}:one:${key}`, async () => {
          const item = await Model.findOne({ where });
          return item && !(hasStatus && item.status !== "published") ? item : null;
        });
        if (body === "null") return res.status(404).json({ message: `${Model.name} not found.` });
        return pubCache.sendPublic(res, body);
      }
      const item = await Model.findOne({ where });
      if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
      if (hasStatus && !canReadDrafts(req) && item.status !== "published") {
        return res.status(404).json({ message: `${Model.name} not found.` });
      }
      res.json(item);
    }),

    create: asyncHandler(async (req, res) => {
      const data = { ...req.body };
      if (slugFrom) data.slug = req.body.slug ? await uniqueSlug(req.body.slug) : await uniqueSlug(data[slugFrom]);
      const item = await Model.create(data);
      clearPub();
      if (entity) audit.record(req, { action: "create", entity, before: null, after: item });
      if (onCreate) { try { await onCreate(item, req); } catch (e) { console.warn("onCreate hook:", e.message); } }
      res.status(201).json(item);
    }),

    update: asyncHandler(async (req, res) => {
      let item, before;
      if (updateRecord) ({ item, before } = await updateRecord(req));
      else {
        item = await (load ? load(req) : Model.findByPk(req.params.id));
        if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
        before = item.toJSON();
        const data = { ...req.body };
        if (slugFrom && req.body.slug && req.body.slug !== item.slug) data.slug = await uniqueSlug(req.body.slug, item.id);
        delete data.id;
        await item.update(data);
      }
      clearPub();
      if (entity) audit.record(req, { action: "update", entity, before, after: item });
      if (onUpdate) { try { await onUpdate(item, req, before); } catch (e) { console.warn("onUpdate hook:", e.message); } }
      res.json(item);
    }),

    remove: asyncHandler(async (req, res) => {
      const item = await Model.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
      if (removeRecord) await removeRecord(req);
      else await item.destroy();
      clearPub();
      if (entity) audit.record(req, { action: "delete", entity, before: item, after: null });
      if (onRemove) { try { await onRemove(item, req); } catch (e) { console.warn("onRemove hook:", e.message); } }
      res.json({ message: "Deleted.", id: Number(req.params.id) });
    }),
  };
}

module.exports = { crudController, asyncHandler };
