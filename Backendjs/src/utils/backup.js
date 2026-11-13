const { dailyState, claimDate } = require("./taskMachine");
/* Database backups in pure JS (shared hosting has no mysqldump).

   createBackup() writes every base table — DROP + `SHOW CREATE TABLE` + batched
   multi-row INSERTs — into backups/finvera-YYYYMMDD-HHMMSS-<kind>.sql.gz. Rows
   are read in pages (keyset on a numeric primary key, else LIMIT/OFFSET) and
   streamed through gzip with back-pressure, so memory stays flat whatever the
   size. All reads run in one REPEATABLE READ transaction (one consistent
   snapshot). The file is written as *.partial and renamed when complete, and a
   small <name>.json sidecar keeps { tables, rows, createdAt, ... } for the list.

   The dump is a normal mysqldump-style script: restore it in phpMyAdmin →
   database → Import (the .sql.gz can be uploaded as is).

   maybeRunDailyBackup() runs once per India-time day (after 02:30), claimed
   atomically in settings so several app processes never back up twice; the
   newest BACKUP_KEEP (default 14) files are kept. Nothing here throws to the
   caller: failures are logged and stored in settings as backup.lastResult. */

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");
const { once } = require("events");
const { Op, QueryTypes, Transaction } = require("sequelize");
const { sequelize, Setting } = require("../models");

const DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, "..", "..", "backups"));
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP || 14));
const PAGE = 500;                      // rows per SELECT
const MAX_STMT = 512 * 1024;           // split INSERTs at ~512 KB (phpMyAdmin / max_allowed_packet friendly)
const NAME_RE = /^finvera-\d{8}-\d{6}-(auto|manual)(-\d{1,3})?\.sql\.gz$/;
const RUN_AT_MIN = 2 * 60 + 30;        // 02:30 IST
const CLAIM_KEY = "backup.lastRun";
const RESULT_KEY = "backup.lastResult";

/* ── Names / paths (strict: no traversal, only our own file names) ── */
function isValidName(name) {
  return typeof name === "string" && name.length < 80 && NAME_RE.test(name) && path.basename(name) === name;
}
function fileFor(name) {
  if (!isValidName(name)) return null;
  const full = path.resolve(DIR, name);
  if (path.dirname(full) !== DIR) return null;
  return full;
}

/* ── SQL literal escaping (same rules as mysqldump / mysql's escape) ── */
const pad = (n, w = 2) => String(n).padStart(w, "0");
function sqlDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "'0000-00-00 00:00:00'";
  // Sequelize reads DATETIMEs in UTC (+00:00); the dump sets time_zone='+00:00'.
  return `'${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}${d.getUTCMilliseconds() ? "." + pad(d.getUTCMilliseconds(), 3) : ""}'`;
}
const CHAR_ESC = { "\0": "\\0", "\b": "\\b", "\t": "\\t", "\n": "\\n", "\r": "\\r", "\x1a": "\\Z", "'": "\\'", '"': '\\"', "\\": "\\\\" };
const sqlString = (s) => `'${String(s).replace(/[\0\b\t\n\r\x1a'"\\]/g, (c) => CHAR_ESC[c])}'`;
function sqlValue(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return sqlDate(v);
  if (Buffer.isBuffer(v)) return v.length ? `X'${v.toString("hex")}'` : "''";
  if (typeof v === "object") return sqlString(JSON.stringify(v)); // JSON columns parsed by the driver
  return sqlString(v);
}
const looksJson = (s) => { try { JSON.parse(s); return true; } catch { return false; } };
const qid = (s) => "`" + String(s).replace(/`/g, "``") + "`";

/* ── Helpers ── */
const stamp = (d = new Date()) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
const istDay = () => {
  const d = new Date(Date.now() + 330 * 60000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
};
async function setResult(obj) {
  try {
    const value = JSON.stringify(obj);
    const [row, made] = await Setting.findOrCreate({ where: { key: RESULT_KEY }, defaults: { key: RESULT_KEY, value, group: "system", isPublic: false } });
    if (!made) await row.update({ value });
  } catch (e) { console.warn("backup result:", e.message); }
}
async function getResult() {
  try {
    const row = await Setting.findOne({ where: { key: RESULT_KEY } });
    return row?.value ? JSON.parse(row.value) : null;
  } catch { return null; }
}

/* ── Create ── */
let running = null; // in-process: one backup at a time (manual + daily)

function createBackup({ kind = "manual" } = {}) {
  if (running) return running;
  running = doBackup(kind).finally(() => { running = null; });
  return running;
}

async function doBackup(kind) {
  const started = Date.now();
  await fsp.mkdir(DIR, { recursive: true });
  let name = `finvera-${stamp()}-${kind === "auto" ? "auto" : "manual"}.sql.gz`;
  for (let i = 2; fs.existsSync(path.join(DIR, name)) && i < 100; i++) name = name.replace(/(-(auto|manual))(-\d+)?\.sql\.gz$/, `$1-${i}.sql.gz`);
  const final = path.join(DIR, name);
  const tmp = `${final}.partial`;
  const gz = zlib.createGzip({ level: 6 });
  const out = fs.createWriteStream(tmp, { mode: 0o600 });
  gz.pipe(out);
  const done = new Promise((resolve, reject) => { out.on("finish", resolve); out.on("error", reject); gz.on("error", reject); });
  const write = async (s) => { if (!gz.write(s)) await once(gz, "drain"); };

  let tables = 0, rows = 0;
  try {
    const dbName = sequelize.getDatabaseName ? sequelize.getDatabaseName() : sequelize.config.database;
    await write([
      "-- Finvera database backup",
      `-- Database: ${dbName}`,
      `-- Created: ${new Date(started).toISOString()}`,
      "-- Restore: phpMyAdmin → select the database → Import → choose this .sql.gz file.",
      "",
      "SET NAMES utf8mb4;",
      "SET time_zone = '+00:00';",
      "SET FOREIGN_KEY_CHECKS = 0;",
      "SET UNIQUE_CHECKS = 0;",
      "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
      "", "",
    ].join("\n"));

    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (t) => {
      const q = (sql, replacements) => sequelize.query(sql, { type: QueryTypes.SELECT, transaction: t, replacements, raw: true });
      const list = await q("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
      const names = list.map((r) => r[Object.keys(r).find((k) => k !== "Table_type")]).sort();
      for (const table of names) {
        const [ct] = await q(`SHOW CREATE TABLE ${qid(table)}`);
        const create = ct["Create Table"];
        await write(`--\n-- Table ${qid(table)}\n--\nDROP TABLE IF EXISTS ${qid(table)};\n${create};\n\n`);
        tables++;

        const keys = await q(`SHOW KEYS FROM ${qid(table)} WHERE Key_name = 'PRIMARY'`);
        const cols = await q(`SHOW COLUMNS FROM ${qid(table)}`);
        const colNames = cols.map((c) => c.Field);
        const pk = keys.length === 1 ? keys[0].Column_name : null;
        const pkCol = pk && cols.find((c) => c.Field === pk);
        const keyset = !!(pkCol && /int/i.test(pkCol.Type));
        const orderBy = keys.length ? ` ORDER BY ${keys.sort((a, b) => a.Seq_in_index - b.Seq_in_index).map((k) => qid(k.Column_name)).join(", ")}` : "";
        const head = `INSERT INTO ${qid(table)} (${colNames.map(qid).join(", ")}) VALUES\n`;
        const sel = colNames.map(qid).join(", ");
        // MySQL's native JSON type comes back parsed (even "abc" → abc): always re-serialise.
        const isJson = colNames.map((c, i) => /^json/i.test(cols[i].Type));
        const lit = (v, i) => (isJson[i] && v != null ? (Buffer.isBuffer(v) ? sqlValue(v.toString("utf8")) : sqlString(typeof v === "string" && !looksJson(v) ? JSON.stringify(v) : (typeof v === "string" ? v : JSON.stringify(v)))) : sqlValue(v));

        let last = null, offset = 0;
        for (;;) {
          const page = keyset
            ? await q(`SELECT ${sel} FROM ${qid(table)}${last === null ? "" : ` WHERE ${qid(pk)} > ?`} ORDER BY ${qid(pk)} LIMIT ${PAGE}`, last === null ? undefined : [last])
            : await q(`SELECT ${sel} FROM ${qid(table)}${orderBy} LIMIT ${PAGE} OFFSET ${offset}`);
          if (!page.length) break;
          let stmt = "", inStmt = 0;
          for (const r of page) {
            const tuple = "(" + colNames.map((c, i) => lit(r[c], i)).join(",") + ")";
            if (inStmt && stmt.length + tuple.length > MAX_STMT) { await write(stmt + ";\n"); stmt = ""; inStmt = 0; }
            stmt += (inStmt ? ",\n" : head) + tuple;
            inStmt++;
          }
          if (inStmt) await write(stmt + ";\n");
          rows += page.length;
          if (keyset) last = page[page.length - 1][pk]; else offset += page.length;
          if (page.length < PAGE) break;
          await new Promise((r) => setImmediate(r)); // let requests in between pages
        }
        await write("\n");
      }
    });

    await write(`SET FOREIGN_KEY_CHECKS = 1;\nSET UNIQUE_CHECKS = 1;\n-- Dump completed: tables=${tables} rows=${rows}\n`);
    gz.end();
    await done;
    await fsp.rename(tmp, final);
    const size = (await fsp.stat(final)).size;
    const info = { name, size, createdAt: new Date(started).toISOString(), tables, rows, kind, durationMs: Date.now() - started };
    await fsp.writeFile(final.replace(/\.sql\.gz$/, ".json"), JSON.stringify(info), { mode: 0o600 });
    await prune();
    await setResult({ ok: true, ...info });
    console.log(`\x1b[36mℹ Backup ${name}: ${tables} tables, ${rows} rows, ${(size / 1024).toFixed(1)} KB in ${info.durationMs} ms\x1b[0m`);
    return info;
  } catch (e) {
    try { gz.destroy(); out.destroy(); } catch { /* ignore */ }
    await fsp.unlink(tmp).catch(() => {});
    await setResult({ ok: false, error: e.message, at: new Date().toISOString(), kind });
    console.warn("\x1b[33m⚠ backup failed:\x1b[0m", e.message);
    throw e;
  }
}

/* ── List / prune / delete ── */
async function listBackups() {
  let files = [];
  try { files = await fsp.readdir(DIR); } catch { return []; }
  const out = [];
  for (const f of files.filter(isValidName)) {
    const full = path.join(DIR, f);
    try {
      const st = await fsp.stat(full);
      let meta = {};
      try { meta = JSON.parse(await fsp.readFile(full.replace(/\.sql\.gz$/, ".json"), "utf8")); } catch { /* no sidecar */ }
      out.push({
        name: f, size: st.size, createdAt: meta.createdAt || st.mtime.toISOString(),
        tables: meta.tables ?? null, rows: meta.rows ?? null, kind: meta.kind || (f.includes("-auto") ? "auto" : "manual"), durationMs: meta.durationMs ?? null,
      });
    } catch { /* vanished */ }
  }
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.name.localeCompare(a.name)));
}

async function removeBackup(name) {
  const full = fileFor(name);
  if (!full) return false;
  try { await fsp.unlink(full); } catch (e) { if (e.code === "ENOENT") return false; throw e; }
  await fsp.unlink(full.replace(/\.sql\.gz$/, ".json")).catch(() => {});
  return true;
}

async function prune() {
  const all = await listBackups();
  for (const b of all.slice(KEEP)) await removeBackup(b.name).catch(() => {});
  // Leftovers of a backup that died mid-way (older than a day).
  try {
    for (const f of await fsp.readdir(DIR)) {
      if (!f.endsWith(".partial")) continue;
      const st = await fsp.stat(path.join(DIR, f));
      if (Date.now() - st.mtimeMs > 86400000) await fsp.unlink(path.join(DIR, f)).catch(() => {});
    }
  } catch { /* ignore */ }
}

/* ── Verify: gunzip the whole file and count statements ── */
async function verifyBackup(name) {
  const full = fileFor(name);
  if (!full || !fs.existsSync(full)) return null;
  const started = Date.now();
  let meta = {};
  try { meta = JSON.parse(await fsp.readFile(full.replace(/\.sql\.gz$/, ".json"), "utf8")); } catch { /* none */ }
  const counts = { statements: 0, createTables: 0, dropTables: 0, inserts: 0, rows: 0, sets: 0 };
  let complete = false, bytes = 0, footer = null;
  const gunzip = zlib.createGunzip();
  const src = fs.createReadStream(full);
  src.pipe(gunzip);
  gunzip.on("data", (c) => { bytes += c.length; });
  try {
    const rl = readline.createInterface({ input: gunzip, crlfDelay: Infinity });
    let inInsert = false;
    const failed = new Promise((_, reject) => { gunzip.on("error", reject); src.on("error", reject); });
    failed.catch(() => {});
    const reading = (async () => {
      for await (const line of rl) {
        if (line.startsWith("-- Dump completed")) { complete = true; footer = line; continue; }
        if (line.startsWith("--") || !line.trim()) continue;
        if (line.startsWith("CREATE TABLE")) counts.createTables++;
        else if (line.startsWith("DROP TABLE")) counts.dropTables++;
        else if (line.startsWith("SET ")) counts.sets++;
        else if (line.startsWith("INSERT INTO")) { counts.inserts++; inInsert = true; }
        else if (inInsert && line.startsWith("(")) counts.rows++;
        if (line.endsWith(";")) { counts.statements++; inInsert = false; }
      }
    })();
    await Promise.race([reading, failed]);
  } catch (e) {
    return { ok: false, name, error: `The file is damaged: ${e.message}`, ...counts, complete: false, bytesUncompressed: bytes, durationMs: Date.now() - started };
  }
  const expected = meta.tables != null ? { tables: meta.tables, rows: meta.rows } : null;
  const matches = expected ? expected.tables === counts.createTables && expected.rows === counts.rows : null;
  return {
    ok: complete && counts.createTables > 0 && matches !== false,
    name, complete, ...counts, tables: counts.createTables, expected, matches, footer,
    bytesUncompressed: bytes, durationMs: Date.now() - started,
  };
}

/* ── Daily run (once per IST day, atomic across processes) ── */
let checkedFor = null;
async function maybeRunDailyBackup() {
  const { date, minutes } = istDay();
  if (dailyState(date, minutes, RUN_AT_MIN, checkedFor) !== "eligible") return { ran: false };
  try {
    const claimed = await claimDate(CLAIM_KEY, date);
    checkedFor = date;
    if (!claimed) return { ran: false };
    const info = await createBackup({ kind: "auto" });
    return { ran: true, info };
  } catch (e) {
    // Tell the admins (once a day at most) — a silent backup failure is the worst kind.
    const { alertTeam, layout, esc, dashboardUrl } = require("./emails");
    alertTeam({
      key: "backup-failed", windowMs: 20 * 3600000, kind: "system",
      payload: { type: "due", title: "Daily database backup failed", body: String(e.message).slice(0, 200), link: "/dashboard/system" },
      mail: { subject: "Finvera: daily database backup failed", html: layout({ title: "Daily database backup failed", body: `<p>Today's automatic backup could not be made:</p><p><code>${esc(String(e.message).slice(0, 300))}</code></p><p>Open the System page and try “Back up now”.</p>`, button: { label: "Open System", url: dashboardUrl("/dashboard/system") } }) },
    }).catch(() => {});
    return { ran: false, error: e.message };
  }
}

module.exports = { DIR, KEEP, isValidName, fileFor, createBackup, listBackups, removeBackup, verifyBackup, prune, maybeRunDailyBackup, getResult, isRunning: () => !!running, sqlValue };
