"use client";
/* Email setup card (System page, admin): is SMTP set up, what to add in
   cPanel if not, a "Test connection" button (logs in, sends nothing) and a "Send a test email" box that shows the SMTP error. */
import { useCallback, useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, CheckmarkCircle02Icon, Alert02Icon, SentIcon, InformationCircleIcon, Link01Icon } from "@hugeicons/core-free-icons";
import { opsApi } from "@/lib/adminApi";

const Ic = ({ i, size = 16 }: { i: any; size?: number }) => <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} />;

const ENV_LINES = `SMTP_HOST=mail.finvera.solutions
SMTP_PORT=465
SMTP_USER=no-reply@finvera.solutions
SMTP_PASS=the-mailbox-password
MAIL_FROM="Finvera <no-reply@finvera.solutions>"`;

type Status = { configured: boolean; from: string | null; host: string | null; port: number | null; user: string | null };

export default function EmailSetup({ myEmail, refreshKey }: { myEmail?: string; refreshKey?: number }) {
  const [st, setSt] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [to, setTo] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try { setSt(await opsApi.emailStatus()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the email status"); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { if (myEmail) setTo((t) => t || myEmail); }, [myEmail]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true); setResult(null);
    try {
      const r = await opsApi.testEmail(to.trim() || undefined);
      setResult({ ok: true, text: r.message || "Test email sent." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Couldn't send." });
    } finally { setSending(false); }
  }
  async function check() {
    setChecking(true); setResult(null);
    try {
      const r = await opsApi.testEmailConnection();
      setResult({ ok: true, text: r.message || "Connected." });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Couldn't connect." });
    } finally { setChecking(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(ENV_LINES); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  }

  return (
    <section className="sys-card" id="email" aria-labelledby="sys-email-h">
      <div className="sys-card-h">
        <span className="sys-ic"><Ic i={Mail01Icon} size={20} /></span>
        <div>
          <h2 id="sys-email-h">Email setup</h2>
          <p>Used for new enquiries, reminders, failed posts, security alerts and backup problems.</p>
        </div>
        {st && <span className={"sys-pill " + (st.configured ? "ok" : "off")}>{st.configured ? "Set up" : "Not set up"}</span>}
      </div>

      {error && <div className="sys-note bad" role="alert"><Ic i={Alert02Icon} /><span>{error}</span></div>}
      {!st && !error && <div className="sys-empty">Loading…</div>}

      {st && st.configured && (
        <dl className="sys-kv">
          <dt>Sends from</dt><dd>{st.from || "—"}</dd>
          <dt>Mail server</dt><dd>{st.host}{st.port ? `:${st.port}` : ""}</dd>
          <dt>Login</dt><dd>{st.user || "—"}</dd>
        </dl>
      )}

      {st && !st.configured && (
        <>
          <div className="sys-note warn"><Ic i={InformationCircleIcon} />
            <span><b>Emails aren’t set up yet.</b> Everyone still gets alerts inside the app. To turn on email, open <b>cPanel → Setup Node.js App</b> (or the app’s <code>.env</code> file) and add these lines with your own mailbox details:</span>
          </div>
          <div className="sys-env" aria-label="Lines to add to the server settings">
            <button type="button" className="sys-env-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            {ENV_LINES}
          </div>
          <p className="sys-hc-s" style={{ marginBottom: 16 }}>Port <code>465</code> is the secure (SSL) port most cPanel hosts use. Then click <b>Run NPM Install</b> and <b>restart</b> the app, and send a test email below.</p>
        </>
      )}

      {st && (
        <form className="sys-test" onSubmit={send}>
          <label>Send a test email to
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </label>
          <button type="submit" className="sys-btn primary" disabled={sending}>
            {sending ? <><span className="sys-spin" aria-hidden="true" />Sending…</> : <><Ic i={SentIcon} />Send a test email</>}
          </button>
          {st.configured && (
            <button type="button" className="sys-btn" onClick={check} disabled={checking || sending}>
              {checking ? <><span className="sys-spin" aria-hidden="true" />Checking…</> : <><Ic i={Link01Icon} />Test connection</>}
            </button>
          )}
        </form>
      )}
      {result && (
        <div className={"sys-note sys-res " + (result.ok ? "ok" : "bad")} role="status">
          <Ic i={result.ok ? CheckmarkCircle02Icon : Alert02Icon} /><span>{result.text}</span>
        </div>
      )}
    </section>
  );
}
