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
];

/* ENUM columns whose allowed values grew (sync() never ALTERs an existing
   table). Widened in place with MODIFY, keeping nullability and default. */
const WANTED_ENUMS = [
  { table: "users", column: "role", values: ["admin", "editor", "content", "projects", "leads", "seo", "social", "marketer", "graphic"], def: "admin" },
];

async function ensureEnums(sequelize) {
  for (const w of WANTED_ENUMS) {
    try {
      const [rows] = await sequelize.query(
        "SELECT COLUMN_TYPE AS t, IS_NULLABLE AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        { replacements: [w.table, w.column] }
      );
      const cur = rows && rows[0];
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
  await ensureEnums(sequelize);
  for (const w of WANTED) {
    try {
      const [rows] = await sequelize.query(
        "SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        { replacements: [w.table, w.column] }
      );
      const exists = Number(rows && rows[0] && rows[0].c) > 0;
      if (!exists) {
        await sequelize.query(`ALTER TABLE \`${w.table}\` ADD COLUMN \`${w.column}\` ${w.def}`);
        console.log(`\x1b[32m✔ Added missing column ${w.table}.${w.column}\x1b[0m`);
      }
    } catch (e) {
      console.warn(`\x1b[33m⚠ ensureColumns ${w.table}.${w.column}:\x1b[0m`, e.message);
    }
  }
};
