"use client";
/* Public page behind invite and reset links:
   /reset-password?token=…            → "Choose a new password"
   /reset-password?token=…&invite=1   → "Welcome, {name} — set your password"
   Outside (site), so no marketing header — same shell as /login. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Mark } from "@/components/icons";
import { api, apiErr } from "@/lib/adminApi";
import { FieldError, Icon, Note, PasswordInput, PasswordRules, passwordOk } from "@/components/admin/account/kit";
import { LinkSquare02Icon } from "@hugeicons/core-free-icons";

type Info = { kind: "reset" | "invite"; email: string; name: string; expiresAt: string };

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [bad, setBad] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string } | null>(null);
  const [inviteHint, setInviteHint] = useState(false);
  const [wait, setWait] = useState(""); // rate limited / network trouble — the link may still be fine

  const check = (t: string) => {
    setWait("");
    api.resetInfo(t)
      .then((r) => setInfo({ kind: r.kind, email: r.email, name: r.name, expiresAt: r.expiresAt }))
      .catch((e) => {
        const x = apiErr(e);
        if (x.status === 400 || x.status === 404) setBad(x.message || "This link isn't valid any more.");
        else setWait(x.status === 429 ? "Too many tries from this network. Wait a few minutes, then try again." : "We couldn't check this link right now. Check your connection and try again.");
      });
  };
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("token") || "";
    setInviteHint(q.get("invite") === "1");
    setToken(t);
    if (!t) { setBad("This link is missing its code. Open the link from your email or message again."); return; }
    check(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setFieldErr("");
    if (!passwordOk(pw)) { setFieldErr("Password must be at least 8 characters and include at least one letter and one number."); return; }
    if (pw !== pw2) { setFieldErr("The two passwords don't match."); return; }
    setBusy(true);
    try {
      const r = await api.resetPassword(token, pw);
      setDone({ email: r.email || info?.email || "" });
    } catch (ex) {
      const x = apiErr(ex);
      if (x.field === "password") setFieldErr(x.message);
      else if (x.status === 400 && /link|expired|used/i.test(x.message)) { setBad(x.message); setInfo(null); }
      else setErr(x.message);
    } finally { setBusy(false); }
  }

  const invite = info ? info.kind === "invite" : inviteHint;
  const first = (info?.name || "").split(/\s+/)[0];

  return (
    <div className="adm-login">
      <div className="acc-card">
        <div className="brand" style={{ fontSize: 20 }}><Mark /> Finvera</div>

        {done ? (
          <div className="login-success">
            <div className="success-check"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></div>
            <h1>{invite ? "You're all set" : "Password changed"}</h1>
            <p className="sub">{invite ? "Your password is set. Sign in to open the dashboard." : "Your new password is ready. Devices that were signed in with the old one have been signed out."}</p>
            <Link className="adm-btn primary acc-wide" href={`/login?set=1&email=${encodeURIComponent(done.email)}`}>Go to sign in</Link>
          </div>
        ) : bad ? (
          <div className="acc-center">
            <div className="acc-stepic warn"><Icon i={LinkSquare02Icon} size={26} /></div>
            <h1>This link doesn&apos;t work</h1>
            <p className="sub">{bad}</p>
            <p className="acc-hint" style={{ textAlign: "center", marginBottom: 18 }}>
              {inviteHint ? "Invite links expire after 3 days. Ask the admin who invited you to send a new one." : "Reset links work once and expire after a while. You can ask for a new one."}
            </p>
            <Link className="adm-btn primary acc-wide" href="/login">{inviteHint ? "Go to sign in" : "Request a new link"}</Link>
          </div>
        ) : wait ? (
          <div className="acc-center">
            <h1>Please try again</h1>
            <p className="sub">{wait}</p>
            <button type="button" className="adm-btn primary acc-wide" onClick={() => check(token)}>Try again</button>
          </div>
        ) : !info ? (
          <div className="acc-center" aria-busy="true">
            <span className="skel skel-line" style={{ display: "block", height: 26, width: "70%", margin: "18px auto 10px" }} />
            <span className="skel skel-line" style={{ display: "block", height: 14, width: "50%", margin: "0 auto 26px" }} />
            <span className="skel skel-line" style={{ display: "block", height: 44, marginBottom: 14 }} />
            <span className="skel skel-line" style={{ display: "block", height: 44 }} />
          </div>
        ) : (
          <form onSubmit={submit} className="acc-plain">
            <h1>{invite ? `Welcome${first ? `, ${first}` : ""} — set your password` : "Choose a new password"}</h1>
            <p className="sub">{invite ? <>You&apos;ll sign in as <b>{info.email}</b>.</> : <>For <b>{info.email}</b>.</>}</p>
            {err && <Note kind="err">{err}</Note>}
            <input type="email" value={info.email} autoComplete="username" readOnly hidden />
            <div className="adm-field">
              <label htmlFor="pw">{invite ? "Password" : "New password"}</label>
              <PasswordInput id="pw" value={pw} onChange={(v) => { setPw(v); setFieldErr(""); }} autoComplete="new-password" invalid={!!fieldErr} describedBy="pw-rules" autoFocus />
            </div>
            <div className="adm-field">
              <label htmlFor="pw2">Type it again</label>
              <PasswordInput id="pw2" value={pw2} onChange={(v) => { setPw2(v); setFieldErr(""); }} autoComplete="new-password" invalid={!!fieldErr && pw !== pw2} />
            </div>
            <div id="pw-rules"><PasswordRules value={pw} confirm={pw2} /></div>
            <FieldError msg={fieldErr} />
            <button className="adm-btn primary acc-wide" type="submit" disabled={busy || !passwordOk(pw) || pw !== pw2} style={{ marginTop: 14 }}>
              {busy ? <><span className="spin" /> Saving…</> : invite ? "Set password" : "Save new password"}
            </button>
            <div className="acc-formfoot center"><Link className="acc-link muted" href="/login">Back to sign in</Link></div>
          </form>
        )}
      </div>
    </div>
  );
}
