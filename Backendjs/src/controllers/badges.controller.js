const { Op } = require("sequelize");
const { SocialPost, SocialClient, ContactSubmission, User } = require("../models");
const { rolesCan, rolesOf } = require("../utils/permissions");
const { brandIdsOf } = require("./social.controller");

/* Today's date in India (Asia/Kolkata) as YYYY-MM-DD. */
const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/* GET /api/badges — sidebar counts as cheap COUNT queries.
     socialOverdue: posts not 'posted' whose postDate is before today (IST)
     approvals:     posts in 'approval'
     inboxUnread:   unread contact submissions
     leadsFollowUpToday / leadsFollowUpOverdue: open leads with a follow-up
                    date today / before today (admins: all; others: theirs)
   Admins count every post; other social users count only posts assigned to
   them within their brands. Areas the caller can't see are 0. Never 500s —
   a failing count is reported as 0. */
async function badges(req, res) {
  const out = { socialOverdue: 0, approvals: 0, inboxUnread: 0, leadsFollowUpToday: 0, leadsFollowUpOverdue: 0 };
  try { await count(req, out); } catch (e) { console.warn("badges:", e.message); }
  res.json(out);
}

async function count(req, out) {
  const roles = (req.user && req.user.roles) || [];
  const jobs = [];
  const safe = async (key, fn) => { try { out[key] = Number(await fn()) || 0; } catch (e) { console.warn(`badges.${key}:`, e.message); } };

  if (rolesCan(roles, "social")) {
    let scope = null; // null → every post (admin)
    try {
      const user = req.userRow || await User.findByPk(req.user.id);
      const ids = brandIdsOf(user || { roles: rolesOf(req.user), role: req.user.role });
      if (ids) {
        const names = ids.length ? await require("./social.controller").brandNames(ids) : []; // cached briefly
        scope = { assigneeId: req.user.id, client: names };
      }
    } catch (e) {
      console.warn("badges.scope:", e.message);
      scope = false;
    }
    if (scope !== false && !(scope && !scope.client.length)) {
      const mine = scope || {};
      jobs.push(safe("socialOverdue", () => SocialPost.count({ where: { ...mine, status: { [Op.ne]: "posted" }, postDate: { [Op.lt]: todayIST() } } })));
      jobs.push(safe("approvals", () => SocialPost.count({ where: { ...mine, status: "approval" } })));
    }
  }
  if (rolesCan(roles, "contact")) {
    jobs.push(safe("inboxUnread", () => ContactSubmission.count({ where: { [Op.or]: [{ isRead: false }, { isRead: null }] } })));
  }
  // Lead follow-ups due today / overdue (admins: every open lead; others: their own).
  if (rolesCan(roles, "leads")) {
    jobs.push(require("./leads.controller").followUpCounts(req.user, roles.includes("admin"))
      .then((c) => Object.assign(out, c)).catch((e) => console.warn("badges.leads:", e.message)));
  }
  await Promise.all(jobs); // the counts run side by side
}

module.exports = { badges, todayIST };
