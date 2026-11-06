const express = require("express");
const rateLimit = require("express-rate-limit");

const { Project, Service, Testimonial, TeamMember, BlogPost, Task, Board, Page, Lead, Renewal,
  SocialClient, SocialPost, Faq, Value, Brand, Milestone, ProcessStep, Stat, Logo, Feature } = require("../models");
const { crudController, asyncHandler } = require("../utils/crud");
const { requireAuth, requireRole, requireArea, optionalAuth } = require("../middleware/auth");
const { upload } = require("../middleware/upload");

const authCtrl = require("../controllers/auth.controller");
const contactCtrl = require("../controllers/contact.controller");
const settingsCtrl = require("../controllers/settings.controller");
const uploadCtrl = require("../controllers/upload.controller");
const usersCtrl = require("../controllers/users.controller");
const notifCtrl = require("../controllers/notifications.controller");
const { notifyRoles, notifyUsers, notifyByName, notifyAdmins, brandUserIds } = require("../utils/notify");
const audit = require("../utils/audit");                           // activity history
const leadsCtrl = require("../controllers/leads.controller");     // lead follow-ups / touches

/* JSON arrays can come back as strings on some MySQL setups — coerce. */
const asArr = (v) => (Array.isArray(v) ? v : (typeof v === "string" && v.trim().startsWith("[") ? (() => { try { return JSON.parse(v); } catch { return []; } })() : []));

const router = express.Router();

/* Build standard REST routes for a resource backed by the crud factory.
   Reads stay public (the marketing site needs them); writes require the
   caller's role to include `area` (admin always passes). */
const publicLists = {}; // bootstrap key → crud controller (for /public/bootstrap)
function resource(path, Model, opts, area = "content") {
  // Signed-out reads (the marketing site) come from the shared public cache
  // (~60 s, cleared on every content write) with Cache-Control headers.
  const c = crudController(Model, { publicCache: true, ...opts, canReadDrafts: (req) => !!req.user && require("../utils/permissions").rolesCan(req.user.roles || [req.user.role], area) });
  if (opts.bootstrapKey) publicLists[opts.bootstrapKey] = c;
  const r = express.Router();
  const canWrite = [requireAuth, requireArea(area)];
  r.get("/", optionalAuth, c.list);
  r.get("/:id", optionalAuth, c.getOne);
  r.post("/", ...canWrite, ...(opts.validate ? [opts.validate] : []), c.create);
  r.put("/:id", ...canWrite, ...(opts.validate ? [opts.validate] : []), c.update);
  r.patch("/:id", ...canWrite, ...(opts.validate ? [opts.validate] : []), c.update);
  r.delete("/:id", ...canWrite, c.remove);
  router.use(path, r);
}

/* ── Auth ────────────────────────────────────────────── */
// Per IP; LOGIN_RATE_LIMIT overrides the count (default 20 per 15 min).
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: Number(process.env.LOGIN_RATE_LIMIT) || 20, standardHeaders: true, legacyHeaders: false, message: { message: "Too many sign-in attempts. Please wait a few minutes and try again." } });
const limitMsg = (max, mins) => rateLimit({ windowMs: mins * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { message: "Too many requests. Please wait a few minutes and try again." } });
const forgotLimiter = limitMsg(5, 15);
const resetLimiter = limitMsg(20, 15);
const authRouter = express.Router();
authRouter.post("/login", loginLimiter, authCtrl.login);
authRouter.post("/login/2fa", loginLimiter, authCtrl.login2fa);
authRouter.get("/me", requireAuth, authCtrl.me);
authRouter.put("/me", requireAuth, authCtrl.updateMe);
authRouter.post("/change-password", requireAuth, authCtrl.changePassword);
authRouter.post("/forgot", forgotLimiter, authCtrl.forgot);
authRouter.get("/reset-info", resetLimiter, authCtrl.resetInfo);
authRouter.post("/reset", resetLimiter, authCtrl.reset);
authRouter.get("/sessions", requireAuth, authCtrl.sessions);
authRouter.delete("/sessions/:id", requireAuth, authCtrl.revokeSession);
authRouter.post("/logout", requireAuth, authCtrl.logout);
authRouter.post("/logout-all", requireAuth, authCtrl.logoutAll);
authRouter.get("/activity", requireAuth, authCtrl.activity);
authRouter.post("/2fa/setup", requireAuth, authCtrl.twoFactorSetup);
authRouter.post("/2fa/enable", requireAuth, limitMsg(10, 15), authCtrl.twoFactorEnable);
authRouter.post("/2fa/disable", requireAuth, limitMsg(10, 15), authCtrl.twoFactorDisable);
authRouter.post("/2fa/backup-codes", requireAuth, limitMsg(10, 15), authCtrl.twoFactorBackupCodes);
router.use("/auth", authRouter);

/* ── Content resources ───────────────────────────────── */
/* Public list views (cards, "next project", sitemap) never use the long
   case-study / article bodies; those stay on GET /projects/:slug and
   GET /blog/:slug. Signed-in (admin) lists still return every column. */
const PROJECT_DETAIL_ONLY = ["content", "challenge", "approach", "results", "tech", "gallery",
  "testimonialQuote", "testimonialName", "testimonialRole", "seoTitle", "seoDescription"];
const projectActions = require("../controllers/projects.controller");
resource("/projects", Project, { validate: projectActions.validate, updateRecord: projectActions.updateRecord, onCreate: (item) => item.reload(), entity: "project", slugFrom: "title", hasStatus: true, searchable: ["title", "category", "blurb"], publicListExclude: PROJECT_DETAIL_ONLY, bootstrapKey: "projects" });
const serviceActions = require("../controllers/services.controller");
router.post("/services/reorder", requireAuth, requireArea("content"), serviceActions.reorder);
resource("/services", Service, { validate: serviceActions.validate, updateRecord: serviceActions.updateRecord, onCreate: (item) => item.reload(), entity: "service", slugFrom: "title", hasStatus: true, searchable: ["title", "description"], bootstrapKey: "services" });
const testimonialActions = require("../controllers/testimonials.controller");
resource("/testimonials", Testimonial, { validate: testimonialActions.validate, updateRecord: testimonialActions.updateRecord, onCreate: (item) => item.reload(), entity: "testimonial", hasStatus: true, searchable: ["name", "company", "quote"], bootstrapKey: "testimonials" });
const teamActions = require("../controllers/team.controller");
resource("/team", TeamMember, { validate: teamActions.validate, updateRecord: teamActions.updateRecord, onCreate: (item) => item.reload(), entity: "team-member", hasStatus: true, searchable: ["name", "role"], bootstrapKey: "team" });
const blogActions = require("../controllers/blog.controller");
resource("/blog", BlogPost, { validate: blogActions.validate, updateRecord: blogActions.updateRecord, onCreate: (item) => item.reload(), entity: "blog", slugFrom: "title", hasStatus: true, order: [["publishedAt", "DESC"], ["createdAt", "DESC"]], searchable: ["title", "excerpt", "category"], publicListExclude: ["content"] });
const pageActions = require("../controllers/pages.controller");
resource("/pages", Page, { validate: pageActions.validate, updateRecord: pageActions.updateRecord, onCreate: (item) => item.reload(), entity: "page", hasStatus: true, order: [["title", "ASC"]], searchable: ["title", "slug"], publicListExclude: ["content"] });

/* ── Editable content collections (public read, auth write) ─ */
const CONTENT_ORDER = [["position", "ASC"], ["createdAt", "ASC"]];
const faqActions = require("../controllers/faqs.controller");
router.post("/faqs/reorder", requireAuth, requireArea("content"), faqActions.reorder);
resource("/faqs", Faq, { validate: faqActions.validate, updateRecord: faqActions.updateRecord, onCreate: (item) => item.reload(), entity: "faq", hasStatus: true, order: [["position", "ASC"], ["createdAt", "ASC"], ["id", "ASC"]], searchable: ["question", "answer"], bootstrapKey: "faqs" });
const valueActions = require("../controllers/values.controller");
router.post("/values/reorder", requireAuth, requireArea("content"), valueActions.reorder);
resource("/values", Value, { validate: valueActions.validate, updateRecord: valueActions.updateRecord, onCreate: (item) => item.reload(), entity: "value", hasStatus: true, order: [["position", "ASC"], ["createdAt", "ASC"], ["id", "ASC"]], searchable: ["title", "description"], bootstrapKey: "values" });
resource("/brands", Brand, { entity: "brand", hasStatus: true, order: CONTENT_ORDER, searchable: ["name", "category"], bootstrapKey: "brands" });
resource("/milestones", Milestone, { entity: "milestone", hasStatus: true, order: CONTENT_ORDER, searchable: ["year", "title"], bootstrapKey: "milestones" });
resource("/process-steps", ProcessStep, { entity: "process-step", hasStatus: true, order: CONTENT_ORDER, searchable: ["title"], bootstrapKey: "processSteps" });
resource("/stats", Stat, { entity: "stat", hasStatus: true, order: CONTENT_ORDER, searchable: ["label"], bootstrapKey: "stats" });
resource("/logos", Logo, { entity: "logo", hasStatus: true, order: CONTENT_ORDER, searchable: ["name"], bootstrapKey: "logos" });
resource("/features", Feature, { entity: "feature", hasStatus: true, order: CONTENT_ORDER, searchable: ["title"], bootstrapKey: "features" });

/* ── Kanban boards (all endpoints require auth) ──────── */
const boardCtrl = crudController(Board, { entity: "board", order: [["position", "ASC"], ["createdAt", "ASC"]], searchable: ["name"] });
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
  entity: "task",
  order: [["position", "ASC"], ["createdAt", "ASC"]], searchable: ["title", "assignee", "label"],
  onCreate: async (t, req) => {
    await notifyUsers(asArr(t.memberIds), { type: "assigned", title: `You were assigned: ${t.title}`, link: `/dashboard/kanban?task=${t.id}`, meta: { taskId: t.id } }, req.user?.id);
  },
  onUpdate: async (t, req, before) => {
    const added = asArr(t.memberIds).filter((id) => !asArr(before.memberIds).includes(id));
    await notifyUsers(added, { type: "assigned", title: `You were assigned: ${t.title}`, link: `/dashboard/kanban?task=${t.id}`, meta: { taskId: t.id } }, req.user?.id);
    // Changes by someone else → the card's other members (one merged alert per burst of edits).
    const board = t.boardId ? await Board.findByPk(t.boardId) : null;
    const cols = asArr(board?.columns);
    const colTitle = (id) => cols.find((c) => c.id === id)?.title || id;
    const { kind, notes } = taskChanges(before, t, colTitle);
    const stay = asArr(t.memberIds).filter((id) => asArr(before.memberIds).includes(id));
    if (kind && stay.length) {
      const head = kind === "stage" ? `Moved to ${colTitle(t.column)}` : kind === "date" ? "Dates changed" : "Card updated";
      const render = (ns) => `${ns.join("; ")} · by ${req.user?.name || "someone"}`;
      await notifyUsers(stay, { type: "update", title: `${head}: ${t.title}`, body: render(notes), link: `/dashboard/kanban?task=${t.id}`, meta: { taskId: t.id } },
        req.user?.id, kind === "edit" ? { merge: { key: `task-${t.id}`, minutes: 15, notes, render } } : undefined); // only plain edits merge
    }
    // Reached Done → admins.
    const isDone = (col, completed) => completed || /done|complete|shipped/i.test(colTitle(col));
    if (isDone(t.column, t.completed) && !isDone(before.column, before.completed)) {
      await notifyAdmins({ type: "done", title: `Done: ${t.title}`, body: board ? `${board.name} · by ${req.user?.name || "someone"}` : undefined, link: `/dashboard/kanban?task=${t.id}`, meta: { taskId: t.id } }, req.user?.id);
    }
  },
});
const tasksCustom = require("../controllers/tasks.controller");
const taskRouter = express.Router();
taskRouter.get("/", ...canBoard, tasksCustom.list);          // supports ?boardId=
taskRouter.post("/", ...canBoard, taskCtrl.create);
taskRouter.post("/reorder", ...canBoard, tasksCustom.reorder); // one column's card order after a drag
taskRouter.put("/:id", ...canBoard, taskCtrl.update);
taskRouter.patch("/:id", ...canBoard, taskCtrl.update);
taskRouter.delete("/:id", ...canBoard, taskCtrl.remove);
taskRouter.get("/:taskId/comments", ...canBoard, tasksCustom.listComments);
taskRouter.post("/:taskId/comments", ...canBoard, tasksCustom.addComment);
router.use("/tasks", taskRouter);
router.delete("/comments/:id", ...canBoard, tasksCustom.deleteComment);
router.get("/website/overview", requireAuth, requireArea("content"), require("../controllers/website.controller").overview);

/* ── Leads (private BD pipeline — auth on every endpoint) ─ */
const leadCtrl = crudController(Lead, {
  entity: "lead",
  onRemove: (lead) => leadsCtrl.forgetLead(lead.id), // its touches go with it
  order: [["position", "ASC"], ["createdAt", "DESC"]], searchable: ["name", "company", "email", "source", "owner", "purpose"],
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
// Follow-ups: dashboard widget + touches log (before "/:id").
leadRouter.get("/follow-ups", ...canLeads, leadsCtrl.followUps);
leadRouter.get("/:id/touches", ...canLeads, leadsCtrl.touches);
leadRouter.post("/:id/touch", ...canLeads, leadsCtrl.touch);
leadRouter.post("/reorder", ...canLeads, leadsCtrl.reorder); // one board column's card order after a drag
leadRouter.get("/:id", ...canLeads, leadCtrl.getOne);
leadRouter.post("/", ...canLeads, leadsCtrl.validateLead, leadCtrl.create);
leadRouter.put("/:id", ...canLeads, leadsCtrl.validateLead, leadCtrl.update);
leadRouter.patch("/:id", ...canLeads, leadsCtrl.validateLead, leadCtrl.update);
leadRouter.delete("/:id", ...canLeads, leadCtrl.remove);
router.use("/leads", leadRouter);

/* ── Renewals (maintenance invoices — auth on every endpoint) ─ */
const renewalActions = require("../controllers/renewals.controller");
const renewalCtrl = crudController(Renewal, {
  updateRecord: renewalActions.updateRecord,
  entity: "renewal",
  order: [["renewalDate", "ASC"], ["position", "ASC"], ["createdAt", "DESC"]],
  searchable: ["client", "project", "owner", "email"],
  onCreate: async (rec, req) => {
    if (rec.owner) await notifyByName(rec.owner, { type: "renewal", title: `Renewal assigned to you: ${rec.client}`, body: rec.project || undefined, link: `/dashboard/renewals?renewal=${rec.id}`, meta: { renewalId: rec.id } }, req.user?.id);
  },
  onUpdate: async (rec, req, before) => {
    if (rec.owner && rec.owner !== before.owner) await notifyByName(rec.owner, { type: "renewal", title: `Renewal assigned to you: ${rec.client}`, body: rec.project || undefined, link: `/dashboard/renewals?renewal=${rec.id}`, meta: { renewalId: rec.id } }, req.user?.id);
  },
});
const renewalRouter = express.Router();
const canRenewals = [requireAuth, requireArea("renewals")];
renewalRouter.get("/", ...canRenewals, renewalCtrl.list);
renewalRouter.get("/:id", ...canRenewals, renewalCtrl.getOne);
renewalRouter.post("/", ...canRenewals, renewalActions.validate, renewalCtrl.create);
renewalRouter.put("/:id", ...canRenewals, renewalActions.validate, renewalCtrl.update);
renewalRouter.patch("/:id", ...canRenewals, renewalActions.validate, renewalCtrl.update);
renewalRouter.delete("/:id", ...canRenewals, renewalCtrl.remove);
renewalRouter.post("/:id/renew", ...canRenewals, renewalActions.renew);
renewalRouter.post("/:id/terminate", ...canRenewals, renewalActions.terminate);
renewalRouter.post("/:id/restore", ...canRenewals, renewalActions.restore);
renewalRouter.post("/:id/remarks", ...canRenewals, renewalActions.remark);
router.use("/renewals", renewalRouter);

/* ── Social media calendar (clients + posts — auth on every endpoint) ─ */
// Every social route also resolves the caller's brand scope (admin-set per user).
const social = require("../controllers/social.controller");
const autoPublish = require("../utils/autoPublish");
const { postChanges, taskChanges, when, fmtDate, day, STAGES } = require("../utils/changeNotes");
const canSocial = [requireAuth, requireArea("social"), social.withScope];
const kpiCtrl = require("../controllers/kpi.controller");
// Bulk changes to posts (imports, deletes) → clear the KPI cache once they succeed.
const kpiBump = (_req, res, next) => { res.on("finish", () => { if (res.statusCode < 400) kpiCtrl.bumpKpiCache(); }); next(); };
const socialClientCtrl = crudController(SocialClient, {
  entity: "social-client",
  order: [["position", "ASC"], ["name", "ASC"]], searchable: ["name"],
  onCreate: async (b, req) => {
    await notifyAdmins({ type: "info", title: `New brand added: ${b.name}`, body: `Content calendar · by ${req.user?.name || "someone"}`, link: "/dashboard/social" }, req.user?.id);
  },
});
const socialClientRouter = express.Router();
// Brand renames / removals → drop the cached brand-id → name scopes.
const scopeBump = (_req, res, next) => { res.on("finish", () => { if (res.statusCode < 400) social.forgetScopes(); }); next(); };
socialClientRouter.get("/", ...canSocial, social.listClients(socialClientCtrl.list));
socialClientRouter.post("/", ...canSocial, social.requireAllBrands, socialClientCtrl.create);
socialClientRouter.put("/:id", ...canSocial, social.requireAllBrands, scopeBump, socialClientCtrl.update);
socialClientRouter.patch("/:id", ...canSocial, social.requireAllBrands, scopeBump, socialClientCtrl.update);
socialClientRouter.delete("/:id", ...canSocial, social.requireAllBrands, scopeBump, socialClientCtrl.remove);
router.use("/social-clients", socialClientRouter);

const socialAssigned = (p) => ({ type: "assigned", title: p.status === "approval" ? `Approval needed: ${p.theme}` : `Social post assigned to you: ${p.theme}`, body: p.client, link: "/dashboard/social", meta: { socialPostId: p.id } });
const socialPostCtrl = crudController(SocialPost, {
  entity: "social-post",
  updateRecord: require("../utils/socialUpdate").updateRecord,
  removeRecord: (req) => require("../utils/socialDelete").deletePosts({ id: req.params.id }, req.socialScope),
  order: [["postDate", "ASC"], ["postTime", "ASC"], ["position", "ASC"]],
  searchable: ["client", "theme", "topic", "caption", "festive"],
  load: social.postOf, // the guards already loaded it — don't read it a second/third time
  onCreate: async (p, req) => {
    await social.grantBrand([p.assigneeId, p.clientContactOwnerId, ...Object.values(social.teamOf(p))], p.client);
    await social.recordEvents([social.eventOf(p, { byUserId: req.user?.id })]);
    kpiCtrl.bumpKpiCache();
    await autoPublish.syncJobs(p);
    if (p.assigneeId) await notifyUsers([p.assigneeId], socialAssigned(p), req.user?.id);
    // Everyone who works on this brand hears about the new post.
    const team = (await brandUserIds(p.client)).filter((id) => id !== p.assigneeId);
    await notifyUsers(team, { type: "info", title: `New post for ${p.client}: ${p.theme}`, body: p.postDate ? `Goes live ${when(p.postDate, p.postTime)}` : undefined, link: "/dashboard/social", meta: { socialPostId: p.id } }, req.user?.id);
  },
  onUpdate: async (p, req, before) => {
    // Brand access only changes when who works on it (or the brand) changes.
    if (before.assigneeId !== p.assigneeId || before.clientContactOwnerId !== p.clientContactOwnerId || before.client !== p.client || JSON.stringify(social.teamOf(before)) !== JSON.stringify(social.teamOf(p)))
      await social.grantBrand([p.assigneeId, p.clientContactOwnerId, ...Object.values(social.teamOf(p))], p.client);
    await autoPublish.syncJobs(p); // Ready → scheduled at go-live; date moves follow; leaving Ready cancels
    // Stage history: who had it before the move delivered that stage.
    // A step hand-off inside In production (designer → video editor) counts too.
    if (before.status !== p.status || before.assigneeId !== p.assigneeId || ((before.step || null) !== (p.step || null) && p.status === "production" && before.status === "production"))
      await social.recordEvents([social.eventOf(p, { from: before.status, fromAssigneeId: before.assigneeId, byUserId: req.user?.id })]);
    // KPIs read stages, assignees and go-live dates → recompute after any of them changes.
    if (before.status !== p.status || (before.step || null) !== (p.step || null) || before.assigneeId !== p.assigneeId || day(before.postDate) !== day(p.postDate))
      kpiCtrl.bumpKpiCache();
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
      try { await require("../utils/purgeMedia").purgeMedia(p); } catch (e) { console.warn("purge media:", e.message); } // live → delete our copies
      await notifyAdmins({ type: "done", title: `Posted: ${p.theme}`, body: `${p.client} · by ${req.user?.name || "someone"}`, link: "/dashboard/social", meta: { socialPostId: p.id } }, req.user?.id);
    }
  },
});
const SOCIAL_FIELDS = ["client", "status", "postDate", "postTime", "dueDate", "assigneeId", "estimateHours", "festive", "theme", "topic",
  "format", "requirements", "reference", "dataStatus", "poc", "caption", "driveLink", "tags", "keywords", "channels", "remarks", "position", "step", "team"];
const socialPostRouter = express.Router();
socialPostRouter.get("/", ...canSocial, social.listPosts(socialPostCtrl.list));
// Sheet uploads (admin): list batches, delete one batch, or clear a brand.
socialPostRouter.get("/uploads", ...canSocial, social.requireAllBrands, social.listUploads);
socialPostRouter.delete("/uploads/:batch", ...canSocial, social.requireAllBrands, kpiBump,
  audit.track("social-post", { action: "delete", idFrom: () => null, label: (_r, req) => `Sheet upload ${req.params.batch}`, summary: (_req, b) => `Deleted a sheet upload (${b?.deleted ?? 0} posts)` }), social.deleteUpload);
socialPostRouter.post("/delete-brand", ...canSocial, social.requireAllBrands, kpiBump,
  audit.track("social-post", { action: "delete", idFrom: () => null, label: (_r, req) => req.body?.client, summary: (req, b) => `Deleted every post of ${req.body?.client} (${b?.deleted ?? 0})` }), social.deleteBrandPosts);
socialPostRouter.post("/reassign-pending", ...canSocial, social.requireAllBrands, require("../controllers/socialReassign.controller").reassignPending);
socialPostRouter.get("/:id/preflight", ...canSocial, social.guardPost, asyncHandler(async (req, res) => {
  const post = await SocialPost.findByPk(req.params.id);
  const { SocialAccount, SocialPublishJob } = require("../models");
  const account = await SocialAccount.findOne({ where: { client: post.client } });
  const jobs = await SocialPublishJob.findAll({ where: { postId: post.id } });
  const platforms = autoPublish.targetsFor(post, account).filter((platform) => !jobs.some((job) => job.platform === platform && job.status === "published"));
  const issues = require("../utils/socialPreflight").preflight(post, platforms);
  for (const platform of platforms) {
    const problem = await require("../utils/socialMediaHealth").mediaProblem(post, platform);
    if (problem && !issues.some((issue) => issue.message === problem)) issues.push({ field: "media", message: problem, platform });
  }
  res.json({ issues, platforms, updatedAt: post.updatedAt });
}));
socialPostRouter.get("/:id", ...canSocial, social.guardPost, socialPostCtrl.getOne);
socialPostRouter.post("/", ...canSocial, social.guardBody, social.deadlineDefaults, social.assignOnCreate, (req, res, next) => { if (req.body.status && req.body.status !== "planned") return res.status(400).json({ message: "New posts start in Planned and must go through review." }); next(); }, socialPostCtrl.create);
// Bulk import (rows parsed from a client's media-calendar sheet).
socialPostRouter.post("/bulk", ...canSocial, social.guardBody, kpiBump, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.posts) ? req.body.posts.slice(0, 1000) : [];
    const clean = rows
      .map((r) => ({
        ...Object.fromEntries(SOCIAL_FIELDS.filter((f) => r[f] !== undefined && r[f] !== "").map((f) => [f, r[f]])),
        ...(r.altTheme ? { altTheme: String(r.altTheme).slice(0, 255) } : {}), // older title of the same row (see importRows)
      }))
      .filter((r) => r.client && r.theme);
    if (!clean.length) return res.status(400).json({ message: "No rows with a client and a post theme to import." });
    if (req.query.preview === "1") {
      const existing = await SocialPost.findAll({ where: { client: [...new Set(clean.map((row) => row.client))] }, attributes: ["id", "client", "theme", "postDate", "status", "importBatch"], raw: true });
      const key = (row, theme = row.theme) => `${row.client}|${String(row.postDate || "").slice(0, 10)}|${String(theme || "").trim().toLowerCase().replace(/\s+/g, " ")}`;
      const used = new Set();
      const preview = clean.map((row) => {
        const hit = existing.find((post) => !used.has(post.id) && (key(post) === key(row) || row.altTheme && post.importBatch && key(post) === key(row, row.altTheme)));
        if (!hit) return { theme: row.theme, action: "create" };
        used.add(hit.id);
        return { id: hit.id, theme: row.theme, action: ["planned", "client"].includes(hit.status) ? "update" : "skip", reason: ["planned", "client"].includes(hit.status) ? "Planning fields only; current version checked when importing." : "Work has started. Existing content and publishing results are protected." };
      });
      return res.json({ preview, created: preview.filter((row) => row.action === "create").length, updated: preview.filter((row) => row.action === "update").length, skipped: preview.filter((row) => row.action === "skip").length });
    }
    const brands = [...new Set(clean.map((r) => r.client))];
    for (const name of brands) {
      const [, made] = await SocialClient.findOrCreate({ where: { name } });
      if (made) await notifyAdmins({ type: "info", title: `New brand added: ${name}`, body: `From a sheet upload · by ${req.user?.name || "someone"}`, link: "/dashboard/social" }, req.user?.id);
    }
    const result = await social.importRows(clean, req); // { created, updated, batch }
    res.status(201).json(result);
    audit.record(req, { action: "other", entity: "social-post", entityId: null, entityLabel: brands.join(", ").slice(0, 250), changes: null,
      summary: `Sheet upload: ${result.created ?? 0} new, ${result.updated ?? 0} updated` });
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
socialPostRouter.delete("/:id", ...canSocial, social.guardPost, kpiBump, socialPostCtrl.remove);
router.use("/social-posts", socialPostRouter);

/* Auto-publishing: connect a brand's Facebook Page + Instagram, upload post
   media, and the publishing queue. */
const pub = require("../controllers/publish.controller");
const studio = require("../controllers/studio.controller");
router.get("/social-studio", ...canSocial, studio.overview);
// "Today" home page: counts, what needs you, this week, team on-time (one call).
router.get("/today", ...canSocial, require("../controllers/today.controller").today);
router.post("/social-accounts/:client/pause", ...canSocial, social.requireAllBrands, studio.pause);
router.get("/social-accounts/:client/profile", ...canSocial, studio.profile);
router.get("/social-accounts/:client/capabilities", ...canSocial, studio.capabilities);
router.put("/social-accounts/:client/profile", ...canSocial, social.requireAllBrands, studio.updateProfile);
router.get("/social-connect/meta/status", ...canSocial, pub.status);
router.get("/social-connect/meta/start", ...canSocial, social.requireAllBrands, pub.start);
router.get("/social-connect/meta/callback", pub.callback);               // Facebook redirects here
router.get("/social-connect/meta/pages", ...canSocial, social.requireAllBrands, pub.pages);
router.post("/social-connect/meta/choose", ...canSocial, social.requireAllBrands, pub.choose);
router.get("/social-accounts", ...canSocial, pub.accounts);
router.delete("/social-accounts/:client", ...canSocial, social.requireAllBrands, pub.disconnect);
router.get("/social-publish-jobs", ...canSocial, pub.jobs);
router.post("/social-publish-jobs/:id/retry", ...canSocial, pub.retry);
router.post("/social-publish-jobs/:id/mark-posted", ...canSocial, pub.markPosted);
router.get("/social-posts/:id/media-check", ...canSocial, social.guardPost, pub.mediaCheck);
router.post("/social-posts/:id/publish-now", ...canSocial, social.guardPost, pub.publishNow);
router.post("/social-media/upload", ...canSocial, pub.mediaUpload.array("files", 10), pub.uploadMedia);

/* Content calendar performance KPIs (admins: whole team; others: themselves). */
router.get("/social-kpis", ...canSocial, kpiCtrl.kpis);

/* ── Users ───────────────────────────────────────────── */
// Activity history for user changes (roles, brands, active …); the password
// is only ever noted as "(changed)". Runs around the handler, untouched.
const auditUser = audit.track("user", {
  load: (req, body) => { const id = req.params.id || body?.id; return id ? require("../models").User.findByPk(id, { attributes: { exclude: ["password"] } }) : null; },
  label: (u) => u?.name,
  summary: (req) => (req.method === "PUT" && req.body?.password ? "Password changed" : undefined),
});
const usersRouter = express.Router();
// Minimal member directory for assignment pickers — any signed-in user.
usersRouter.get("/assignable", requireAuth, usersCtrl.assignable);
// Full user management — admin only.
usersRouter.get("/", requireAuth, requireRole("admin"), usersCtrl.list);
usersRouter.post("/", requireAuth, requireRole("admin"), auditUser, usersCtrl.create);
usersRouter.post("/invite", requireAuth, requireRole("admin"), usersCtrl.invite);
usersRouter.put("/:id", requireAuth, requireRole("admin"), auditUser, usersCtrl.update);
usersRouter.delete("/:id", requireAuth, requireRole("admin"), auditUser, usersCtrl.remove);
// Account security actions — admin only.
const isAdmin = [requireAuth, requireRole("admin")];
usersRouter.post("/:id/reset-link", ...isAdmin, usersCtrl.resetLink);
usersRouter.post("/:id/require-password-change", ...isAdmin, usersCtrl.requirePasswordChange);
usersRouter.post("/:id/resend-invite", ...isAdmin, usersCtrl.resendInvite);
usersRouter.post("/:id/unlock", ...isAdmin, usersCtrl.unlock);
usersRouter.post("/:id/2fa/reset", ...isAdmin, usersCtrl.resetTwoFactor);
usersRouter.get("/:id/sessions", ...isAdmin, usersCtrl.userSessions);
usersRouter.delete("/:id/sessions/:sid", ...isAdmin, usersCtrl.userRevokeSession);
usersRouter.post("/:id/logout-all", ...isAdmin, usersCtrl.userLogoutAll);
usersRouter.get("/:id/activity", ...isAdmin, usersCtrl.userActivity);
router.use("/users", usersRouter);
router.get("/security/log", requireAuth, requireRole("admin"), usersCtrl.securityLog);

/* ── Notifications (each user sees their own) ─────────── */
const notifRouter = express.Router();
notifRouter.get("/", requireAuth, notifCtrl.list);
notifRouter.post("/read-all", requireAuth, notifCtrl.readAll);
notifRouter.post("/clear", requireAuth, notifCtrl.clear);
notifRouter.patch("/:id/read", requireAuth, notifCtrl.read);
router.use("/notifications", notifRouter);

/* ── Sidebar badge counts (COUNT queries; never 500s) ── */
router.get("/badges", requireAuth, require("../controllers/badges.controller").badges);
/* ── Admin Overview page: counts + recent messages + lead stages in one call ── */
router.get("/overview", requireAuth, require("../controllers/overview.controller").overview);

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
contactRouter.delete("/:id", ...canContact, audit.track("contact", { load: (req) => require("../models").ContactSubmission.findByPk(req.params.id), label: (m) => m?.name }), contactCtrl.remove);
router.use("/contact", contactRouter);
/* ═══ Contact inbox block: counts, one message, email replies, convert to lead ═══ */
const inboxCtrl = require("../controllers/contactInbox.controller");
const replyLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
router.get("/contact/counts", ...canContact, inboxCtrl.counts);
router.get("/contact/:id(\\d+)", ...canContact, inboxCtrl.getOne);
router.get("/contact/:id(\\d+)/replies", ...canContact, inboxCtrl.replies);
router.post("/contact/:id(\\d+)/reply", ...canContact, replyLimiter, inboxCtrl.reply);
router.post("/contact/:id(\\d+)/to-lead", ...canContact, inboxCtrl.toLead);
/* ═══ end of Contact inbox block ═══ */

/* ── SEO ─────────────────────────────────────────────── */
const seoRouter = express.Router();
seoRouter.get("/", optionalAuth, settingsCtrl.listSeo);        // public; signed-in reads skip the cache
seoRouter.get("/:page", optionalAuth, settingsCtrl.getSeo);
seoRouter.put("/:page", requireAuth, requireArea("seo"), require("../controllers/seo.controller").validate,
  audit.track("seo", { load: (req) => require("../models").Seo.findOne({ where: { page: req.params.page } }), idFrom: (req) => req.params.page, label: (_r, req) => req.params.page }),
  settingsCtrl.upsertSeo);
router.use("/seo", seoRouter);

/* ── Settings (analytics / pixels / brand) ───────────── */
// One history row per save: { key: [old, new] } for the keys that changed
// (values of secret-looking keys are never stored).
const auditSettings = audit.track("setting", {
  action: "update",
  load: async (req) => {
    const keys = (Array.isArray(req.body) ? req.body.map((e) => e && e.key) : Object.keys(req.body || {})).filter(Boolean).map(String).slice(0, 200);
    if (!keys.length) return {};
    const rows = await require("../models").Setting.findAll({ where: { key: keys }, attributes: ["key", "value"], raw: true });
    return Object.fromEntries(keys.map((k) => [k, rows.find((r) => r.key === k)?.value ?? null]));
  },
  idFrom: () => "settings", label: () => "Site settings",
});
const settingsRouter = express.Router();
settingsRouter.get("/", optionalAuth, settingsCtrl.getSettings);       // flat { key: value } — public (pixels)
settingsRouter.get("/all", requireAuth, requireArea("settings"), settingsCtrl.getSettingsDetailed);
settingsRouter.put("/", requireAuth, requireArea("settings"), auditSettings, settingsCtrl.updateSettings);
router.use("/settings", settingsRouter);

/* ── Uploads ─────────────────────────────────────────── */
const uploadRouter = express.Router();
uploadRouter.post("/", requireAuth, upload.single("file"), uploadCtrl.uploadOne);
uploadRouter.post("/many", requireAuth, upload.array("files", 12), uploadCtrl.uploadMany);
uploadRouter.post("/optimize-existing", requireAuth, requireRole("admin"), uploadCtrl.optimizeExisting); // older images, a batch per call
router.use("/uploads", uploadRouter);

/* ── Activity history (audit log) ────────────────────── */
const activityCtrl = require("../controllers/activity.controller");
router.get("/activity", requireAuth, requireRole("admin"), activityCtrl.list);
router.get("/activity/:entity/:id", requireAuth, activityCtrl.forItem);

/* ── Export (flat JSON rows; the dashboard builds the .xlsx) ── */
const exportCtrl = require("../controllers/export.controller");
router.get("/export/kpi-report", ...canSocial, exportCtrl.kpiReport);
router.get("/export/:entity", requireAuth, exportCtrl.scopeIfSocial, exportCtrl.exportEntity);
/* ═══ Ops block: backups, system status, email settings / preferences,
   Meta connection check, contact spam flag, cron hook. Kept separate from
   the routes above; everything here is admin-only unless noted. ═══════ */
const opsCtrl = require("../controllers/ops.controller");
const adminOnly = [requireAuth, requireRole("admin")];
// Off-server copy (token, no login) — must come before /backups/:name.
router.get("/backups/latest", rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }), opsCtrl.latestBackup);
router.get("/backups", ...adminOnly, opsCtrl.listBackups);
router.post("/backups", ...adminOnly, rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false }), opsCtrl.createBackup);
router.get("/backups/:name/download", ...adminOnly, opsCtrl.downloadBackup);
router.post("/backups/:name/verify", ...adminOnly, opsCtrl.verifyBackup);
router.delete("/backups/:name", ...adminOnly, opsCtrl.deleteBackup);
router.get("/system/status", ...adminOnly, opsCtrl.systemStatus);
router.get("/settings/email-status", ...adminOnly, opsCtrl.emailStatus);
router.post("/settings/test-email", ...adminOnly, rateLimit({ windowMs: 10 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false }), opsCtrl.testEmail);
router.get("/auth/me/email-prefs", requireAuth, opsCtrl.getEmailPrefs);   // any signed-in user, own prefs
router.put("/auth/me/email-prefs", requireAuth, opsCtrl.putEmailPrefs);
router.post("/social-accounts/check", ...adminOnly, opsCtrl.checkSocialAccounts);
router.patch("/contact/:id/spam", requireAuth, requireArea("contact"), contactCtrl.setSpam);
// Every cron ping also records the tick and starts the daily backup / Meta check (once a day each).
router.get(["/cron/daily", "/cron/tick"], (_req, _res, next) => { opsCtrl.onCronTick().catch(() => {}); next(); });
/* ═══ end of Ops block ═══ */

/* ── Daily reminders wake-up (pinged by a scheduled GitHub workflow at
   10:16 AM IST; safe to call any time — it only runs once per day, after
   10:15, and never reveals anything) ─────────────────── */
const cronTick = async (_req, res) => {
  const { maybeRunDaily } = require("../utils/dailyReminders");
  const r = await maybeRunDaily();
  await autoPublish.runDue({ force: true }); // posts due to go live
  await social.maintenance(); // unassigned-post sweep + default deadlines (never throws)
  studio.refreshAllStudio().catch(() => {}); // stale Meta numbers, in the background (one run at a time)
  res.json({ ok: true, ran: !!r.ran });
};
router.get("/cron/daily", cronTick);
router.get("/cron/tick", cronTick); // point a cPanel cron here every 5 minutes

/* ── Public bootstrap (marketing site) ───────────────────
   Everything the public pages read, in one response: settings, SEO for
   every page and each published content list (slim project cards). The site
   makes one request instead of ~15 (each one a full round trip to the API).
   Built from the same cached bodies as the individual endpoints, which keep
   working unchanged. */
const pubCache = require("../utils/publicCache");
router.get("/public/bootstrap", async (_req, res, next) => {
  try {
    const parts = await Promise.all([
      settingsCtrl.publicSettingsBody().then((b) => `"settings":${b}`),
      settingsCtrl.publicSeoMapBody().then((b) => `"seo":${b}`),
      ...Object.entries(publicLists).map(([key, c]) => c.publicListBody().then((b) => `${JSON.stringify(key)}:${b}`)),
    ]);
    pubCache.sendPublic(res, `{${parts.join(",")}}`);
  } catch (e) { next(e); }
});

/* ── Health ──────────────────────────────────────────── */
const { health } = require("../controllers/health.controller");
router.get("/health", health);

module.exports = router;
