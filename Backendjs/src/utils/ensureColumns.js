/* Additive, idempotent column guard.

   Checks information_schema and adds only the columns that are actually
   missing — an indexed lookup per column, so it's cheap and safe to run on
   every boot (unlike a full sync({ alter: true }) scan, which was heavy and
   contributed to worker pile-up). This self-heals schema drift for newly
   added columns without any manual SQL or env flags. It also widens ENUM
   columns whose allowed values grew (e.g. the `social` user role). */

const WANTED = [
  { table: "tasks", column: "startDate", def: "DATE NULL" },
  { table: "tasks", column: "renewalDate", def: "DATE NULL" },
  { table: "users", column: "roles", def: "JSON NULL" },
  { table: "users", column: "socialClients", def: "JSON NULL" },
  { table: "social_posts", column: "importBatch", def: "VARCHAR(40) NULL" },
  { table: "social_posts", column: "media", def: "JSON NULL" },
  { table: "social_posts", column: "publishTo", def: "JSON NULL" },
  { table: "social_posts", column: "keywordHashtags", def: "TINYINT(1) NOT NULL DEFAULT 1" },
  { table: "social_posts", column: "step", def: "VARCHAR(20) NULL" },
  { table: "social_posts", column: "team", def: "JSON NULL" },
  { table: "social_accounts", column: "paused", def: "JSON NULL" },
  { table: "social_accounts", column: "stats", def: "JSON NULL" },
  { table: "social_accounts", column: "statsAt", def: "DATETIME NULL" },
  { table: "social_publish_jobs", column: "metrics", def: "JSON NULL" },
  { table: "social_publish_jobs", column: "metricsAt", def: "DATETIME NULL" },
  // Lead follow-ups. `after` runs once, right after the column is added.
  { table: "leads", column: "ownerId", def: "INT NULL",
    after: "UPDATE `leads` l JOIN `users` u ON u.`name` = l.`owner` SET l.`ownerId` = u.`id` WHERE l.`ownerId` IS NULL AND l.`owner` IS NOT NULL AND l.`owner` <> ''" },
  { table: "leads", column: "nextFollowUpAt", def: "DATE NULL",
    after: "UPDATE `leads` SET `nextFollowUpAt` = `nextFollowUp` WHERE `nextFollowUpAt` IS NULL AND `nextFollowUp` IS NOT NULL" },
  { table: "leads", column: "followUpNote", def: "TEXT NULL" },
  { table: "leads", column: "meetingUrl", def: "VARCHAR(500) NULL" },
  { table: "leads", column: "meetingAt", def: "DATETIME NULL" },
  { table: "leads", column: "lastContactedAt", def: "DATETIME NULL" },
  { table: "leads", column: "lostReason", def: "VARCHAR(500) NULL" },
];

/* ENUM columns whose allowed values grew (sync() never ALTERs an existing
   table). Widened in place with MODIFY, keeping nullability and default. */
const WANTED_ENUMS = [
  { table: "users", column: "role", values: ["admin", "editor", "content", "projects", "leads", "seo", "social", "marketer", "graphic", "video"], def: "admin" },
  { table: "social_posts", column: "status", values: ["planned", "client", "production", "approval", "ready", "posted"], def: "planned" },
];

/* Every column of the tables we care about, in ONE information_schema query
   (it used to be one query per column — ~17 round trips on every cold start,
   and information_schema is slow on shared MySQL). "table.column" → info. */
async function columnsOf(sequelize) {
  const tables = [...new Set([...WANTED, ...WANTED_ENUMS].map((w) => w.table))];
  const [rows] = await sequelize.query(
    "SELECT TABLE_NAME AS tb, COLUMN_NAME AS c, COLUMN_TYPE AS t, IS_NULLABLE AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)",
    { replacements: [tables] }
  );
  const map = new Map();
  for (const r of rows || []) map.set(`${r.tb}.${r.c}`, r);
  return map;
}
const tableKnown = (cols, table) => [...cols.keys()].some((k) => k.startsWith(`${table}.`));

async function ensureEnums(sequelize, cols) {
  for (const w of WANTED_ENUMS) {
    try {
      const cur = cols.get(`${w.table}.${w.column}`);
      if (!cur) continue; // table not created yet — sync() will create it with the full list
      const have = String(cur.t).match(/'([^']*)'/g)?.map((v) => v.slice(1, -1)) || [];
      const missing = w.values.filter((v) => !have.includes(v));
      if (!missing.length) continue;
      const all = [...have, ...missing].map((v) => sequelize.escape(v)).join(",");
      const nul = cur.n === "YES" ? "NULL" : "NOT NULL";
      await sequelize.query(`ALTER TABLE \`${w.table}\` MODIFY COLUMN \`${w.column}\` ENUM(${all}) ${nul} DEFAULT ${sequelize.escape(w.def)}`);
      console.log(`\x1b[32m✔ Extended ${w.table}.${w.column} with ${missing.join(", ")}\x1b[0m`);
    } catch (e) {
      console.warn(`\x1b[33m⚠ ensureEnums ${w.table}.${w.column}:\x1b[0m`, e.message);
    }
  }
}

module.exports = async function ensureColumns(sequelize) {
  const cols = await columnsOf(sequelize);
  await ensureEnums(sequelize, cols);
  for (const w of WANTED) {
    try {
      if (!tableKnown(cols, w.table)) continue; // table not created yet — sync() makes it with every column
      const exists = cols.has(`${w.table}.${w.column}`);
      if (!exists) {
        await sequelize.query(`ALTER TABLE \`${w.table}\` ADD COLUMN \`${w.column}\` ${w.def}`);
        console.log(`\x1b[32m✔ Added missing column ${w.table}.${w.column}\x1b[0m`);
        if (w.after) await sequelize.query(w.after).catch((e) => console.warn(`\x1b[33m⚠ backfill ${w.table}.${w.column}:\x1b[0m`, e.message));
      }
    } catch (e) {
      console.warn(`\x1b[33m⚠ ensureColumns ${w.table}.${w.column}:\x1b[0m`, e.message);
    }
  }
};
