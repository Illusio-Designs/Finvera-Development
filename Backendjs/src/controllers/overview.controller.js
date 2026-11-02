/* GET /api/overview — the admin Overview page in one small call.
   {
     counts:  { projects, services, testimonials, team, blog },        // every item, drafts too
     contact: { total, unread, recent: [ { id, name, email, projectType, createdAt, isRead } ×6 ] } | null,
     leads:   { total, byStage: { new: { count, value }, … } } | null,
   }
   The page used to download every project, blog post, message and lead just
   to count them. Sections the caller's roles can't open are null. */

const { fn, col, literal, QueryTypes } = require("sequelize");
const { sequelize, Project, Service, Testimonial, TeamMember, BlogPost, ContactSubmission, Lead } = require("../models");
const { asyncHandler } = require("../utils/crud");
const { rolesCan } = require("../utils/permissions");

const COUNTED = { projects: Project, services: Service, testimonials: Testimonial, team: TeamMember, blog: BlogPost };
/* Every count in one round trip: SELECT (SELECT COUNT(*) FROM projects) AS projects, … */
const COUNT_SQL = "SELECT " + Object.entries(COUNTED).map(([k, M]) => `(SELECT COUNT(*) FROM \`${M.getTableName()}\`) AS \`${k}\``).join(", ");

const overview = asyncHandler(async (req, res) => {
  const roles = req.user.roles || [];
  const [counts, contact, leads] = await Promise.all([
    sequelize.query(COUNT_SQL, { type: QueryTypes.SELECT })
      .then(([row]) => Object.fromEntries(Object.keys(COUNTED).map((k) => [k, Number(row?.[k]) || 0]))),
    rolesCan(roles, "contact")
      ? Promise.all([
        ContactSubmission.findOne({ attributes: [[fn("COUNT", col("id")), "total"], [literal("SUM(CASE WHEN `isRead` IS NULL OR `isRead` = 0 THEN 1 ELSE 0 END)"), "unread"]], raw: true }),
        ContactSubmission.findAll({ attributes: ["id", "name", "email", "projectType", "createdAt", "isRead"], order: [["createdAt", "DESC"]], limit: 6, raw: true }),
      ]).then(([agg, recent]) => ({ total: Number(agg?.total) || 0, unread: Number(agg?.unread) || 0, recent: recent.map((m) => ({ ...m, isRead: !!m.isRead })) }))
      : null,
    rolesCan(roles, "leads")
      ? Lead.findAll({ attributes: ["stage", [fn("COUNT", col("id")), "count"], [fn("SUM", col("value")), "value"]], group: ["stage"], raw: true })
        .then((rows) => {
          const byStage = {};
          for (const r of rows) byStage[r.stage] = { count: Number(r.count) || 0, value: Number(r.value) || 0 };
          return { total: rows.reduce((s, r) => s + (Number(r.count) || 0), 0), byStage };
        })
      : null,
  ]);
  res.json({ counts, contact, leads });
});

module.exports = { overview };
