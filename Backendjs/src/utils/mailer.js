/* Email sending over SMTP (works with a cPanel mailbox, Brevo, Resend, Gmail…).

   Settings (all optional — without SMTP_HOST nothing is sent and every call
   just returns { sent: false, reason: "not-configured" }):
     SMTP_HOST, SMTP_PORT (465 = SSL, 587 = STARTTLS; default 465),
     SMTP_USER, SMTP_PASS, MAIL_FROM ("Finvera <noreply@finvera.solutions>")

   nodemailer is loaded lazily: if the server hasn't installed it yet
   (cPanel → "Run NPM Install"), the API still runs and mail is skipped.
   sendMail never throws, so a mail problem can't break the action behind it. */

let transport = null, loadError = null;

function configured() { return !!process.env.SMTP_HOST; }

function getTransport() {
  if (transport || loadError) return transport;
  try {
    const nodemailer = require("nodemailer");
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
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

async function sendMail({ to, subject, html, text, replyTo }) {
  if (!to || !configured()) return { sent: false, reason: "not-configured" };
  const t = getTransport();
  if (!t) return { sent: false, reason: "nodemailer-missing" };
  try {
    const info = await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html, text, replyTo });
    return { sent: true, id: info.messageId };
  } catch (e) {
    console.warn("mailer:", e.message);
    return { sent: false, reason: e.message };
  }
}

module.exports = { sendMail, layout, esc, configured };
