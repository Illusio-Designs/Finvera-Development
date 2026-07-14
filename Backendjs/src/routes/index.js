const express = require("express");
const rateLimit = require("express-rate-limit");

const { Project, Service, Testimonial, TeamMember, BlogPost, Task, Board, Page, Lead,
  Faq, Value, Brand, Milestone, ProcessStep, Stat, Logo, Feature } = require("../models");
const { crudController } = require("../utils/crud");
const { requireAuth, requireRole, requireArea, optionalAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const authCtrl = require("../controllers/auth.controller");
const contactCtrl = require("../controllers/contact.controller");
const settingsCtrl = require("../controllers/settings.controller");
const uploadCtrl = require("../controllers/upload.controller");
const usersCtrl = require("../controllers/users.controller");

const router = express.Router();

/* Build standard REST routes for a resource backed by the crud factory.
   Reads stay public (the marketing site needs them); writes require the
   caller's role to include `area` (admin always passes). */
function resource(path, Model, opts, area = "content") {
  const c = crudController(Model, opts);
  const r = express.Router();
  const canWrite = [requireAuth, requireArea(area)];
  r.get("/", optionalAuth, c.list);
  r.get("/:id", optionalAuth, c.getOne);
  r.post("/", ...canWrite, c.create);
  r.put("/:id", ...canWrite, c.update);
  r.patch("/:id", ...canWrite, c.update);
  r.delete("/:id", ...canWrite, c.remove);
  router.use(path, r);
}

/* ── Auth ───────────────────────────── */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const authRouter = express.Router();
authRouter.post("/login", loginLimiter, authCtrl.login);
authRouter.get("/me", requireAuth, authCtrl.me);
authRouter.post("/change-password", requireAuth, authCtrl.changePassword);
router.use("/auth", authRouter);

/* ── Content resources ──────────────────── */
resource("/projects", Project, { slugFrom: "title", hasStatus: true, searchable: ["title", "category", "blurb"] });
resource("/services", Service, { slugFrom: "title", hasStatus: true, searchable: ["title", "description"] });
resource("/testimonials", Testimonial, { hasStatus: true, searchable: ["name", "company", "quote"] });
resource("/team", TeamMember, { hasStatus: true, searchable: ["name", "role"] });
resource("/blog", BlogPost, { slugFrom: "title", hasStatus: true, order: [["publishedAt", "DESC"], ["createdAt", "DESC"]], searchable: ["title", "excerpt", "category"] });
resource("/pages", Page, { slugFrom: "title", hasStatus: true, order: [["title", "ASC"]], searchable: ["title", "slug"] });

/* ── Editable content collections (public read, auth write) ─ */
const CONTENT_ORDER = [["position", "ASC"], ["createdAt", "ASC"]];
resource("/faqs", Faq, { hasStatus: true, order: CONTENT_ORDER, searchable: ["question", "answer"] });
resource("/values", Value, { hasStatus: true, order: CONTENT_ORDER, searchable: ["title", "description"] });
resource("/brands", Brand, { hasStatus: true, order: CONTENT_ORDER, searchable: ["name", "category"] });
resource("/milestones", Milestone, { hasStatus: true, order: CONTENT_ORDER, searchable: ["year", "title"] });
resource("/process-steps", ProcessStep, { hasStatus: true, order: CONTENT_ORDER, searchable: ["title"] });
resource("/stats", Stat, { hasStatus: true, order: CONTENT_ORDER, searchable: ["label"] });
resource("/logos", Logo, { hasStatus: true, order: CONTENT_ORDER, searchable: ["name"] });
resource("/features", Feature, { hasStatus: true, order: CONTENT_ORDER, searchable: ["title"] });

/* ── Kanban boards (board area) ──────── */
const boardCtrl = crudController(Board, { order: [["position", "ASC"], ["createdAt", "ASC"]], searchable: ["name"] });
const boardRouter = express.Router();
const canBoard = [requireAuth, requireArea("board")];
boardRouter.get("/", ...canBoard, boardCtrl.list);
boardRouter.get("/:id", ...canBoard, boardCtrl.getOne);
boardRouter.post("/", ...canBoard, boardCtrl.create);
boardRouter.put("/:id", ...canBoard, boardCtrl.update);
boardRouter.patch("/:id", ...canBoard, boardCtrl.update);
boardRouter.delete("/:id", ...canBoard, boardCtrl.remove);
router.use("/boards", boardRouter);

/* ── Kanban tasks + comments (board area) ──────── */
const taskCtrl = crudController(Task, { order: [["position", "ASC"], ["createdAt", "ASC"]], searchable: ["title", "assignee", "label"] });
const tasksCustom = require("../controllers/tasks.controller");
const taskRouter = express.Router();
taskRouter.get("/", ...canBoard, tasksCustom.list);
taskRouter.post("/", ...canBoard, taskCtrl.create);
taskRouter.put("/:id", ...canBoard, taskCtrl.update);
taskRouter.patch("/:id", ...canBoard, taskCtrl.update);
taskRouter.delete("/:id", ...canBoard, taskCtrl.remove);
taskRouter.get("/:taskId/comments", ...canBoard, tasksCustom.listComments);
taskRouter.post("/:taskId/comments", ...canBoard, tasksCustom.addComment);
router.use("/tasks", taskRouter);
router.delete("/comments/:id", ...canBoard, tasksCustom.deleteComment);

/* ── Leads (leads area) ────────────── */
const leadCtrl = crudController(Lead, { order: [["position", "ASC"], ["createdAt", "DESC"]], searchable: ["name", "company", "email", "source", "owner"] });
const leadRouter = express.Router();
const canLeads = [requireAuth, requireArea("leads")];
leadRouter.get("/", ...canLeads, leadCtrl.list);
leadRouter.get("/:id", ...canLeads, leadCtrl.getOne);
leadRouter.post("/", ...canLeads, leadCtrl.create);
leadRouter.put("/:id", ...canLeads, leadCtrl.update);
leadRouter.patch("/:id", ...canLeads, leadCtrl.update);
leadRouter.delete("/:id", ...canLeads, leadCtrl.remove);
router.use("/leads", leadRouter);

/* ── Users ────────────────────────── */
const usersRouter = express.Router();
// Minimal member directory for assignment pickers — any signed-in user.
usersRouter.get("/assignable", requireAuth, usersCtrl.assignable);
// Full user management — admin only.
usersRouter.get("/", requireAuth, requireRole("admin"), usersCtrl.list);
usersRouter.post("/", requireAuth, requireRole("admin"), usersCtrl.create);
usersRouter.put("/:id", requireAuth, requireRole("admin"), usersCtrl.update);
usersRouter.delete("/:id", requireAuth, requireRole("admin"), usersCtrl.remove);
router.use("/users", usersRouter);

/* ── Contact (contact area) ────────────────── */
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const contactRouter = express.Router();
const canContact = [requireAuth, requireArea("contact")];
contactRouter.post("/", contactLimiter, contactCtrl.submit);   // public website form
contactRouter.get("/", ...canContact, contactCtrl.list);
contactRouter.patch("/:id/read", ...canContact, contactCtrl.setRead);
contactRouter.delete("/:id", ...canContact, contactCtrl.remove);
router.use("/contact", contactRouter);

/* ── SEO (seo area) ──────────────────────── */
const seoRouter = express.Router();
seoRouter.get("/", settingsCtrl.listSeo);
seoRouter.get("/:page", settingsCtrl.getSeo);
seoRouter.put("/:page", requireAuth, requireArea("seo"), settingsCtrl.upsertSeo);
router.use("/seo", seoRouter);

/* ── Settings (settings area) ─────────── */
const settingsRouter = express.Router();
settingsRouter.get("/", optionalAuth, settingsCtrl.getSettings);       // flat { key: value } — public (pixels)
settingsRouter.get("/all", requireAuth, requireArea("settings"), settingsCtrl.getSettingsDetailed);
settingsRouter.put("/", requireAuth, requireArea("settings"), settingsCtrl.updateSettings);
router.use("/settings", settingsRouter);

/* ── Uploads ────────────────────────── */
const uploadRouter = express.Router();
uploadRouter.post("/", requireAuth, upload.single("file"), uploadCtrl.uploadOne);
uploadRouter.post("/many", requireAuth, upload.array("files", 12), uploadCtrl.uploadMany);
router.use("/uploads", uploadRouter);

/* ── Health ───────────────────────── */
const { health } = require("../controllers/health.controller");
router.get("/health", health);

module.exports = router;
