"use client";
/* My account — profile, password, two-step login, signed-in devices and the
   person's own security activity. ?tab=password&required=1 opens the password
   tab with a "please change your password" banner (set by an admin). */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCircleIcon, LockPasswordIcon, SecurityCheckIcon, ComputerIcon, Activity01Icon, Copy01Icon, Download01Icon,
  Alert02Icon, Refresh01Icon, Logout03Icon, CheckmarkCircle02Icon, SmartPhone01Icon, QrCodeIcon, Key01Icon, LinkSquare02Icon, Mail01Icon,
} from "@hugeicons/core-free-icons";
import { api, apiErr, clearToken, clearApiMemo, type AuthUser, type SecPage, type Session } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import { disablePush } from "@/lib/push";
import {
  ActivityList, Avatar, FieldError, Icon, Note, Pager, PasswordInput, PasswordRules, QrCode, SessionList, copyText, passwordOk,
} from "@/components/admin/account/kit";
import PageLoading from "@/components/admin/PageLoading";
import { WorkspaceHero } from "@/components/admin/Workspace";
import { ROLE_LABELS, userRoles } from "@/lib/permissions";
import "./account-workspace.css";
import EmailPrefs from "@/components/admin/EmailPrefs";

type Tab = "profile" | "password" | "twofa" | "devices" | "emails" | "activity";
const TABS: [Tab, string, any][] = [
  ["profile", "Profile", UserCircleIcon],
  ["password", "Password", LockPasswordIcon],
  ["twofa", "Two-step login", SecurityCheckIcon],
  ["devices", "Devices", ComputerIcon],
  ["emails", "Emails", Mail01Icon],
  ["activity", "Activity", Activity01Icon],
];

/* Tell the dashboard shell (sidebar name/avatar) that the profile changed. */
const announceMe = (user: Partial<AuthUser>) => window.dispatchEvent(new CustomEvent("fv-me", { detail: user }));

export default function MyAccount() {
  const [tab, setTab] = useState<Tab>("profile");
  const [required, setRequired] = useState(false);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loadErr, setLoadErr] = useState("");

  const router = useRouter();
  const [dirty, setDirty] = useState(false);
  const [working, setWorking] = useState(false);
  const dirtyRef = useRef(false), workingRef = useRef(false);
  dirtyRef.current = dirty; workingRef.current = working;
  const load = useCallback(async () => {
    setLoadErr(""); clearApiMemo();
    try {
      const r = await api.me(), u: AuthUser = r?.user ?? r;
      setMe(u);
      if (u?.mustChangePassword || r?.mustChangePassword) { setRequired(true); setTab("password"); }
    } catch (e) { setLoadErr(apiErr(e).message); }
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search), t = q.get("tab") as Tab | null;
    if (t && TABS.some(([k]) => k === t)) setTab(t);
    if (q.get("required") === "1") setRequired(true);
    load();
  }, [load]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (dirtyRef.current || workingRef.current) { e.preventDefault(); e.returnValue = ""; } };
    const click = (e: MouseEvent) => {
      if ((!dirtyRef.current && !workingRef.current) || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href); if (url.origin !== location.origin || url.pathname === location.pathname) return;
      e.preventDefault(); e.stopPropagation(); if (workingRef.current) return;
      dialog.confirm({ title: "Leave without saving?", message: "Edits or setup details on this page may be lost. Save any backup codes before leaving.", confirmText: "Leave page", cancelText: "Keep editing" }).then(ok => { if (ok) { dirtyRef.current = false; setDirty(false); router.push(url.pathname + url.search + url.hash); } });
    };
    window.addEventListener("beforeunload", before); document.addEventListener("click", click, true);
    return () => { window.removeEventListener("beforeunload", before); document.removeEventListener("click", click, true); };
  }, [router]);
  const pick = async (t: Tab) => {
    if (t === tab || working) return;
    if (dirty && !await dialog.confirm({ title: "Discard unsaved changes?", message: "Edits or setup details on this tab may be lost. Save any backup codes before leaving.", confirmText: "Discard changes", cancelText: "Keep editing" })) return;
    setDirty(false); setTab(t);
    const u = new URL(window.location.href); u.searchParams.set("tab", t);
    if (t !== "password") u.searchParams.delete("required");
    window.history.replaceState(null, "", u.pathname + u.search);
  };

  return (
    <div className="acc-wrap fw-workspace account-workspace">
      <WorkspaceHero eyebrow="Your personal space" title="My account" description="Make yourself at home. Manage how your team sees you, how you sign in and which updates reach you." />
      {loadErr && <div className="fw-error" role="alert"><span>{loadErr}</span><button type="button" onClick={load}>Retry / reload</button></div>}
      {me && <section className="account-identity" aria-label="Your account overview"><Avatar src={me.avatar} name={me.name} size={64} /><div className="account-identity-name"><span className="fw-eyebrow">YOUR FINVERA IDENTITY</span><h2>{me.name}</h2><p>{me.email}</p><div className="acc-tags">{userRoles(me).map(role=><span className="adm-badge role" key={role}>{ROLE_LABELS[role] || role}</span>)}</div></div><div className="account-security"><span className={"account-security-state" + (me.twoFactorEnabled ? " on" : "")}><Icon i={SecurityCheckIcon} size={17}/><b>{me.twoFactorEnabled ? "Two-step login on" : "Two-step login off"}</b></span><button type="button" disabled={working} onClick={() => pick("twofa")}>{me.twoFactorEnabled ? "Manage protection ↗" : "Add another layer of protection ↗"}</button></div></section>}
      {required && tab !== "password" && (
        <div className="acc-banner" role="alert">
          <Icon i={Alert02Icon} size={20} />
          <span><b>Please choose a new password.</b> An admin asked you to change it before you carry on.</span>
          <button type="button" className="ss-chip dark" onClick={() => pick("password")}>Change password</button>
        </div>
      )}
      <div className="account-grid"><div className="ss-pills acc-tabs" role="tablist" aria-orientation="vertical" aria-label="Account sections">
        {TABS.map(([k, label, ic]) => (
          <button key={k} type="button" role="tab" id={`acc-tab-${k}`} aria-selected={tab === k} aria-controls="acc-panel" disabled={working} className={tab === k ? "on" : ""} onClick={() => pick(k)}>
            <em><Icon i={ic} size={14} /></em>{label}
            {k === "twofa" && me && <small className={me.twoFactorEnabled ? "acc-on" : ""}>{me.twoFactorEnabled ? "On" : "Off"}</small>}
          </button>
        ))}
      </div>
      <section id="acc-panel" role="tabpanel" aria-labelledby={`acc-tab-${tab}`}>
        {!me ? (
          !loadErr ? <PageLoading label="Loading your account…" variant="list" /> : <div className="ss-empty">Your account could not be loaded. Retry above to continue.</div>
        ) : tab === "profile" ? <ProfileTab me={me} onDirty={setDirty} onWorking={setWorking} onSaved={(u) => { setMe(u); announceMe(u); }} />
          : tab === "password" ? <PasswordTab required={required} onDirty={setDirty} onWorking={setWorking} onDone={() => { setRequired(false); setMe({ ...me, mustChangePassword: false }); announceMe({mustChangePassword:false}); }} />
          : tab === "twofa" ? <TwoFactorTab me={me} onDirty={setDirty} onWorking={setWorking} onChange={(on) => { setMe({ ...me, twoFactorEnabled: on }); announceMe({twoFactorEnabled:on}); }} />
          : tab === "devices" ? <DevicesTab />
          : tab === "emails" ? <EmailPrefs />
          : <ActivityTab />}
      </section></div>
    </div>
  );
}

/* ── Profile ── */
function ProfileTab({ me, onSaved, onDirty, onWorking }: { me: AuthUser; onSaved: (u: AuthUser) => void; onDirty: (dirty:boolean)=>void; onWorking: (busy:boolean)=>void }) {
  const [name, setName] = useState(me.name || "");
  const [email, setEmail] = useState(me.email || "");
  const [avatar, setAvatar] = useState<string | null>(me.avatar);
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [up, setUp] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const emailChanged = email.trim().toLowerCase() !== (me.email || "").toLowerCase();
  const dirty = name.trim() !== (me.name || "") || emailChanged || (avatar || null) !== (me.avatar || null);

  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);
  useEffect(() => { onWorking(busy || up); return () => onWorking(false); }, [busy, up, onWorking]);

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) || f.size > 10 * 1024 * 1024) { toast("Choose a JPG, PNG or WebP under 10 MB", "err"); return; }
    setUp(true);
    try { const { url } = await api.upload(f); setAvatar(url); }
    catch (ex) { toast("Couldn't upload the photo", "err", { description: apiErr(ex).message }); }
    finally { setUp(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || up) return;
    setErrs({}); setErr("");
    if (!name.trim()) { setErrs({ name: "Enter your name." }); return; }
    setBusy(true);
    try {
      const body: Parameters<typeof api.updateMe>[0] = { name: name.trim(), avatar: avatar || null };
      if (emailChanged) { body.email = email.trim(); body.currentPassword = current; }
      const r = await api.updateMe(body);
      onSaved(r.user); setCurrent("");
      toast("Profile saved", "ok", { description: emailChanged ? `You now sign in with ${r.user.email}` : undefined });
    } catch (ex) {
      const x = apiErr(ex);
      if (x.field) setErrs({ [x.field]: x.message }); else setErr(x.message);
    } finally { setBusy(false); }
  }

  return (
    <form className="acc-panel" onSubmit={save}>
      <h2>Profile</h2>
      <p className="acc-sub">How you appear to the team.</p>
      {err && <Note kind="err">{err}</Note>}
      <div className="acc-avrow">
        <Avatar src={avatar} name={name} size={72} />
        <div>
          <div className="acc-btnrow">
            <button type="button" className="ss-chip" onClick={() => fileRef.current?.click()} disabled={up || busy}>{up ? "Uploading…" : avatar ? "Change photo" : "Upload photo"}</button>
            {avatar && <button type="button" className="ss-chip ghost" disabled={up || busy} onClick={() => setAvatar(null)}>Remove</button>}
          </div>
          <p className="acc-hint">A square JPG, PNG or WebP under 10 MB works best.</p>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickFile} />
        </div>
      </div>
      <div className="adm-field">
        <label htmlFor="p-name">Full name</label>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-invalid={!!errs.name || undefined} />
        <FieldError msg={errs.name} />
      </div>
      <div className="adm-field">
        <label htmlFor="p-email">Email (you sign in with this)</label>
        <input id="p-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-invalid={!!errs.email || undefined} />
        <FieldError msg={errs.email} />
      </div>
      {emailChanged && (
        <div className="adm-field">
          <label htmlFor="p-cur">Current password</label>
          <PasswordInput id="p-cur" value={current} onChange={setCurrent} autoComplete="current-password" invalid={!!errs.currentPassword} />
          <p className="acc-hint">To change your sign-in email, confirm it&apos;s you.</p>
          <FieldError msg={errs.currentPassword} />
        </div>
      )}
      <div className="acc-actions">
        <button className="adm-btn primary" type="submit" disabled={busy || up || !dirty || (emailChanged && !current)}>{busy ? <><span className="spin" /> Saving…</> : "Save profile"}</button>
      </div>
    </form>
  );
}

/* ── Password ── */
function PasswordTab({ required, onDone, onDirty, onWorking }: { required: boolean; onDone: () => void; onDirty: (dirty:boolean)=>void; onWorking: (busy:boolean)=>void }) {
  const router = useRouter();
  const [cur, setCur] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [ok, setOk] = useState<{ ended: number; wasRequired: boolean } | null>(null);

  useEffect(() => { onDirty(!!(cur || pw || pw2)); }, [cur, pw, pw2, onDirty]);
  useEffect(() => { onWorking(busy); return () => onWorking(false); }, [busy, onWorking]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErrs({});
    if (!passwordOk(pw)) { setErrs({ password: "Password must be at least 8 characters and include at least one letter and one number." }); return; }
    if (pw !== pw2) { setErrs({ confirm: "The two passwords don't match." }); return; }
    setBusy(true);
    try {
      const r = await api.changePassword(cur, pw);
      setOk({ ended: r.sessionsEnded || 0, wasRequired: required });
      setCur(""); setPw(""); setPw2("");
      onDone();
      toast("Password updated", "ok");
    } catch (ex) {
      const x = apiErr(ex);
      setErrs({ [x.field === "currentPassword" ? "current" : x.field === "password" ? "password" : "form"]: x.message });
    } finally { setBusy(false); }
  }

  return (
    <form className="acc-panel" onSubmit={save}>
      <h2>Password</h2>
      <p className="acc-sub">Changing it signs you out on your other phones and computers.</p>
      {required && !ok && (
        <div className="acc-banner inpanel" role="alert">
          <Icon i={Alert02Icon} size={20} />
          <span><b>Please choose a new password.</b> An admin asked you to change it before you carry on.</span>
        </div>
      )}
      {ok && (
        <Note kind="ok" title="Password updated.">
          {ok.ended ? ` ${ok.ended} other device${ok.ended === 1 ? " was" : "s were"} signed out.` : " You're still signed in here."}
          {ok.wasRequired && <> <button type="button" className="acc-link" onClick={() => router.push("/dashboard")}>Go to the dashboard</button></>}
        </Note>
      )}
      {errs.form && <Note kind="err">{errs.form}</Note>}
      <input type="text" autoComplete="username" hidden readOnly />
      <div className="adm-field">
        <label htmlFor="pw-cur">Current password</label>
        <PasswordInput id="pw-cur" value={cur} onChange={(v) => { setCur(v); setErrs({}); }} autoComplete="current-password" invalid={!!errs.current} />
        <FieldError msg={errs.current} />
      </div>
      <div className="adm-field">
        <label htmlFor="pw-new">New password</label>
        <PasswordInput id="pw-new" value={pw} onChange={(v) => { setPw(v); setErrs({}); }} invalid={!!errs.password} />
        <FieldError msg={errs.password} />
      </div>
      <div className="adm-field">
        <label htmlFor="pw-new2">Type the new password again</label>
        <PasswordInput id="pw-new2" value={pw2} onChange={(v) => { setPw2(v); setErrs({}); }} invalid={!!errs.confirm} />
        <FieldError msg={errs.confirm} />
      </div>
      <PasswordRules value={pw} confirm={pw2} />
      <div className="acc-actions">
        <button className="adm-btn primary" type="submit" disabled={busy || !cur || !passwordOk(pw) || pw !== pw2}>{busy ? <><span className="spin" /> Saving…</> : "Change password"}</button>
      </div>
    </form>
  );
}

/* ── Two-step login ── */
function CodesBox({ codes, account }: { codes: string[]; account: string }) {
  const text = `Finvera backup codes for ${account}\nEach code works once. Keep them somewhere safe.\n\n${codes.join("\n")}\n\nMade ${new Date().toLocaleString("en-IN")}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "finvera-backup-codes.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="acc-codesbox">
      <Note kind="warn" title="Save these backup codes now.">If you lose your phone, each code lets you sign in once. You won&apos;t see them again.</Note>
      <ol className="acc-codes">{codes.map((c) => <li key={c}><code>{c}</code></li>)}</ol>
      <div className="acc-btnrow">
        <button type="button" className="ss-chip" onClick={() => copyText(codes.join("\n"), "Backup codes copied")}><Icon i={Copy01Icon} size={15} />Copy</button>
        <button type="button" className="ss-chip" onClick={download}><Icon i={Download01Icon} size={15} />Download .txt</button>
      </div>
    </div>
  );
}

function CodeInput({ id, value, onChange, label = "6-digit code from the app", invalid }: { id: string; value: string; onChange: (v: string) => void; label?: string; invalid?: boolean }) {
  return (
    <div className="adm-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="acc-code otp" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="······" aria-invalid={invalid || undefined} />
    </div>
  );
}

function TwoFactorTab({ me, onChange, onDirty, onWorking }: { me: AuthUser; onChange: (on: boolean) => void; onDirty: (dirty:boolean)=>void; onWorking: (busy:boolean)=>void }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; account: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState<"" | "disable" | "renew">("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { onDirty(!!(setup || codes || mode || code || pw)); }, [setup, codes, mode, code, pw, onDirty]);
  useEffect(() => { onWorking(busy); return () => onWorking(false); }, [busy, onWorking]);

  const reset = () => { setCode(""); setPw(""); setErr(""); };
  async function start() {
    setBusy(true); reset();
    try { setSetup(await api.twoFactorSetup()); }
    catch (ex) { setErr(apiErr(ex).message); }
    finally { setBusy(false); }
  }
  async function enable(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api.twoFactorEnable(code);
      setCodes(r.backupCodes); setSetup(null); setCode(""); onChange(true);
      toast("Two-step login is on", "ok");
    } catch (ex) { setErr(apiErr(ex).message); }
    finally { setBusy(false); }
  }
  async function disable(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      await api.twoFactorDisable(pw, code);
      setMode(""); reset(); setCodes(null); onChange(false);
      toast("Two-step login is off", "ok");
    } catch (ex) { setErr(apiErr(ex).message); }
    finally { setBusy(false); }
  }
  async function renew(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const r = await api.newBackupCodes(code);
      setCodes(r.backupCodes); setMode(""); reset();
      toast("New backup codes made", "ok", { description: "Your old codes no longer work." });
    } catch (ex) { setErr(apiErr(ex).message); }
    finally { setBusy(false); }
  }

  if (codes) {
    return (
      <div className="acc-panel">
        <div className="acc-status on"><Icon i={CheckmarkCircle02Icon} size={22} /><div><b>Two-step login is on</b><span>You&apos;ll enter a code from your phone each time you sign in.</span></div></div>
        <CodesBox codes={codes} account={me.email} />
        <div className="acc-actions"><button type="button" className="adm-btn primary" onClick={() => setCodes(null)}>I&apos;ve saved my codes</button></div>
      </div>
    );
  }

  if (setup) {
    const grouped = setup.secret.replace(/(.{4})/g, "$1 ").trim();
    return (
      <form className="acc-panel" onSubmit={enable}>
        <h2>Turn on two-step login</h2>
        <p className="acc-sub">Three quick steps. Keep this page open until you finish.</p>
        <ol className="acc-steps">
          <li><b>Get an authenticator app</b><span>Google Authenticator or Microsoft Authenticator, free on Android and iPhone.</span></li>
          <li>
            <b>Add Finvera to the app</b>
            <span>In the app, tap <i>+</i> and scan this QR code.</span>
            <div className="acc-qrwrap">
              <QrCode text={setup.otpauthUrl} label={`QR code to add Finvera (${setup.account}) to your authenticator app`} />
              <div className="acc-secret">
                <small>On this phone? Can&apos;t scan? Type this key instead:</small>
                <code aria-label="Setup key">{grouped}</code>
                <div className="acc-btnrow">
                  <button type="button" className="ss-chip" onClick={() => copyText(setup.secret, "Key copied")}><Icon i={Copy01Icon} size={15} />Copy key</button>
                  <a className="ss-chip acc-mobonly" href={setup.otpauthUrl}><Icon i={SmartPhone01Icon} size={15} />Open in app</a>
                </div>
                <small>Account: {setup.account} · Time-based</small>
              </div>
            </div>
          </li>
          <li>
            <b>Enter the code the app shows</b>
            {err && <Note kind="err">{err}</Note>}
            <CodeInput id="tf-code" value={code} onChange={(v) => { setCode(v); setErr(""); }} invalid={!!err} />
          </li>
        </ol>
        <div className="acc-actions">
          <button type="button" className="adm-btn ghost" onClick={() => { setSetup(null); reset(); }}>Cancel</button>
          <button className="adm-btn primary" type="submit" disabled={busy || code.length !== 6}>{busy ? <><span className="spin" /> Checking…</> : "Turn on"}</button>
        </div>
      </form>
    );
  }

  if (!me.twoFactorEnabled) {
    return (
      <div className="acc-panel">
        <div className="acc-status"><Icon i={QrCodeIcon} size={22} /><div><b>Two-step login is off</b><span>Add a second step: after your password, enter a 6-digit code from an app on your phone. Someone who learns your password still can&apos;t get in.</span></div></div>
        {err && <Note kind="err">{err}</Note>}
        <div className="acc-actions"><button type="button" className="adm-btn primary" onClick={start} disabled={busy}>{busy ? <><span className="spin" /> Starting…</> : "Turn on two-step login"}</button></div>
      </div>
    );
  }

  return (
    <div className="acc-panel">
      <div className="acc-status on"><Icon i={CheckmarkCircle02Icon} size={22} /><div><b>Two-step login is on</b><span>You enter a code from your authenticator app each time you sign in. Lost your phone? Use a backup code, or ask an admin to turn it off.</span></div></div>
      {!mode && (
        <div className="acc-btnrow">
          <button type="button" className="ss-chip" onClick={() => { reset(); setMode("renew"); }}><Icon i={Refresh01Icon} size={15} />Get new backup codes</button>
          <button type="button" className="ss-chip ghost acc-danger" onClick={() => { reset(); setMode("disable"); }}>Turn off</button>
        </div>
      )}
      {mode === "renew" && (
        <form className="acc-sub-form" onSubmit={renew}>
          <h3><Icon i={Key01Icon} size={16} />New backup codes</h3>
          <p className="acc-hint">Your old backup codes will stop working.</p>
          {err && <Note kind="err">{err}</Note>}
          <CodeInput id="tf-renew" value={code} onChange={(v) => { setCode(v); setErr(""); }} invalid={!!err} />
          <div className="acc-actions">
            <button type="button" className="adm-btn ghost" onClick={() => { setMode(""); reset(); }}>Cancel</button>
            <button type="submit" className="adm-btn primary" disabled={busy || code.length !== 6}>{busy ? <><span className="spin" /> Making…</> : "Make new codes"}</button>
          </div>
        </form>
      )}
      {mode === "disable" && (
        <form className="acc-sub-form" onSubmit={disable}>
          <h3>Turn off two-step login</h3>
          <p className="acc-hint">You&apos;ll sign in with just your password.</p>
          {err && <Note kind="err">{err}</Note>}
          <input type="text" autoComplete="username" hidden readOnly />
          <div className="adm-field">
            <label htmlFor="tf-pw">Your password</label>
            <PasswordInput id="tf-pw" value={pw} onChange={(v) => { setPw(v); setErr(""); }} autoComplete="current-password" />
          </div>
          <CodeInput id="tf-off" value={code} onChange={(v) => { setCode(v); setErr(""); }} />
          <div className="acc-actions">
            <button type="button" className="adm-btn ghost" onClick={() => { setMode(""); reset(); }}>Cancel</button>
            <button type="submit" className="adm-btn danger" disabled={busy || !pw || code.length !== 6}>{busy ? <><span className="spin" /> Turning off…</> : "Turn off"}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Devices ── */
function DevicesTab() {
  const router = useRouter();
  const [list, setList] = useState<Session[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const [err, setErr] = useState("");
  const load = useCallback(() => { setErr(""); return api.mySessions().then((r) => setList(r.sessions)).catch((e) => setErr(apiErr(e).message)); }, []);
  useEffect(() => { load(); }, [load]);

  async function signOut(s: Session) {
    if (s.current) {
      const yes = await dialog.confirm({ title: "Sign out of this device?", message: "You'll go back to the sign-in page.", confirmText: "Sign out" });
      if (!yes) return;
      await disablePush().catch(() => {});
      try { await api.logout(); } catch { /* ignore */ }
      clearToken(); clearApiMemo(); router.replace("/login");
      return;
    }
    setBusy(s.id);
    try { await api.revokeMySession(s.id); toast("Signed out", "ok", { description: s.device }); await load(); }
    catch (e) { toast("Couldn't sign out that device", "err", { description: apiErr(e).message }); }
    finally { setBusy(null); }
  }
  async function signOutOthers() {
    const yes = await dialog.confirm({ title: "Sign out all other devices?", message: "Every phone and computer except this one will need to sign in again.", confirmText: "Sign out others" });
    if (!yes) return;
    setAll(true);
    try { const r = await api.logoutAll(false); toast(r.count ? `Signed out of ${r.count} device${r.count === 1 ? "" : "s"}` : "No other devices were signed in", "ok"); await load(); }
    catch (e) { toast("Couldn't sign out", "err", { description: apiErr(e).message }); }
    finally { setAll(false); }
  }

  const others = (list || []).filter((s) => !s.current).length;
  return (
    <div className="acc-panel">
      <div className="acc-panel-h">
        <div><h2>Devices</h2><p className="acc-sub">Phones and computers signed in to your account. Don&apos;t recognise one? Sign it out and change your password.</p></div>
        {others > 0 && <button type="button" className="ss-chip acc-danger" onClick={signOutOthers} disabled={all}><Icon i={Logout03Icon} size={15} />{all ? "Signing out…" : "Sign out all other devices"}</button>}
      </div>
      {err && <div className="fw-error" role="alert"><span>{err}</span><button type="button" onClick={load}>Retry</button></div>}
      {!list ? err ? null : <PageLoading label="Loading devices…" variant="list" /> : <SessionList sessions={list} onSignOut={signOut} busy={busy} />}
    </div>
  );
}

/* ── Activity ── */
function ActivityTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SecPage | null>(null);
  const [err, setErr] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setData(null); setErr("");
    api.myActivity({ page, limit: 20 }).then((d) => alive && setData(d)).catch((e) => alive && setErr(apiErr(e).message));
    return () => { alive = false; };
  }, [page, reload]);
  return (
    <div className="acc-panel">
      <h2>Activity</h2>
      <p className="acc-sub">Sign-ins and security changes on your account. Failed attempts are shown in red.</p>
      {err && <div className="fw-error" role="alert"><span>{err}</span><button type="button" onClick={() => setReload(n=>n+1)}>Retry</button></div>}
      {!data ? err ? null : <PageLoading label="Loading your security activity…" variant="list" /> : (
        <>
          <ActivityList items={data.items} emptyText="No activity yet." />
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      <p className="acc-hint" style={{ marginTop: 14 }}><Icon i={LinkSquare02Icon} size={13} /> Something you don&apos;t recognise? Change your password and sign out other devices.</p>
    </div>
  );
}
