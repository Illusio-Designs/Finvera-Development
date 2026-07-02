const express = require("express");
const rateLimit = require("express-rate-limit");

const { Project, Service, Testimonial, TeamMember, BlogPost } = require("../models");
const { crudController } = require("../utils/crud");
const { requireAuth, optionalAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const authCtrl = require("../controllers/auth.controller");
const contactCtrl = require("../controllers/contact.controller");
const settingsCtrl = require("../controllers/settings.controller");
const uploadCtrl = require("../controllers/upload.controller");

const router = express.Router();

/* Build standard REST routes for a resource backed by the crud factory. */
function resource(path, Model, opts) {
  const c = crudController(Model, opts);
  const r = express.Router();
  r.get("/", optionalAuth, c.list);
  r.get("/:id", optionalAuth, c.getOne);
  r.post("/", requireAuth, c.create);
  r.put("/:id", requireAuth, c.update);
  r.patch("/:id", requireAuth, c.update);
  r.delete("/:id", requireAuth, c.remove);
  router.use(path, r);
}

/* ── Auth ────────────────────────────────────────────── */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const authRouter = express.Router();
authRouter.post("/login", loginLimiter, authCtrl.login);
authRouter.get("/me", requireAuth, authCtrl.me);
authRouter.post("/change-password", requireAuth, authCtrl.changePassword);
router.use("/auth", authRouter);

/* ── Content resources ───────────────────────────────── */
resource("/projects", Project, { slugFrom: "title", hasStatus: true, searchable: ["title", "category", "blurb"] });
resource("/services", Service, { slugFrom: "title", hasStatus: true, searchable: ["title", "description"] });
resource("/testimonials", Testimonial, { hasStatus: true, searchable: ["name", "company", "quote"] });
resource("/team", TeamMember, { hasStatus: true, searchable: ["name", "role"] });
resource("/blog", BlogPost, { slugFrom: "title", hasStatus: true, order: [["publishedAt", "DESC"], ["createdAt", "DESC"]], searchable: ["title", "excerpt", "category"] });

/* ── Contact ─────────────────────────────────────────── */
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const contactRouter = express.Router();
contactRouter.post("/", contactLimiter, contactCtrl.submit);
contactRouter.get("/", requireAuth, contactCtrl.list);
contactRouter.patch("/:id/read", requireAuth, contactCtrl.setRead);
contactRouter.delete("/:id", requireAuth, contactCtrl.remove);
router.use("/contact", contactRouter);

/* ── SEO ─────────────────────────────────────────────── */
const seoRouter = express.Router();
seoRouter.get("/", settingsCtrl.listSeo);
seoRouter.get("/:page", settingsCtrl.getSeo);
seoRouter.put("/:page", requireAuth, settingsCtrl.upsertSeo);
router.use("/seo", seoRouter);

/* ── Settings (analytics / pixels / brand) ───────────── */
const settingsRouter = express.Router();
settingsRouter.get("/", optionalAuth, settingsCtrl.getSettings);       // flat { key: value }
settingsRouter.get("/all", requireAuth, settingsCtrl.getSettingsDetailed);
settingsRouter.put("/", requireAuth, settingsCtrl.updateSettings);
router.use("/settings", settingsRouter);

/* ── Uploads ─────────────────────────────────────────── */
const uploadRouter = express.Router();
uploadRouter.post("/", requireAuth, upload.single("file"), uploadCtrl.uploadOne);
uploadRouter.post("/many", requireAuth, upload.array("files", 12), uploadCtrl.uploadMany);
router.use("/uploads", uploadRouter);

/* ── Health ──────────────────────────────────────────── */
router.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

module.exports = router;
