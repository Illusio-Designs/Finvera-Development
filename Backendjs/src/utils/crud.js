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

  return {
    uniqueSlug,

    list: asyncHandler(async (req, res) => {
      const where = {};
      // public callers only see published items
      if (hasStatus && !req.user) where.status = "published";
      if (hasStatus && req.query.status) where.status = req.query.status;
      if (req.query.q && searchable.length) {
        where[Op.or] = searchable.map((f) => ({ [f]: { [Op.like]: `%${req.query.q}%` } }));
      }
      const items = await Model.findAll({ where, order });
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
      if (onCreate) { try { await onCreate(item, req); } catch (e) { console.warn("onCreate hook:", e.message); } }
      res.status(201).json(item);
    }),

    update: asyncHandler(async (req, res) => {
      const item = await Model.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
      const before = item.toJSON();
      const data = { ...req.body };
      if (slugFrom && req.body.slug && req.body.slug !== item.slug) {
        data.slug = await uniqueSlug(req.body.slug, item.id);
      }
      delete data.id;
      await item.update(data);
      if (onUpdate) { try { await onUpdate(item, req, before); } catch (e) { console.warn("onUpdate hook:", e.message); } }
      res.json(item);
    }),

    remove: asyncHandler(async (req, res) => {
      const item = await Model.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: `${Model.name} not found.` });
      await item.destroy();
      res.json({ message: "Deleted.", id: Number(req.params.id) });
    }),
  };
}

module.exports = { crudController, asyncHandler };
