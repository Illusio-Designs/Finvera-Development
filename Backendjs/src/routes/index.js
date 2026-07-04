const express = require("express");
const rateLimit = require("express-rate-limit");

const { Project, Service, Testimonial, TeamMember, BlogPost, Task, Board, Page, Lead } = require("../models");
const { crudController } = require("../utils/crud");
const { requireAuth, requireRole, optionalAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const authCtrl = require("../controllers/auth.controller");
const contactCtrl = require("../controllers/contact.controller");
const settingsCtrl = require("../controllers/settings.controller");
const uploadCtrl = require("../controllers/upload.controller");
const usersCtrl = require("../controllers/users.controller");

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

/* ── Auth ── */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const authRouter = express.Router();
authRouter.post("/login", loginLimiter, authCtrl.login);
authRouter.get("/me", requireAuth, authCtrl.me);
authRouter.post("/change-password", requireAuth, authCtrl.changePassword);
router.use("/auth", authRouter);

/* ── Content resources ── */
resource("/projects", Project, { slugFrom: "title", hasStatus: true, searchable: ["title", "category", "blurb"] });
resource("/services", Service, { slugFrom: "title", hasStatus: true, searchable: ["title", "description"] });
resource("/testimonials", Testimonial, { hasStatus: true, searchable: ["name", "company", "quote"] });
resource("/team", TeamMember, { hasStatus: true, searchable: ["name", "role"] });
resource("/blog", BlogPost, { slugFrom: "title", hasStatus: true, order: [["publishedAt", "DESC"], ["createdAt", "DESC"]], searchable: ["title", "excerpt", "category"] });
resource("/pages", Page, { slugFrom: "title", hasStatus: true, order: [["title", "ASC"]], searchable: ["title", "slug"] });

/* ── Kanban boards (all endpoints require auth) ── */
const boardCtrl = crudController(Board, { order: [["position", "ASC"], ["createdAt", "ASC"]], searchable: ["name"] });
const boardRouter = express.Router();
boardRouter.get("/", requireAuth, boardCtrl.list);
boardRouter.get("/:id", requireAuth, boardCtrl.getOne);
boardRouter.post("/", requireAuth, boardCtrl.create);
boardRouter.put("/:id", requireAuth, boardCtrl.update);
boardRouter.patch("/:id", requireAuth, boardCtrl.update);
boardRouter.delete("/:id", requireAuth, boardCtrl.remove);
router.use("/boards", boardRouter);

/* ── Kanban tasks + comments (all require auth) ── */
const taskCtrl = crudController(Task, { order: [["position", "ASC"], ["createdAt", "ASC"]], searchable: ["title", "assignee", "label"] });
const tasksCustom = require("../controllers/tasks.controller");
const taskRouter = express.Router();
taskRouter.get("/", requireAuth, tasksCustom.list);
taskRouter.post("/", requireAuth, taskCtrl.create);
taskRouter.put("/:id", requireAuth, taskCtrl.update);
taskRouter.patch("/:id", requireAuth, taskCtrl.update);
taskRouter.delete("/:id", requireAuth, taskCtrl.remove);
taskRouter.get("/:taskId/comments", requireAuth, tasksCustom.listComments);
taskRouter.post("/:taskId/comments", requireAuth, tasksCustom.addComment);
router.use("/tasks", taskRouter);
router.delete("/comments/:id", requireAuth, tasksCustom.deleteComment);

/* ── Leads (private BD pipeline — auth on every endpoint) ── */
const leadCtrl = crudController(Lead, { order: [["position", "ASC"], ["createdAt", "DESC"]], searchable: ["name", "company", "email", "source", "owner"] });
const leadRouter = express.Router();
leadRouter.get("/", requireAuth, leadCtrl.list);
leadRouter.get("/:id", requireAuth, leadCtrl.getOne);
leadRouter.post("/", requireAuth, leadCtrl.create);
leadRouter.put("/:id", requireAuth, leadCtrl.update);
leadRouter.patch("/:id", requireAuth, leadCtrl.update);
leadRouter.delete("/:id", requireAuth, leadCtrl.remove);
router.use("/leads", leadRouter);

/* ── Users (admin only) ── */
const usersRouter = express.Router();
usersRouter.get("/", requireAuth, requireRole("admin"), usersCtrl.list);
usersRouter.post("/", requireAuth, requireRole("admin"), usersCtrl.create);
usersRouter.put("/:id", requireAuth, requireRole("admin"), usersCtrl.update);
usersRouter.delete("/:id", requireAuth, requireRole("admin"), usersCtrl.remove);
router.use("/users", usersRouter);

/* ── Contact ── */
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const contactRouter = express.Router();
contactRouter.post("/", contactLimiter, contactCtrl.submit);
contactRouter.get("/", requireAuth, contactCtrl.list);
contactRouter.patch("/:id/read", requireAuth, contactCtrl.setRead);
contactRouter.delete("/:id", requireAuth, contactCtrl.remove);
router.use("/contact", contactRouter);

/* ── SEO ── */
const seoRouter = express.Router();
seoRouter.get("/", settingsCtrl.listSeo);
seoRouter.get("/:page", settingsCtrl.getSeo);
seoRouter.put("/:page", requireAuth, settingsCtrl.upsertSeo);
router.use("/seo", seoRouter);

/* ── Settings (analytics / pixels / brand) ── */
const settingsRouter = express.Router();
settingsRouter.get("/", optionalAuth, settingsCtrl.getSettings);
settingsRouter.get("/all", requireAuth, settingsCtrl.getSettingsDetailed);
settingsRouter.put("/", requireAuth, settingsCtrl.updateSettings);
router.use("/settings", settingsRouter);

/* ── Uploads ── */
const uploadRouter = express.Router();
uploadRouter.post("/", requireAuth, upload.single("file"), uploadCtrl.uploadOne);
uploadRouter.post("/many", requireAuth, upload.array("files", 12), uploadCtrl.uploadMany);
router.use("/uploads", uploadRouter);

/* ── Health ── */
const { health } = require("../controllers/health.controller");
router.get("/health", health);

module.exports = router;
