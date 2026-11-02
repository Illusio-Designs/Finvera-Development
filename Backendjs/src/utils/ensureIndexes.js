/* Additive, idempotent index guard.

   sync() creates indexes only for tables it creates; existing tables never
   get new ones. This checks information_schema.STATISTICS by index name and
   runs CREATE INDEX only when it's missing — cheap and safe on every boot.
   Never throws: a failed index must not stop the API from starting. */

const WANTED = [
  { table: "social_posts", name: "idx_social_posts_client_status", columns: ["client", "status"] },
  { table: "social_posts", name: "idx_social_posts_postDate", columns: ["postDate"] },
  { table: "social_posts", name: "idx_social_posts_assigneeId", columns: ["assigneeId"] },
  { table: "social_posts", name: "idx_social_posts_importBatch", columns: ["importBatch"] },
  { table: "notifications", name: "idx_notifications_userId_isRead", columns: ["userId", "isRead"] },
  // The bell: a user's newest 40 (WHERE userId ORDER BY createdAt DESC LIMIT 40) without a filesort.
  { table: "notifications", name: "idx_notifications_userId_createdAt", columns: ["userId", "createdAt"] },
  // Contact inbox / Overview "recent messages" (ORDER BY createdAt DESC).
  { table: "contact_submissions", name: "idx_contact_createdAt", columns: ["createdAt"] },
  // Today: posts in Pending approval (status = 'approval') and the badge counts.
  { table: "social_posts", name: "idx_social_posts_status_postDate", columns: ["status", "postDate"] },
  // Public site lists: WHERE status = 'published' ORDER BY position, createdAt
  // (crud list + /public/bootstrap) — one index per content table so the
  // filter + sort is an index range scan instead of a full scan + filesort.
  ...["projects", "services", "testimonials", "team_members", "faqs", "values", "brands",
    "milestones", "process_steps", "stats", "logos", "features"].map((t) => (
    { table: t, name: `idx_${t}_status_position`, columns: ["status", "position", "createdAt"] })),
  // Blog list: WHERE status = 'published' ORDER BY publishedAt DESC, createdAt DESC.
  { table: "blog_posts", name: "idx_blog_posts_status_publishedAt", columns: ["status", "publishedAt", "createdAt"] },
  // Public settings map: WHERE isPublic = 1 AND group <> 'system'.
  { table: "settings", name: "idx_settings_isPublic_group", columns: ["isPublic", "group"] },
];

module.exports = async function ensureIndexes(sequelize) {
  // Two information_schema reads for the whole list (not two per index):
  // they're slow on shared MySQL and this runs on every cold start.
  const tables = [...new Set(WANTED.map((w) => w.table))];
  const [trows] = await sequelize.query(
    "SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)",
    { replacements: [tables] }
  );
  const [irows] = await sequelize.query(
    "SELECT DISTINCT TABLE_NAME AS t, INDEX_NAME AS i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)",
    { replacements: [tables] }
  );
  const haveTable = new Set((trows || []).map((r) => r.t));
  const haveIndex = new Set((irows || []).map((r) => `${r.t}.${r.i}`));
  for (const w of WANTED) {
    try {
      if (!haveTable.has(w.table)) continue; // table not there yet — nothing to index
      if (haveIndex.has(`${w.table}.${w.name}`)) continue;
      const cols = w.columns.map((c) => `\`${c}\``).join(", ");
      await sequelize.query(`CREATE INDEX \`${w.name}\` ON \`${w.table}\` (${cols})`);
      console.log(`\x1b[32m✔ Added index ${w.table}.${w.name}\x1b[0m`);
    } catch (e) {
      console.warn(`\x1b[33m⚠ ensureIndexes ${w.table}.${w.name}:\x1b[0m`, e.message);
    }
  }
};
