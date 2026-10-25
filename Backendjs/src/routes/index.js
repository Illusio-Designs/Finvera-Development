const express = require("express");
const rateLimit = require("express-rate-limit");

const { Project, Service, Testimonial, TeamMember, BlogPost, Task, Board, Page, Lead, Renewal,
  SocialClient, SocialPost, Faq, Value, Brand, Milestone, ProcessStep, Stat, Logo, Feature } = require("../models");
const { crudController } = require("../utils/crud");
const { requireAuth, requireRole, requireArea, optionalAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const authCtrl = require("../controllers/auth.controller");
const contactCtrl = require("../controllers/contact.controller");
const settingsCtrl = require("../controllers/settings.controller");
const uploadCtrl = require("../controllers/upload.controller");
const usersCtrl = require("../controllers/users.controller");
const notifCtrl = require("../controllers/notifications.controller");
const { notifyRoles, notifyUsers, notifyByName, notifyAdmins, brandUserIds } = require("../utils/notify");

/* JSON arrays can come back as strings on some MySQL setups — coerce. */
const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));

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

/* ── Kanban boards (all endpoints require auth) ──────── */
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

/* ── Kanban tasks + comments (all require auth) ──────── */
const taskCtrl = crudController(Task, {
  order: [["position", "ASC"], ["createdAt", "ASC"]], searchable: ["title", "assignee", "label"],
  onCreate: async (t, req) => {
    await notifyUsers(asArr(t.memberIds), { type: "assigned", title: `You were assigned: ${t.title}`, link: "/dashboard/kanban", meta: { taskId: t.id } }, req.user?.id);
  },
  onUpdate: async (t, req, before) => {
    const added = asArr(t.memberIds).filter((id) => !asArr(before.memberIds).includes(id));
    await notifyUsers(added, { type: "assigned", title: `You were assigned: ${t.title}`, link: "/dashboard/kanban", meta: { taskId: t.id } }, req.user?.id);
    // Changes by someone else → the card's other members (one merged alert per burst of edits).
    const board = t.boardId ? await Board.findByPk(t.boardId) : null;
    const cols = asArr(board?.columns);
    const colTitle = (id) => cols.find((c) => c.id === id)?.title || id;
    const { kind, notes } = taskChanges(before, t, colTitle);
    const stay = asArr(t.memberIds).filter((id) => asArr(before.memberIds).includes(id));
    if (kind && stay.length) {
      const head = kind === "stage" ? `Moved to ${colTitle(t.column)}` : kind === "date" ? "Dates changed" : "Card updated";
      const render = (ns) => `${ns.join("; ")} · by ${req.user?.name || "someone"}`;
      await notifyUsers(stay, { type: "update", title: `${head}: ${t.title}`, body: render(notes), link: "/dashboard/kanban", meta: { taskId: t.id } },
        req.user?.id, kind === "edit" ? { merge: { key: `task-${t.id}`, minutes: 15, notes, render } } : undefined); // only plain edits merge
    }
    // Reached Done → admins.
    const isDone = (col, completed) => completed || /done|complete|shipped/i.test(colTitle(col));
    if (isDone(t.column, t.completed) && !isDone(before.column, before.completed)) {
      await notifyAdmins({ type: "done", title: `Done: ${t.title}`, body: board ? `${board.name} · by ${req.user?.name || "someone"}` : undefined, link: "/dashboard/kanban", meta: { taskId: t.id } }, req.user?.id);
    }
  },
});
const tasksCustom = require("../controllers/tasks.controller");
const taskRouter = express.Router();
taskRouter.get("/", ...canBoard, tasksCustom.list);          // supports ?boardId=
taskRouter.post("/", ...canBoard, taskCtrl.create);
taskRouter.put("/:id", ...canBoard, taskCtrl.update);
taskRouter.patch("/:id", ...canBoard, taskCtrl.update);
taskRouter.delete("/:id", ...canBoard, taskCtrl.remove);
taskRouter.get("/:taskId/comments", ...canBoard, tasksCustom.listComments);
taskRouter.post("/:taskId/comments", ...canBoard, tasksCustom.addComment);
router.use("/tasks", taskRouter);
router.delete("/comments/:id", ...canBoard, tasksCustom.deleteComment);

/* ── Leads (private BD pipeline — auth on every endpoint) ─ */
const leadCtrl = crudController(Lead, {
  order: [["position", "ASC"], ["createdAt", "DESC"]], searchable: ["name", "company", "email", "source", "owner"],
  onCreate: async (lead, req) => {
    await notifyRoles(["leads"], { type: "lead", title: `New lead: ${lead.name}`, body: lead.company || undefined, link: "/dashboard/leads", meta: { leadId: lead.id } }, req.user?.id);
    if (lead.owner) await notifyByName(lead.owner, { type: "assigned", title: `Lead assigned to you: ${lead.name}`, link: "/dashboard/leads", meta: { leadId: lead.id } }, req.user?.id);
  },
  onUpdate: async (lead, req, before) => {
    if (lead.owner && lead.owner !== before.owner) await notifyByName(lead.owner, { type: "assigned", title: `Lead assigned to you: ${lead.name}`, link: "/dashboard/leads", meta: { leadId: lead.id } }, req.user?.id);
  },
});
const leadRouter = express.Router();
const canLeads = [requireAuth, requireArea("leads")];
leadRouter.get("/", ...canLeads, leadCtrl.list);
leadRouter.get("/:id", ...canLeads, leadCtrl.getOne);
leadRouter.post("/", ...canLeads, leadCtrl.create);
leadRouter.put("/:id", ...canLeads, leadCtrl.update);
leadRouter.patch("/:id", ...canLeads, leadCtrl.update);
leadRouter.delete("/:id", ...canLeads, leadCtrl.remove);
router.use("/leads", leadRouter);

/* ── Renewals (maintenance invoices — auth on every endpoint) ─ */
const renewalCtrl = crudController(Renewal, {
  order: [["renewalDate", "ASC"], ["position", "ASC"], ["createdAt", "DESC"]],
  searchable: ["client", "project", "owner", "email"],
  onCreate: async (rec, req) => {
    if (rec.owner) await notifyByName(rec.owner, { type: "renewal", title: `Renewal assigned to you: ${rec.client}`, body: rec.project || undefined, link: "/dashboard/renewals", meta: { renewalId: rec.id } }, req.user?.id);
  },
  onUpdate: async (rec, req, before) => {
    if (rec.owner && rec.owner !== before.owner) await notifyByName(rec.owner, { type: "renewal", title: `Renewal assigned to you: ${rec.client}`, body: rec.project || undefined, link: "/dashboard/renewals", meta: { renewalId: rec.id } }, req.user?.id);
  },
});
const renewalRouter = express.Router();
const canRenewals = [requireAuth, requireArea("renewals")];
renewalRouter.get("/", ...canRenewals, renewalCtrl.list);
renewalRouter.get("/:id", ...canRenewals, renewalCtrl.getOne);
renewalRouter.post("/", ...canRenewals, renewalCtrl.create);
renewalRouter.put("/:id", ...canRenewals, renewalCtrl.update);
renewalRouter.patch("/:id", ...canRenewals, renewalCtrl.update);
renewalRouter.delete("/:id", ...canRenewals, renewalCtrl.remove);
router.use("/renewals", renewalRouter);

/* ── Social media calendar (clients + posts — auth on every endpoint) ─ */
// Every social route also resolves the caller's brand scope (admin-set per user).
const social = require("../controllers/social.controller");
const { postChanges, taskChanges, when, fmtDate, day, STAGES } = require("../utils/changeNotes");
const canSocial = [requireAuth, requireArea("social"), social.withScope];
const socialClientCtrl = crudController(SocialClient, {
  order: [["position", "ASC"], ["name", "ASC"]], searchable: ["name"],
  onCreate: async (b, req) => {
    await notifyAdmins({ type: "info", title: `New brand added: ${b.name}`, body: `Content calendar · by ${req.user?.name || "someone"}`, link: "/dashboard/social" }, req.user?.id);
  },
});
const socialClientRouter = express.Router();
socialClientRouter.get("/", ...canSocial, social.listClients(socialClientCtrl.list));
socialClientRouter.post("/", ...canSocial, social.requireAllBrands, socialClientCtrl.create);
socialClientRouter.put("/:id", ...canSocial, social.requireAllBrands, socialClientCtrl.update);
socialClientRouter.patch("/:id", ...canSocial, social.requireAllBrands, socialClientCtrl.update);
socialClientRouter.delete("/:id", ...canSocial, social.requireAllBrands, socialClientCtrl.remove);
router.use("/social-clients", socialClientRouter);

const socialAssigned = (p) => ({ type: "assigned", title: `Social post assigned to you: ${p.theme}`, body: p.client, link: "/dashboard/social", meta: { socialPostId: p.id } });
const socialPostCtrl = crudController(SocialPost, {
  order: [["postDate", "ASC"], ["postTime", "ASC"], ["position", "ASC"]],
  searchable: ["client", "theme", "topic", "caption", "festive"],
  onCreate: async (p, req) => {
    if (p.assigneeId) await notifyUsers([p.assigneeId], socialAssigned(p), req.user?.id);
    // Everyone who works on this brand hears about the new post.
    const team = (await brandUserIds(p.client)).filter((id) => id !== p.assigneeId);
    await notifyUsers(team, { type: "info", title: `New post for ${p.client}: ${p.theme}`, body: p.postDate ? `Goes live ${when(p.postDate, p.postTime)}` : undefined, link: "/dashboard/social", meta: { socialPostId: p.id } }, req.user?.id);
  },
  onUpdate: async (p, req, before) => {
    const reassigned = p.assigneeId && p.assigneeId !== before.assigneeId;
    if (reassigned) await notifyUsers([p.assigneeId], socialAssigned(p), req.user?.id);
    // Changes by someone else → the person who has it (unless they just got it, above).
    const { kind, notes } = postChanges(before, p);
    if (kind && p.assigneeId && !reassigned) {
      const head = kind === "stage" ? `Moved to ${STAGES[p.status] || p.status}` : kind === "date" ? "Date changed" : "Post edited";
      const render = (ns) => `${p.client} · ${ns.join("; ")} · by ${req.user?.name || "someone"}`;
      await notifyUsers([p.assigneeId], { type: "update", title: `${head}: ${p.theme}`, body: render(notes), link: "/dashboard/social", meta: { socialPostId: p.id } },
        req.user?.id, kind === "edit" ? { merge: { key: `post-${p.id}`, minutes: 15, notes, render } } : undefined); // only plain edits merge
    }
    if (p.status === "posted" && before.status !== "posted") {
      await notifyAdmins({ type: "done", title: `Posted: ${p.theme}`, body: `${p.client} · by ${req.user?.name || "someone"}`, link: "/dashboard/social", meta: { socialPostId: p.id } }, req.user?.id);
    }
  },
});
const SOCIAL_FIELDS = ["client", "status", "postDate", "postTime", "dueDate", "assigneeId", "estimateHours", "festive", "theme", "topic",
  "format", "requirements", "reference", "dataStatus", "poc", "caption", "driveLink", "tags", "keywords", "channels", "remarks", "position"];
const socialPostRouter = express.Router();
socialPostRouter.get("/", ...canSocial, social.listPosts(socialPostCtrl.list));
// Sheet uploads (admin): list batches, delete one batch, or clear a brand.
socialPostRouter.get("/uploads", ...canSocial, social.requireAllBrands, social.listUploads);
socialPostRouter.delete("/uploads/:batch", ...canSocial, social.requireAllBrands, social.deleteUpload);
socialPostRouter.post("/delete-brand", ...canSocial, social.requireAllBrands, social.deleteBrandPosts);
socialPostRouter.get("/:id", ...canSocial, social.guardPost, socialPostCtrl.getOne);
socialPostRouter.post("/", ...canSocial, social.guardBody, social.deadlineDefaults, social.assignOnCreate, socialPostCtrl.create);
// Bulk import (rows parsed from a client's media-calendar sheet).
socialPostRouter.post("/bulk", ...canSocial, social.guardBody, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.posts) ? req.body.posts.slice(0, 1000) : [];
    const clean = rows
      .map((r) => Object.fromEntries(SOCIAL_FIELDS.filter((f) => r[f] !== undefined && r[f] !== "").map((f) => [f, r[f]])))
      .filter((r) => r.client && r.theme);
    if (!clean.length) return res.status(400).json({ message: "No rows with a client and a post theme to import." });
    const brands = [...new Set(clean.map((r) => r.client))];
    for (const name of brands) {
      const [, made] = await SocialClient.findOrCreate({ where: { name } });
      if (made) await notifyAdmins({ type: "info", title: `New brand added: ${name}`, body: `From a sheet upload · by ${req.user?.name || "someone"}`, link: "/dashboard/social" }, req.user?.id);
    }
    const result = await social.importRows(clean); // { created, updated, batch }
    res.status(201).json(result);
    // One alert per brand for the whole upload, to everyone on that brand.
    for (const name of brands) {
      const rowsOf = clean.filter((r) => r.client === name);
      const dates = rowsOf.map((r) => day(r.postDate)).filter(Boolean).sort();
      const range = dates.length ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}` : "";
      const team = await brandUserIds(name);
      const created = result.createdBy?.[name] ?? null, updated = result.updatedBy?.[name] ?? null;
      const title = created ? `${created} new post${created === 1 ? "" : "s"} added to ${name}` : `${name} calendar updated`;
      const body = [range && `Calendar ${range}`, updated ? `${updated} post${updated === 1 ? "" : "s"} updated` : "", `by ${req.user?.name || "someone"}`].filter(Boolean).join(" · ");
      await notifyUsers(team, { type: "info", title, body, link: "/dashboard/social" }, req.user?.id);
    }
  } catch (e) { next(e); }
});
socialPostRouter.put("/:id", ...canSocial, social.guardPost, social.deadlineDefaults, social.assignOnStageChange, socialPostCtrl.update);
socialPostRouter.patch("/:id", ...canSocial, social.guardPost, social.deadlineDefaults, social.assignOnStageChange, socialPostCtrl.update);
socialPostRouter.delete("/:id", ...canSocial, social.guardPost, socialPostCtrl.remove);
router.use("/social-posts", socialPostRouter);

/* ── Users ───────────────────────────────────────────── */
const usersRouter = express.Router();
// Minimal member directory for assignment pickers — any signed-in user.
usersRouter.get("/assignable", requireAuth, usersCtrl.assignable);
// Full user management — admin only.
usersRouter.get("/", requireAuth, requireRole("admin"), usersCtrl.list);
usersRouter.post("/", requireAuth, requireRole("admin"), usersCtrl.create);
usersRouter.put("/:id", requireAuth, requireRole("admin"), usersCtrl.update);
usersRouter.delete("/:id", requireAuth, requireRole("admin"), usersCtrl.remove);
router.use("/users", usersRouter);

/* ── Notifications (each user sees their own) ─────────── */
const notifRouter = express.Router();
notifRouter.get("/", requireAuth, notifCtrl.list);
notifRouter.post("/read-all", requireAuth, notifCtrl.readAll);
notifRouter.post("/clear", requireAuth, notifCtrl.clear);
notifRouter.patch("/:id/read", requireAuth, notifCtrl.read);
router.use("/notifications", notifRouter);

/* ── Web Push (phone / desktop notifications) ────────── */
const pushCtrl = require("../controllers/push.controller");
const pushRouter = express.Router();
pushRouter.get("/key", pushCtrl.key);
pushRouter.post("/subscribe", requireAuth, pushCtrl.subscribe);
pushRouter.post("/unsubscribe", requireAuth, pushCtrl.unsubscribe);
pushRouter.post("/test", requireAuth, rateLimit({ windowMs: 10 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false }), pushCtrl.test);
router.use("/push", pushRouter);

/* ── Contact ─────────────────────────────────────────── */
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const contactRouter = express.Router();
const canContact = [requireAuth, requireArea("contact")];
contactRouter.post("/", contactLimiter, contactCtrl.submit);   // public website form
contactRouter.get("/", ...canContact, contactCtrl.list);
contactRouter.patch("/:id/read", ...canContact, contactCtrl.setRead);
contactRouter.delete("/:id", ...canContact, contactCtrl.remove);
router.use("/contact", contactRouter);

/* ── SEO ─────────────────────────────────────────────── */
const seoRouter = express.Router();
seoRouter.get("/", settingsCtrl.listSeo);
seoRouter.get("/:page", settingsCtrl.getSeo);
seoRouter.put("/:page", requireAuth, requireArea("seo"), settingsCtrl.upsertSeo);
router.use("/seo", seoRouter);

/* ── Settings (analytics / pixels / brand) ───────────── */
const settingsRouter = express.Router();
settingsRouter.get("/", optionalAuth, settingsCtrl.getSettings);       // flat { key: value } — public (pixels)
settingsRouter.get("/all", requireAuth, requireArea("settings"), settingsCtrl.getSettingsDetailed);
settingsRouter.put("/", requireAuth, requireArea("settings"), settingsCtrl.updateSettings);
router.use("/settings", settingsRouter);

/* ── Uploads ─────────────────────────────────────────── */
const uploadRouter = express.Router();
uploadRouter.post("/", requireAuth, upload.single("file"), uploadCtrl.uploadOne);
uploadRouter.post("/many", requireAuth, upload.array("files", 12), uploadCtrl.uploadMany);
router.use("/uploads", uploadRouter);

/* ── Daily reminders wake-up (pinged by a scheduled GitHub workflow at
   10:16 AM IST; safe to call any time — it only runs once per day, after
   10:15, and never reveals anything) ─────────────────── */
router.get("/cron/daily", async (_req, res) => {
  const { maybeRunDaily } = require("../utils/dailyReminders");
  const r = await maybeRunDaily();
  res.json({ ok: true, ran: !!r.ran });
});

/* ── Health ──────────────────────────────────────────── */
const { health } = require("../controllers/health.controller");
router.get("/health", health);

module.exports = router;
