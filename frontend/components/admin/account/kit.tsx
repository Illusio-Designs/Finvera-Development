"use client";
/* Shared bits for the login, reset-password, My account and Users screens:
   password field + rule checklist, relative times, security-log sentences,
   device lists, share-a-link box, QR code and a small pager. */
import { useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ViewIcon, ViewOffIcon, Tick02Icon, Cancel01Icon, Copy01Icon, WhatsappIcon, SmartPhone01Icon, ComputerIcon,
  Logout03Icon, Mail01Icon, CheckmarkCircle02Icon, InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import type { SecEvent, Session } from "@/lib/adminApi";
import { toast } from "@/lib/toast";

export function Icon({ i, size = 16, className }: { i: any; size?: number; className?: string }) {
  return <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} className={className} />;
}

/* ── Time ── */
export function ago(iso?: string | null): string {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "—";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return fmtDate(iso);
}
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time}`;
};
/* "in 3 days" / "in 5 hours" for link expiry. */
export function expiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.round(ms / 3600000);
  if (h < 1) return `in ${Math.max(1, Math.round(ms / 60000))} minutes`;
  if (h < 48) return `in ${h} hour${h === 1 ? "" : "s"}`;
  return `in ${Math.round(h / 24)} days`;
}

/* ── Password rules (same as the backend: 8+ chars, a letter, a number) ── */
export function passwordChecks(pw: string) {
  return [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(pw), label: "At least one letter" },
    { ok: /\d/.test(pw), label: "At least one number" },
  ];
}
export const passwordOk = (pw: string) => passwordChecks(pw).every((c) => c.ok);

export function PasswordRules({ value, confirm }: { value: string; confirm?: string }) {
  const checks = passwordChecks(value);
  if (confirm !== undefined) checks.push({ ok: !!value && value === confirm, label: "Both passwords match" });
  return (
    <ul className="acc-rules" aria-label="Password rules">
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? "ok" : value ? "no" : ""}>
          <span aria-hidden><Icon i={c.ok ? Tick02Icon : Cancel01Icon} size={12} /></span>
          {c.label}<span className="acc-sr">{c.ok ? " (done)" : " (not yet)"}</span>
        </li>
      ))}
    </ul>
  );
}

export function PasswordInput({ id, value, onChange, placeholder, autoComplete = "new-password", invalid, autoFocus, describedBy }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; invalid?: boolean; autoFocus?: boolean; describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="adm-pass">
      <input id={id} type={show ? "text" : "password"} value={value} placeholder={placeholder} autoComplete={autoComplete}
        aria-invalid={invalid || undefined} aria-describedby={describedBy} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="adm-eye" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        <Icon i={show ? ViewOffIcon : ViewIcon} size={17} />
      </button>
    </div>
  );
}

export function FieldError({ id, msg }: { id?: string; msg?: string | null }) {
  if (!msg) return null;
  return <p className="acc-ferr" id={id} role="alert">{msg}</p>;
}

/* Inline note: "err" (red), "ok" (green), "info" (blue), "warn" (amber). */
export function Note({ kind = "info", children, title }: { kind?: "err" | "ok" | "info" | "warn"; title?: string; children?: React.ReactNode }) {
  return (
    <div className={"acc-note " + kind} role={kind === "err" ? "alert" : "status"}>
      <Icon i={kind === "ok" ? CheckmarkCircle02Icon : InformationCircleIcon} size={18} />
      <div>{title && <b>{title}</b>}{children && <span>{children}</span>}</div>
    </div>
  );
}

/* ── Clipboard (falls back to a hidden textarea on plain-http pages) ── */
export async function copyText(text: string, what = "Copied"): Promise<boolean> {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove();
    } catch { ok = false; }
  }
  toast(ok ? what : "Couldn't copy — select the text and copy it", ok ? "ok" : "err");
  return ok;
}
export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/* A link to hand to someone: copy, WhatsApp, and whether email went out. */
export function ShareLinkBox({ link, expiresAt, emailed, email, name, kind }: {
  link: string; expiresAt: string; emailed: boolean; email?: string; name?: string; kind: "invite" | "reset";
}) {
  const first = (name || "").split(/\s+/)[0] || "there";
  const msg = kind === "invite"
    ? `Hi ${first}, you're invited to the Finvera dashboard. Set your password here (link works once, expires ${expiresIn(expiresAt)}): ${link}`
    : `Hi ${first}, here's your Finvera password reset link (works once, expires ${expiresIn(expiresAt)}): ${link}`;
  return (
    <div className="acc-share">
      <div className={"acc-mailst " + (emailed ? "ok" : "no")}>
        <Icon i={Mail01Icon} size={16} />
        {emailed ? <span>Email sent{email ? <> to <b>{email}</b></> : ""}.</span> : <span>Email isn&apos;t set up, so nothing was emailed. Share the link yourself.</span>}
      </div>
      <label className="acc-lbl" htmlFor="acc-share-link">{kind === "invite" ? "Invite link" : "Reset link"}</label>
      <div className="acc-linkrow">
        <input id="acc-share-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <p className="acc-hint">Works once. Expires {expiresIn(expiresAt)} ({fmtWhen(expiresAt)}).</p>
      <div className="acc-share-btns">
        <button type="button" className="ss-chip" onClick={() => copyText(link, "Link copied")}><Icon i={Copy01Icon} size={15} />Copy link</button>
        <a className="ss-chip acc-wa" href={whatsappUrl(msg)} target="_blank" rel="noopener noreferrer"><Icon i={WhatsappIcon} size={15} />Share on WhatsApp</a>
      </div>
    </div>
  );
}

/* ── QR code as inline SVG (qrcode-generator, no canvas needed) ── */
export function QrCode({ text, size = 184, label }: { text: string; size?: number; label: string }) {
  const path = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4},${r + 4}h1v1h-1z`;
    return { d, n: n + 8 };
  }, [text]);
  return (
    <svg className="acc-qr" width={size} height={size} viewBox={`0 0 ${path.n} ${path.n}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={path.n} height={path.n} fill="#fff" />
      <path d={path.d} fill="#111a30" />
    </svg>
  );
}

/* ── Devices ── */
const isPhone = (s: Session) => /iphone|android|mobile|ipad/i.test(`${s.userAgent} ${s.device}`);
export function SessionList({ sessions, onSignOut, busy, emptyText = "No devices are signed in." }: {
  sessions: Session[]; onSignOut: (s: Session) => void; busy?: number | null; emptyText?: string;
}) {
  if (!sessions.length) return <div className="ss-empty">{emptyText}</div>;
  return (
    <ul className="acc-devs">
      {sessions.map((s) => (
        <li key={s.id} className={s.current ? "cur" : ""}>
          <span className="acc-devic"><Icon i={isPhone(s) ? SmartPhone01Icon : ComputerIcon} size={20} /></span>
          <div className="acc-devtx">
            <b>{s.device || "Unknown device"}{s.current && <span className="acc-pill blue">This device</span>}</b>
            <small>{s.current ? "Active now" : `Last active ${ago(s.lastSeenAt).toLowerCase()}`}{s.ip ? ` · IP ${s.ip}` : ""}</small>
            <small>Signed in {fmtWhen(s.createdAt)}</small>
          </div>
          <button type="button" className="ss-chip acc-devout" onClick={() => onSignOut(s)} disabled={busy === s.id}>
            <Icon i={Logout03Icon} size={15} />{busy === s.id ? "Signing out…" : "Sign out"}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ── Security log → readable sentences ── */
const FAIL_REASON: Record<string, string> = {
  unknown_email: "no account with that email",
  wrong_password: "wrong password",
  inactive: "account is deactivated",
  locked: "account was locked",
  invite_pending: "invite not accepted yet",
  wrong_2fa_code: "wrong code",
};
export const EVENT_LABEL: Record<string, string> = {
  login_success: "Signed in", login_failed: "Sign-in failed", lockout: "Account locked", unlocked: "Account unlocked",
  logout: "Signed out", logout_all: "Signed out of all devices", session_revoked: "Signed out a device",
  password_changed: "Password changed", password_reset: "Password reset with a link", password_set_by_admin: "Password set by an admin",
  reset_requested: "Reset link requested", reset_link_created: "Reset link created", invite_sent: "Invite sent", invite_accepted: "Invite accepted",
  "2fa_enabled": "Two-step login turned on", "2fa_disabled": "Two-step login turned off", "2fa_failed": "Wrong two-step code",
  role_changed: "Roles changed", deactivated: "Account deactivated", reactivated: "Account reactivated", email_changed: "Email changed",
  must_change_password: "Password change required", user_created: "Account created", user_deleted: "Account deleted", new_device: "New device",
};
export const BAD_EVENTS = new Set(["login_failed", "lockout", "2fa_failed"]);

export function eventTitle(e: SecEvent): string {
  const m = e.meta || {};
  switch (e.type) {
    case "login_success": return m.method === "2fa" ? "Signed in with two-step code" : m.method === "backup_code" ? "Signed in with a backup code" : "Signed in";
    case "login_failed": return `Sign-in failed${m.reason && FAIL_REASON[m.reason] ? ` (${FAIL_REASON[m.reason]})` : ""}`;
    case "lockout": return `Account locked for ${m.minutes || 15} minutes after wrong attempts`;
    case "logout_all": return m.includeCurrent ? "Signed out everywhere" : `Signed out of ${m.count ?? "all"} other device${m.count === 1 ? "" : "s"}`;
    case "session_revoked": return `Signed out ${m.device || "a device"}`;
    case "password_changed": return m.sessionsEnded ? `Password changed · ${m.sessionsEnded} other device${m.sessionsEnded === 1 ? "" : "s"} signed out` : "Password changed";
    case "2fa_enabled": return m.backupCodesRenewed ? "New backup codes made" : "Two-step login turned on";
    case "reset_requested": return m.sent === false ? "Reset link requested (not sent)" : "Reset link requested";
    case "invite_sent": return m.resend ? "Invite sent again" : "Invite sent";
    case "role_changed": return Array.isArray(m.to) ? `Roles changed to ${m.to.join(", ")}` : "Roles changed";
    case "email_changed": return m.to ? `Email changed to ${m.to}` : "Email changed";
    case "must_change_password": return m.required === false ? "Password change no longer required" : "Asked to change password";
    case "new_device": return "Signed in on a new device";
    default: return EVENT_LABEL[e.type] || e.type.replace(/_/g, " ");
  }
}

export function ActivityList({ items, showUser, emptyText = "Nothing here yet." }: { items: SecEvent[]; showUser?: boolean; emptyText?: string }) {
  if (!items.length) return <div className="ss-empty">{emptyText}</div>;
  return (
    <ul className="acc-log">
      {items.map((e) => {
        const bad = BAD_EVENTS.has(e.type);
        const who = e.user?.name || e.user?.email || e.email;
        const by = e.actor && e.actor.id !== e.user?.id ? e.actor.name : null;
        return (
          <li key={e.id} className={bad ? "bad" : ""}>
            <span className="acc-dot" aria-hidden />
            <div>
              <p>
                {showUser && who && <b className="acc-who">{who}</b>}
                <span className="acc-what">{eventTitle(e)}</span>
                {by && <span className="acc-by"> by {by}</span>}
              </p>
              <small>
                {[e.device, fmtWhen(e.createdAt), e.ip ? `IP ${e.ip}` : null].filter(Boolean).join(" · ")}
              </small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Pager({ page, pages, total, onPage, noun = "events" }: { page: number; pages: number; total: number; onPage: (p: number) => void; noun?: string }) {
  if (total === 0) return null;
  return (
    <div className="acc-pager">
      <span>{total} {noun}</span>
      <div>
        <button type="button" className="ss-chip" disabled={page <= 1} onClick={() => onPage(page - 1)}>Newer</button>
        <span>Page {page} of {pages}</span>
        <button type="button" className="ss-chip" disabled={page >= pages} onClick={() => onPage(page + 1)}>Older</button>
      </div>
    </div>
  );
}

export function initials(name?: string | null) {
  const p = (name || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}
export function Avatar({ src, name, size = 44 }: { src?: string | null; name?: string | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className="acc-av" src={src} alt="" style={{ width: size, height: size }} />;
  return <span className="acc-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>;
}
