/* Meta (Facebook Page + Instagram) connection health.

   Once a day (and on demand: POST /api/social-accounts/check) every connected
   brand's stored Page token is checked with one cheap Graph call:
     • with META_APP_ID/SECRET: GET /debug_token (is_valid, expires_at,
       data_access_expires_at, the Meta error if any)
     • otherwise: GET /me?fields=id with the Page token
   A token Meta says is invalid → the account goes to status "reconnect" with a
   clear lastError, and admins + the social team get an in-app alert + email
   (once per account per 6 h). A network hiccup never marks anything. A known
   expiry less than 7 days away → one warning. */

const { Op } = require("sequelize");
const { SocialAccount, Setting } = require("../models");
const meta = require("./meta");

const WARN_DAYS = 7;
const RUN_AT_MIN = 9 * 60;           // 09:00 IST
const CLAIM_KEY = "metaHealth.lastRun";
const SOCIAL_ROLES = ["social"];     // + admins (always)

const TOKEN_CODES = [190, 102, 10, 200, 463, 467];
const isTokenError = (e) => !!(e && e.meta && (TOKEN_CODES.includes(Number(e.meta.code)) || /OAuthException/i.test(e.meta.type || "")));

/* Tell the team that a brand must be reconnected (throttled per account). */
async function alertReconnect(acc, reason) {
  const { alertTeam, layout, esc, dashboardUrl } = require("./emails");
  return alertTeam({
    key: `reconnect:${acc.client}`, windowMs: 6 * 3600000, roles: SOCIAL_ROLES, kind: "publishing",
    payload: { type: "due", title: `Reconnect ${acc.client} to Facebook / Instagram`, body: String(reason).slice(0, 240), link: "/dashboard/social" },
    mail: {
      subject: `Finvera: reconnect ${acc.client}'s Facebook / Instagram`,
      html: layout({
        title: `${acc.client} needs to be reconnected`,
        body: `<p>Automatic posting for <b>${esc(acc.client)}</b>${acc.pageName ? ` (Page “${esc(acc.pageName)}”)` : ""} is stopped: Meta no longer accepts the saved connection.</p>
<p><code>${esc(String(reason).slice(0, 300))}</code></p><p>An admin can fix it in Social studio → Channels → Connect.</p>`,
        button: { label: "Open Social studio", url: dashboardUrl("/dashboard/social") },
      }),
    },
  });
}

/* Check one account. Returns { client, status, ok, expiresAt, warn, error }. */
async function checkAccount(acc) {
  const out = { client: acc.client, pageName: acc.pageName, before: acc.status, status: acc.status, ok: null, expiresAt: null, warning: null, error: null };
  let token;
  try { token = meta.decrypt(acc.pageToken); } catch { token = null; }
  const markReconnect = async (msg) => {
    await acc.update({ status: "reconnect", lastError: msg, lastCheckedAt: new Date() });
    out.status = "reconnect"; out.ok = false; out.error = msg;
    if (out.before === "connected") await alertReconnect(acc, msg);
  };
  if (!token) {
    await markReconnect("The saved Facebook connection can't be read (the server's encryption key changed). Connect the brand again.");
    return out;
  }
  try {
    let expiresAt = null;
    // debug_token is signed with the app's own credentials: if IT fails (wrong
    // app secret, app problem) that says nothing about the brand's token, so
    // fall back to a plain call with the Page token.
    const d = meta.configured()
      ? await meta.graph("GET", "/debug_token", { input_token: token, access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` }).then((r) => r.data || {}, () => null)
      : null;
    if (d) {
      if (!d.is_valid) {
        const why = d.error?.message ? `Meta says: ${d.error.message}` : "Meta says the saved connection is no longer valid.";
        await markReconnect(`${why} Reconnect the brand in Social studio.`);
        return out;
      }
      const times = [Number(d.expires_at) || 0, Number(d.data_access_expires_at) || 0].filter((t) => t > 0);
      if (times.length) expiresAt = new Date(Math.min(...times) * 1000);
    } else {
      await meta.graph("GET", "/me", { fields: "id", access_token: token });
    }
    out.ok = true; out.expiresAt = expiresAt ? expiresAt.toISOString() : null;
    await acc.update({ tokenExpiresAt: expiresAt, lastCheckedAt: new Date() });
    if (expiresAt && expiresAt.getTime() - Date.now() < WARN_DAYS * 86400000) {
      const days = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000));
      out.warning = `Connection expires in ${days} day${days === 1 ? "" : "s"}`;
      const { alertTeam, layout, esc, dashboardUrl } = require("./emails");
      // Once per account per expiry date.
      await alertTeam({
        key: `metaexp:${acc.client}:${expiresAt.toISOString().slice(0, 10)}`, windowMs: 60 * 86400000, roles: [], kind: "publishing",
        payload: { type: "due", title: `${acc.client}: Facebook connection expires in ${days} day${days === 1 ? "" : "s"}`, body: "Reconnect it in Social studio before then so auto-posting keeps working.", link: "/dashboard/social" },
        mail: {
          subject: `Finvera: ${acc.client}'s Facebook connection expires in ${days} day${days === 1 ? "" : "s"}`,
          html: layout({ title: `${acc.client}: connection expires soon`, body: `<p>Meta will stop accepting the saved connection for <b>${esc(acc.client)}</b> on <b>${esc(expiresAt.toUTCString())}</b>.</p><p>Reconnect it in Social studio → Channels before then so scheduled posts keep going out.</p>`, button: { label: "Open Social studio", url: dashboardUrl("/dashboard/social") } }),
        },
      });
    }
  } catch (e) {
    if (isTokenError(e)) { await markReconnect(`Meta rejected the saved connection: ${e.message} Reconnect the brand in Social studio.`); return out; }
    out.ok = null; out.error = `Couldn't reach Meta: ${e.message}`; // temporary — leave the status alone
    await acc.update({ lastCheckedAt: new Date() }).catch(() => {});
  }
  return out;
}

let running = null;
function checkAll() {
  if (running) return running;
  running = (async () => {
    const accs = await SocialAccount.findAll({ where: { status: "connected" }, order: [["client", "ASC"]] });
    const results = [];
    for (const a of accs) {
      try { results.push(await checkAccount(a)); } catch (e) { results.push({ client: a.client, ok: null, error: e.message }); }
    }
    return { checked: results.length, at: new Date().toISOString(), results };
  })().finally(() => { running = null; });
  return running;
}

let checkedFor = null;
async function maybeRunDailyCheck() {
  const d = new Date(Date.now() + 330 * 60000);
  const date = d.toISOString().slice(0, 10), minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (minutes < RUN_AT_MIN || checkedFor === date) return { ran: false };
  try {
    await Setting.findOrCreate({ where: { key: CLAIM_KEY }, defaults: { key: CLAIM_KEY, value: "", group: "system", isPublic: false } });
    const [claimed] = await Setting.update({ value: date }, { where: { key: CLAIM_KEY, [Op.or]: [{ value: null }, { value: { [Op.ne]: date } }] } });
    checkedFor = date;
    if (!claimed) return { ran: false };
    const r = await checkAll();
    console.log(`\x1b[36mℹ Meta connection check ${date}: ${r.checked} checked, ${r.results.filter((x) => x.ok === false).length} need reconnecting\x1b[0m`);
    return { ran: true, ...r };
  } catch (e) {
    console.warn("\x1b[33m⚠ meta health:\x1b[0m", e.message);
    return { ran: false, error: e.message };
  }
}

module.exports = { checkAll, checkAccount, maybeRunDailyCheck, alertReconnect, isTokenError };
