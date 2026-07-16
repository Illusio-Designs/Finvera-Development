/* Additive, idempotent column guard.

   Checks information_schema and adds only the columns that are actually
   missing — an indexed lookup per column, so it's cheap and safe to run on
   every boot (unlike a full sync({ alter: true }) scan, which was heavy and
   contributed to worker pile-up). This self-heals schema drift for newly
   added columns without any manual SQL or env flags. */

const WANTED = [
  { table: "tasks", column: "startDate", def: "DATE NULL" },
  { table: "tasks", column: "renewalDate", def: "DATE NULL" },
  { table: "users", column: "roles", def: "JSON NULL" },
];

module.exports = async function ensureColumns(sequelize) {
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
