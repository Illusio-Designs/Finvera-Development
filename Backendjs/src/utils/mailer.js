const { lazyState } = require("./asyncMachine");
/* Email sending over SMTP (works with a cPanel mailbox, Brevo, Resend, Gmail…).

   Settings (all optional — without SMTP_HOST nothing is sent and every call
   just returns { sent: false, reason: "not-configured" }):
     SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS; default 465),
     SMTP_USER, SMTP_PASS, MAIL_FROM ("Finvera <noreply@finvera.solutions>")

   nodemailer is loaded lazily: if the server hasn't installed it yet
   (cPanel → "Run NPM Install"), the API still runs and mail is skipped.
   sendMail never throws, so a mail problem can't break the action behind it. */

let transport = null, loadError = null;

/* cPanel's environment screen keeps quote marks as part of a value
   (MAIL_FROM="Finvera <x@y>" arrives with the quotes) — drop them. */
const env = (k) => String(process.env[k] || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
function configured() { return !!env("SMTP_HOST"); }

function getTransport() {
  if (lazyState(transport || undefined, loadError) !== "uninitialized") return transport;
  try {
    const nodemailer = require("nodemailer");
    const port = Number(env("SMTP_PORT") || 465);
    transport = nodemailer.createTransport({
      host: env("SMTP_HOST"), port, secure: port === 465,
      auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
      connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
      // Shared hosting often serves the mail server's own hostname certificate;
      // SMTP_TLS_INSECURE=true accepts it (only set this for your own host).
      tls: /^(1|true|yes)$/i.test(env("SMTP_TLS_INSECURE")) ? { rejectUnauthorized: false } : undefined,
    });
  } catch (e) { loadError = e; console.warn("mailer: nodemailer not available —", e.message); }
  return transport;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* Simple branded wrapper: title, paragraphs (HTML allowed), optional button. */
function layout({ title, body = "", button = null, footer = "Finvera Solutions LLP" }) {
  const btn = button ? `<p style="margin:24px 0"><a href="${esc(button.url)}" style="background:#3e60ab;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(button.label)}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:Poppins,Segoe UI,Arial,sans-serif;color:#111a30">
<div style="max-width:560px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #e3e8f2;border-radius:16px;padding:28px">
<div style="font-weight:700;font-size:18px;color:#3e60ab;margin-bottom:18px">Finvera</div>
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1><div style="font-size:14.5px;line-height:1.6;color:#334">${body}</div>${btn}
</div><p style="font-size:12px;color:#8a93aa;text-align:center;margin-top:14px">${esc(footer)}</p></div></body></html>`;
}

/* Plain-English reason + fix for the usual SMTP errors. */
function explain(e) {
  const m = `${e.code || ""} ${e.responseCode || ""} ${e.message || ""}`;
  if (/EAUTH|535|534|Invalid login|authentication/i.test(m)) return "the mail server rejected the login — check SMTP_USER is the full email address and SMTP_PASS is that mailbox's password.";
  if (/certificate|self[- ]signed|altnames|hostname\/IP|UNABLE_TO_VERIFY|CERT_/i.test(m)) return "the mail server's security certificate doesn't match SMTP_HOST — use the 'Outgoing Server' name from cPanel → Email Accounts → Connect Devices, or add SMTP_TLS_INSECURE=true.";
  if (/wrong version number|SSL routines|EPROTO/i.test(m)) return "port and encryption don't match — use SMTP_PORT=465 (SSL) or 587 (STARTTLS).";
  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|ESOCKET|EDNS|ENOTFOUND|timeout/i.test(m)) return `couldn't reach ${env("SMTP_HOST")}:${env("SMTP_PORT") || 465} — check the host name, or try SMTP_PORT=587.`;
  if (/sender|not owned|550|553/i.test(m)) return "the server refused the sender — MAIL_FROM must use the same address as SMTP_USER (no quote marks).";
  return e.message || "unknown mail error";
}

async function sendMail({ to, subject, html, text, replyTo }) {
  if (!to || !configured()) return { sent: false, reason: "not-configured" };
  const t = getTransport();
  if (!t) return { sent: false, reason: "nodemailer-missing" };
  try {
    const info = await t.sendMail({ from: env("MAIL_FROM") || env("SMTP_USER"), to, subject, html, text, replyTo });
    return { sent: true, id: info.messageId };
  } catch (e) {
    console.warn("mailer:", e.message);
    return { sent: false, reason: `${explain(e)} (${String(e.message || "").slice(0, 160)})` };
  }
}

/* Log in to the mail server without sending anything (nodemailer verify:
   connect → TLS → login). Never throws. → { ok, ms, reason?, raw? } */
async function verify() {
  if (!configured()) return { ok: false, reason: "not-configured" };
  const t = getTransport();
  if (!t) return { ok: false, reason: "nodemailer-missing" };
  const t0 = Date.now();
  try { await t.verify(); return { ok: true, ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, ms: Date.now() - t0, reason: explain(e), raw: String(e.message || "").slice(0, 160) }; }
}

/* What the server is actually using — for the admin's test email when the
   login fails. Never includes the password itself: only its length, whether
   it has spaces at the ends, and where the value came from. */
function diag() {
  const raw = String(process.env.SMTP_PASS || "");
  let fileHas = false, fileSame = false, cutAtHash = false;
  try {
    const text = require("fs").readFileSync(require("path").join(__dirname, "..", "..", ".env"), "utf8");
    const parsed = require("dotenv").parse(text);
    fileHas = "SMTP_PASS" in parsed;
    fileSame = fileHas && parsed.SMTP_PASS === raw;
    // An unquoted value stops at "#" (dotenv reads the rest as a comment), so
    // SMTP_PASS=ab#cd is loaded as "ab". Quoting it fixes that: SMTP_PASS="ab#cd".
    const line = text.split(/\r?\n/).find((l) => /^\s*(export\s+)?SMTP_PASS\s*=/.test(l));
    const val = line ? line.slice(line.indexOf("=") + 1).trim() : "";
    cutAtHash = !!val && !/^["'`]/.test(val) && val.includes("#");
  } catch { /* no .env file */ }
  return {
    user: env("SMTP_USER"), host: env("SMTP_HOST"), port: Number(env("SMTP_PORT") || 465),
    passLength: env("SMTP_PASS").length,
    passHasEdgeSpaces: raw !== raw.trim(),
    passHadQuotes: /^(["']).*\1$/.test(raw.trim()),
    passFrom: !raw ? "not set" : fileSame ? ".env file in the app folder" : "cPanel environment variables",
    envFileHasPass: fileHas,
    passCutAtHash: cutAtHash,
  };
}

module.exports = { sendMail, layout, esc, configured, diag, verify };
