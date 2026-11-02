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
];

module.exports = async function ensureIndexes(sequelize) {
  for (const w of WANTED) {
    try {
      const [[t]] = await sequelize.query(
        "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        { replacements: [w.table] }
      );
      if (!Number(t && t.c)) continue; // table not there yet — nothing to index
      const [[s]] = await sequelize.query(
        "SELECT COUNT(*) AS c FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
        { replacements: [w.table, w.name] }
      );
      if (Number(s && s.c) > 0) continue;
      const cols = w.columns.map((c) => `\`${c}\``).join(", ");
      await sequelize.query(`CREATE INDEX \`${w.name}\` ON \`${w.table}\` (${cols})`);
      console.log(`\x1b[32m✔ Added index ${w.table}.${w.name}\x1b[0m`);
    } catch (e) {
      console.warn(`\x1b[33m⚠ ensureIndexes ${w.table}.${w.name}:\x1b[0m`, e.message);
    }
  }
};
