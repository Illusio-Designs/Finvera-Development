"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/icons";
import { api, apiErr, setToken, type LoginResult } from "@/lib/adminApi";
import { Icon, Note, PasswordInput } from "@/components/admin/account/kit";
import { ArrowLeft01Icon, SecurityLockIcon, SquareLock02Icon, Mail01Icon } from "@hugeicons/core-free-icons";

type Step = "password" | "code" | "forgot";

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ticket, setTicket] = useState("");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState<{ minutes: number; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<null | { mustChange: boolean; note?: string }>(null);
  const [info, setInfo] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  /* /login?email=… (after setting a password) and ?reset=1 / ?expired=1 hints. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const e = q.get("email");
    if (e) setEmail(e);
    if (q.get("set") === "1") setInfo("Your password is set. Sign in with it below.");
  }, []);
  useEffect(() => { if (step === "code") setTimeout(() => codeRef.current?.focus(), 30); }, [step, backup]);

  function fail(err: unknown) {
    const e = apiErr(err);
    if (e.status === 423) {
      setLocked({ minutes: Number(e.data?.minutesLeft) || 15, message: e.message });
      setError("");
    } else {
      setLocked(null);
      setError(e.message || "Sign-in failed.");
    }
    setLoading(false);
  }

  function done(r: Extract<LoginResult, { token: string }>) {
    setToken(r.token);
    const mustChange = !!(r.mustChangePassword || r.user?.mustChangePassword);
    const note = r.usedBackupCode ? `Backup code used. ${r.backupCodesLeft ?? 0} left — make new ones in My account.` : undefined;
    setSuccess({ mustChange, note });
    setTimeout(() => router.replace(mustChange ? "/dashboard/account?tab=password&required=1" : "/dashboard"), note ? 1800 : 950);
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLocked(null); setInfo(""); setLoading(true);
    try {
      const r = await api.login(email, password);
      if (r.twoFactorRequired) {
        setTicket(r.ticket); setCode(""); setBackup(false); setStep("code"); setLoading(false);
        return;
      }
      done(r);
    } catch (err) { fail(err); }
  }

  async function onCode(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLocked(null); setLoading(true);
    try {
      const r = await api.login2fa(ticket, code.trim());
      if (r.twoFactorRequired) throw new Error("Please try again.");
      done(r);
    } catch (err) {
      const ex = apiErr(err);
      // Ticket ran out (5 minutes) — back to the password step.
      if (ex.status === 401 && /expired/i.test(ex.message)) { setStep("password"); setPassword(""); }
      fail(err);
    }
  }



  const back = () => { setStep("password"); setError(""); setLocked(null); setCode(""); };

  if (success) {
    return (
      <div className="adm-login">
        <div className="login-success">
          <div className="success-check">
            <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
          </div>
          <h1>Welcome back!</h1>
          <p className="sub">{success.mustChange ? "First, please choose a new password…" : "Taking you to your dashboard…"}</p>
          {success.note && <p className="sub" style={{ marginTop: 6 }}>{success.note}</p>}
        </div>
      </div>
    );
  }

  const lockBox = locked && (
    <div className="acc-lock" role="alert">
      <Icon i={SquareLock02Icon} size={22} />
      <div>
        <b>Account locked for {locked.minutes} minute{locked.minutes === 1 ? "" : "s"}</b>
        <span>Too many wrong attempts. Try again after {locked.minutes} minute{locked.minutes === 1 ? "" : "s"}, or ask an admin to unlock it.</span>
      </div>
    </div>
  );

  return (
    <div className="adm-login">
      {step === "password" && (
        <form onSubmit={onPassword} noValidate={false}>
          <div className="brand" style={{ fontSize: 20 }}><Mark /> Finvera</div>
          <h1>Sign in</h1>
          <p className="sub">Finvera team dashboard</p>
          {info && <Note kind="ok">{info}</Note>}
          {lockBox}
          {error && <Note kind="err">{error}</Note>}
          <div className="adm-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="name@finvera.solutions" autoComplete="username" />
          </div>
          <div className="adm-field">
            <div className="acc-lblrow">
              <label htmlFor="password">Password</label>
              <button type="button" className="acc-link" onClick={() => { setStep("forgot"); setError(""); setLocked(null); }}>Forgot password?</button>
            </div>
            <PasswordInput id="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password" />
          </div>
          <button className="adm-btn primary acc-wide" type="submit" disabled={loading || !email || !password}>
            {loading ? <><span className="spin" /> Signing in…</> : "Sign in"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={onCode}>
          <div className="acc-stepic"><Icon i={SecurityLockIcon} size={26} /></div>
          <h1>{backup ? "Enter a backup code" : "Enter the 6-digit code"}</h1>
          <p className="sub">{backup
            ? "Use one of the backup codes you saved when you turned on two-step login. Each code works once."
            : "Open your authenticator app (Google Authenticator, Microsoft Authenticator…) and type the code for Finvera."}</p>
          {lockBox}
          {error && <Note kind="err">{error}</Note>}
          <div className="adm-field">
            <label htmlFor="code">{backup ? "Backup code" : "Code"}</label>
            {backup ? (
              <input id="code" ref={codeRef} className="acc-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ab12-cd34"
                autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={12} required />
            ) : (
              <input id="code" ref={codeRef} className="acc-code otp" value={code} required
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="······" />
            )}
          </div>
          <button className="adm-btn primary acc-wide" type="submit" disabled={loading || (!backup && code.length !== 6) || (backup && code.trim().length < 8)}>
            {loading ? <><span className="spin" /> Checking…</> : "Verify and sign in"}
          </button>
          <div className="acc-formfoot">
            <button type="button" className="acc-link" onClick={() => { setBackup((b) => !b); setCode(""); setError(""); }}>
              {backup ? "Use the 6-digit code instead" : "Use a backup code instead"}
            </button>
            <button type="button" className="acc-link muted" onClick={back}><Icon i={ArrowLeft01Icon} size={14} />Back</button>
          </div>
        </form>
      )}

      {step === "forgot" && (
        <div>
          <div className="acc-stepic"><Icon i={Mail01Icon} size={26} /></div>
          <h1>Reset your password</h1>
          <p className="sub">Ask an admin for a reset link. They make it on the Users page and send it to you (for example on WhatsApp). Open it, choose a new password, then sign in.</p>
          <button type="button" className="adm-btn ghost acc-wide" onClick={back}><Icon i={ArrowLeft01Icon} size={14} />Back to sign in</button>
        </div>
      )}
    </div>
  );
}
