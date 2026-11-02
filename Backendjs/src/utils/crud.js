const slugify = require("slugify");

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
    load = null,       // (req) => Promise<item> — reuse a row an earlier middleware already loaded
    publicCache = 0,   // ms to keep signed-out list reads in memory (marketing site); 0 = off
  } = options;

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

  /* Signed-out reads (the public site) can be served from memory for a few
     seconds; any write through this controller clears them. Signed-in
     (admin) reads always go to the database, so an editor never sees their
     own change missing. */
  const pubCache = new Map(); // url → { at, body }
  const clearPub = () => pubCache.clear();
  const cachedPub = (req) => {
    if (!publicCache || req.user) return null;
    const hit = pubCache.get(req.originalUrl);
    return hit && Date.now() - hit.at < publicCache ? hit.body : null;
  };
  const keepPub = (req, body) => {
    if (!publicCache || req.user) return;
    if (pubCache.size > 200) pubCache.clear();
    pubCache.set(req.originalUrl, { at: Date.now(), body });
  };

  return {
    uniqueSlug,
    clearCache: clearPub,

    list: asyncHandler(async (req, res) => {
      const cached = cachedPub(req);
      if (cached) return res.type("json").send(cached);
      const where = {};
      // public callers only see published items
      if (hasStatus && !req.user) where.status = "published";
      if (hasStatus && req.query.status) where.status = req.query.status;
      if (req.query.q && searchable.length) {
        where[Op.or] = searchable.map((f) => ({ [f]: { [Op.like]: `%${req.query.q}%` } }));
      }
      const items = await Model.findAll({ where, order });
      if (publicCache && !req.user) { const body = JSON.stringify(items); keepPub(req, body); return res.type("json").send(body); }
      res.json(items);
    }),

    getOne: asyncHandler(async (req, res) => {
      const key = req.params.id;
      const where = /^\d+$/.test(key) ? { id: key } : { slug: key };
      if (Model.name === "Seo") Object.assign(where, { page: key }, { id: undefined });
      const item = await Model.findOne({ where });
      if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
      if (hasStatus && !req.user && item.status !== "published") {
        return res.status(404).json({ message: `${Model.name} not found.` });
      }
      res.json(item);
    }),

    create: asyncHandler(async (req, res) => {
      const data = { ...req.body };
      if (slugFrom) data.slug = req.body.slug ? await uniqueSlug(req.body.slug) : await uniqueSlug(data[slugFrom]);
      const item = await Model.create(data);
      clearPub();
      if (onCreate) { try { await onCreate(item, req); } catch (e) { console.warn("onCreate hook:", e.message); } }
      res.status(201).json(item);
    }),

    update: asyncHandler(async (req, res) => {
      const item = await (load ? load(req) : Model.findByPk(req.params.id));
      if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
      const before = item.toJSON();
      const data = { ...req.body };
      if (slugFrom && req.body.slug && req.body.slug !== item.slug) {
        data.slug = await uniqueSlug(req.body.slug, item.id);
      }
      delete data.id;
      await item.update(data);
      clearPub();
      if (onUpdate) { try { await onUpdate(item, req, before); } catch (e) { console.warn("onUpdate hook:", e.message); } }
      res.json(item);
    }),

    remove: asyncHandler(async (req, res) => {
      const item = await Model.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
      await item.destroy();
      clearPub();
      res.json({ message: "Deleted.", id: Number(req.params.id) });
    }),
  };
}

module.exports = { crudController, asyncHandler };
