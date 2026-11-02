"use client";
/* Users — who can sign in, what they can open and which brands they see in the
   content planner. Invite by link (email and/or WhatsApp), reset links,
   unlock, two-step login reset, devices, activity, and the security log. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  UserAdd01Icon, PencilEdit02Icon, MoreVerticalIcon, Mail01Icon, Key01Icon, LockPasswordIcon, SquareUnlock02Icon, SecurityCheckIcon,
  ComputerIcon, Activity01Icon, UserBlock01Icon, UserCheck01Icon, Delete02Icon, Search01Icon, UserMultipleIcon, Shield01Icon,
  Logout03Icon, Alert02Icon, PlusSignIcon, Clock01Icon,
} from "@hugeicons/core-free-icons";
import { api, apiErr, type AdminUser, type SecPage, type Session, type ShareLink, type UserStatus } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import Select from "@/components/Select";
import ExportButton from "@/components/admin/ExportButton";
import Toggle from "@/components/ui/Toggle";
import DatePicker from "@/components/ui/DatePicker";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  ActivityList, Avatar, EVENT_LABEL, FieldError, Icon, Note, Pager, PasswordInput, PasswordRules, SessionList, ShareLinkBox,
  ago, fmtWhen, passwordOk,
} from "@/components/admin/account/kit";

const ROLES: { value: string; label: string }[] = [
  { value: "admin", label: "Admin — full access" },
  { value: "content", label: "Content — site content, blog, projects, team…" },
  { value: "projects", label: "Project board — kanban only" },
  { value: "leads", label: "Leads — pipeline + contact inbox" },
  { value: "seo", label: "SEO — SEO + settings & pixels" },
  { value: "social", label: "Social media — posts content (gets posts at Ready to post)" },
  { value: "marketer", label: "Marketer — plans & shoots reels (gets reels at Planned / Need from client)" },
  { value: "video", label: "Video editor — edits reels (gets reels at In production)" },
  { value: "graphic", label: "Graphic designer — makes posts & carousels (gets them to design)" },
];
const SOCIAL_ROLES = ["social", "marketer", "video", "graphic", "content", "projects"];
const STATUS: Record<UserStatus, { label: string; cls: string }> = {
  active: { label: "Active", cls: "green" },
  invited: { label: "Invited", cls: "blue" },
  locked: { label: "Locked", cls: "amber" },
  deactivated: { label: "Deactivated", cls: "grey" },
};
type Brand = { id: number; name: string; color?: string | null };
type Tab = "members" | "log";

/* ── Small pieces ── */
function MultiPick({ options, value, onChange, label }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return (
    <div className="adm-multi" role="group" aria-label={label}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button type="button" key={o.value} className={"adm-multi-opt" + (on ? " on" : "")} aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o.value) : [...value, o.value])}>
            <span className="adm-multi-box" aria-hidden />{o.label}
          </button>
        );
      })}
    </div>
  );
}

function PhotoPick({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy(true);
    try { onChange((await api.upload(f)).url); }
    catch (ex) { toast("Couldn't upload the photo", "err", { description: apiErr(ex).message }); }
    finally { setBusy(false); }
  }
  return (
    <div className="acc-avrow">
      <Avatar src={value || null} name={name} size={56} />
      <div className="acc-btnrow">
        <button type="button" className="ss-chip" onClick={() => ref.current?.click()} disabled={busy}>{busy ? "Uploading…" : value ? "Change photo" : "Upload photo"}</button>
        {value && <button type="button" className="ss-chip ghost" onClick={() => onChange("")}>Remove</button>}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
    </div>
  );
}

function Drawer({ title, sub, onClose, children, wide }: { title: string; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="adm-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className={"adm-drawer acc-drawer" + (wide ? " wide" : "")} role="dialog" aria-modal="true" aria-label={title}>
        <div className="acc-drawer-h">
          <div><h2>{title}</h2>{sub && <p className="sub">{sub}</p>}</div>
          <button type="button" className="ss-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

/* ── Page ── */
export default function AdminUsers() {
  const [tab, setTab] = useState<Tab>("members");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [meId, setMeId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | UserStatus>("all");
  const [edit, setEdit] = useState<AdminUser | "new" | null>(null);
  const [invite, setInvite] = useState(false);
  const [share, setShare] = useState<(ShareLink & { name: string; email: string; kind: "invite" | "reset" }) | null>(null);
  const [devicesOf, setDevicesOf] = useState<AdminUser | null>(null);
  const [activityOf, setActivityOf] = useState<AdminUser | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [menuUp, setMenuUp] = useState(false); // open the actions menu upwards near the bottom of the screen

  const load = useCallback(async () => {
    try { setUsers(await api.listAdminUsers()); setErr(""); }
    catch (e) { setErr(apiErr(e).message); }
  }, []);
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "log") setTab("log");
    load();
    api.list("social-clients").then((cs) => setBrands(Array.isArray(cs) ? cs : [])).catch(() => {});
    api.me().then((r) => setMeId((r?.user ?? r)?.id ?? null)).catch(() => {});
  }, [load]);
  useEffect(() => {
    if (menu == null) return;
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".acc-menuwrap")) setMenu(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [menu]);

  const pickTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", t === "log" ? "?tab=log" : window.location.pathname);
  };
  const brandName = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: users?.length || 0 };
    (users || []).forEach((u) => { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }, [users]);
  const shown = useMemo(() => (users || []).filter((u) =>
    (status === "all" || u.status === status) &&
    (!q.trim() || `${u.name} ${u.email} ${u.title || ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [users, status, q]);

  const replace = (u: AdminUser) => setUsers((list) => (list || []).map((x) => (x.id === u.id ? u : x)));

  async function run(label: string, fn: () => Promise<{ message?: string; user?: AdminUser } | void>) {
    setMenu(null);
    try {
      const r = await fn();
      if (r && r.user) replace(r.user); else await load();
      toast(label, "ok", { description: r && r.message ? r.message : undefined });
    } catch (e) { toast("That didn't work", "err", { description: apiErr(e).message }); }
  }

  async function act(u: AdminUser, what: string) {
    setMenu(null);
    switch (what) {
      case "resend":
      case "reset": {
        try {
          const r = what === "resend" ? await api.resendInvite(u.id) : await api.userResetLink(u.id);
          if ("user" in r && r.user) replace(r.user);
          setShare({ ...r, name: u.name, email: u.email, kind: what === "resend" || r.kind === "invite" ? "invite" : "reset" });
          load();
        } catch (e) { toast("Couldn't make the link", "err", { description: apiErr(e).message }); }
        return;
      }
      case "require":
        return run(u.mustChangePassword ? "Password change no longer required" : "Password change required",
          () => api.requirePasswordChange(u.id, !u.mustChangePassword));
      case "unlock": return run(`${u.name} unlocked`, () => api.unlockUser(u.id));
      case "2fa": {
        const yes = await dialog.confirm({ title: `Turn off two-step login for ${u.name}?`, message: "Do this if they lost their phone. They'll sign in with just their password and can turn it on again from My account.", confirmText: "Turn off", danger: true });
        if (yes) return run("Two-step login turned off", () => api.resetUser2fa(u.id));
        return;
      }
      case "devices": setDevicesOf(u); return;
      case "activity": setActivityOf(u); return;
      case "deactivate": {
        const yes = await dialog.confirm({ title: `Deactivate ${u.name}?`, message: "They're signed out everywhere and can't sign in. Their posts and tasks stay. You can reactivate them later.", confirmText: "Deactivate", danger: true });
        if (yes) return run(`${u.name} deactivated`, async () => { replace(await api.updateUser(u.id, { active: false })); });
        return;
      }
      case "reactivate": return run(`${u.name} reactivated`, async () => { replace(await api.updateUser(u.id, { active: true })); });
      case "delete": {
        const yes = await dialog.confirm({ title: `Delete ${u.name}?`, message: `${u.email} is removed for good and signed out everywhere. To keep their history, deactivate instead. This can't be undone.`, confirmText: "Delete", danger: true });
        if (!yes) return;
        try { await api.deleteUser(u.id); setUsers((l) => (l || []).filter((x) => x.id !== u.id)); toast("User deleted", "ok", { description: u.name }); }
        catch (e) { toast("Couldn't delete", "err", { description: apiErr(e).message }); }
      }
    }
  }

  return (
    <div className="acc-users">
      <div className="adm-top">
        <div><h1>Users</h1><p>Who can sign in, what they can open, and which brands they see in the content planner.</p></div>
        {tab === "members" && (
          <div className="acc-btnrow">
            <ExportButton entity="users" />
            <button type="button" className="ss-chip" onClick={() => setEdit("new")}><Icon i={PlusSignIcon} size={15} />Add with password</button>
            <button type="button" className="adm-btn primary" onClick={() => setInvite(true)}><Icon i={UserAdd01Icon} size={16} />Invite member</button>
          </div>
        )}
      </div>

      <div className="ss-pills acc-tabs" role="tablist" aria-label="Users sections">
        <button type="button" role="tab" aria-selected={tab === "members"} className={tab === "members" ? "on" : ""} onClick={() => pickTab("members")}>
          <em><Icon i={UserMultipleIcon} size={14} /></em>Members{users && <small>{users.length}</small>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "log"} className={tab === "log" ? "on" : ""} onClick={() => pickTab("log")}>
          <em><Icon i={Shield01Icon} size={14} /></em>Security log
        </button>
      </div>

      {err && <Note kind="err">{err}</Note>}

      {tab === "log" ? <SecurityLog users={users || []} /> : (
        <>
          <div className="acc-toolbar">
            <label className="acc-search">
              <Icon i={Search01Icon} size={16} />
              <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            </label>
            <div className="acc-chips" role="group" aria-label="Filter by status">
              {(["all", "active", "invited", "locked", "deactivated"] as const).map((s) => (
                (s === "all" || counts[s]) ? (
                  <button key={s} type="button" className="acc-chipf" aria-pressed={status === s} onClick={() => setStatus(s)}>
                    {s === "all" ? "Everyone" : STATUS[s].label}<em>{counts[s] || 0}</em>
                  </button>
                ) : null
              ))}
            </div>
          </div>

          {!users ? (
            <div className="acc-grid">{[0, 1, 2].map((i) => <div key={i} className="acc-ucard"><span className="skel skel-line" style={{ display: "block", height: 150, borderRadius: 14 }} /></div>)}</div>
          ) : !shown.length ? (
            <div className="ss-empty">{users.length ? "No users match." : "No users yet. Invite your first team member."}</div>
          ) : (
            <div className="acc-grid">
              {shown.map((u) => {
                const st = STATUS[u.status] || STATUS.active;
                const isAdmin = u.roles.includes("admin");
                const self = u.id === meId;
                const social = u.roles.some((r) => SOCIAL_ROLES.includes(r));
                return (
                  <article key={u.id} className={"acc-ucard" + (u.status === "deactivated" ? " off" : "")}>
                    <div className="acc-uhd">
                      <Avatar src={u.avatar} name={u.name} size={44} />
                      <span className="acc-utx"><b>{u.name}</b><small>{u.email}</small></span>
                      <span className={"acc-pill " + st.cls}>{st.label}</span>
                    </div>
                    <p className="acc-uline">
                      {u.title || "No job title"} · <span>
                        {u.status === "invited"
                          ? `Invited ${ago(u.invitedAt).toLowerCase()}`
                          : u.status === "locked" && u.lockedUntil
                            ? `Locked until ${new Date(u.lockedUntil).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                            : u.lastLoginAt ? `Last sign-in ${ago(u.lastLoginAt).toLowerCase()}` : "Never signed in"}
                      </span>
                    </p>
                    {(u.twoFactorEnabled || u.mustChangePassword || self) && (
                      <div className="acc-flags">
                        {self && <span className="acc-pill blue nodot">You</span>}
                        {u.twoFactorEnabled && <span className="acc-flag ok"><Icon i={SecurityCheckIcon} size={13} />Two-step on</span>}
                        {u.mustChangePassword && <span className="acc-flag warn"><Icon i={LockPasswordIcon} size={13} />Must change password</span>}
                      </div>
                    )}
                    <div>
                      <div className="acc-lbl2">Roles</div>
                      <div className="acc-tags">{u.roles.map((r) => <span key={r} className="adm-badge role">{ROLE_LABELS[r] || r}</span>)}</div>
                    </div>
                    <div>
                      <div className="acc-lbl2">Content planner brands</div>
                      <div className="acc-tags">
                        {isAdmin ? <span className="acc-bchip"><i style={{ background: "var(--blue-500)" }}>★</i>All brands</span>
                          : (u.socialClients || []).length ? u.socialClients.map((id) => {
                            const b = brandName.get(Number(id));
                            return <span key={id} className="acc-bchip"><i style={{ background: b?.color || "#3e60ab" }}>{(b?.name || "?")[0]}</i>{b?.name || `Brand #${id}`}</span>;
                          }) : <span className="acc-none">{social ? "No brands ticked, so no planner access" : "Not a social media role"}</span>}
                      </div>
                    </div>
                    <div className="acc-ufoot">
                      <button type="button" className="ss-chip" onClick={() => setEdit(u)}><Icon i={PencilEdit02Icon} size={15} />Edit</button>
                      {u.status === "invited" && <button type="button" className="ss-chip" onClick={() => act(u, "resend")}><Icon i={Mail01Icon} size={15} />Resend invite</button>}
                      {u.status === "locked" && <button type="button" className="ss-chip" onClick={() => act(u, "unlock")}><Icon i={SquareUnlock02Icon} size={15} />Unlock</button>}
                      <div className="acc-menuwrap">
                        <button type="button" className="ss-chip acc-more" aria-haspopup="menu" aria-expanded={menu === u.id} aria-label={`More actions for ${u.name}`}
                          onClick={(e) => { setMenuUp(window.innerHeight - e.currentTarget.getBoundingClientRect().bottom < 400 && e.currentTarget.getBoundingClientRect().top > 420); setMenu(menu === u.id ? null : u.id); }}><Icon i={MoreVerticalIcon} size={16} /></button>
                        {menu === u.id && (
                          <div className={"acc-menu" + (menuUp ? " up" : "")} role="menu">
                            {u.status === "invited" && <button role="menuitem" onClick={() => act(u, "resend")}><Icon i={Mail01Icon} />Resend invite</button>}
                            {u.status !== "invited" && u.status !== "deactivated" && <button role="menuitem" onClick={() => act(u, "reset")}><Icon i={Key01Icon} />Send reset link</button>}
                            {u.status !== "invited" && <button role="menuitem" onClick={() => act(u, "require")}><Icon i={LockPasswordIcon} />{u.mustChangePassword ? "Don't require password change" : "Require password change"}</button>}
                            {u.status === "locked" && <button role="menuitem" onClick={() => act(u, "unlock")}><Icon i={SquareUnlock02Icon} />Unlock</button>}
                            {u.twoFactorEnabled && <button role="menuitem" onClick={() => act(u, "2fa")}><Icon i={SecurityCheckIcon} />Turn off two-step login</button>}
                            <button role="menuitem" onClick={() => act(u, "devices")}><Icon i={ComputerIcon} />See devices</button>
                            <button role="menuitem" onClick={() => act(u, "activity")}><Icon i={Activity01Icon} />See activity</button>
                            {!self && <hr />}
                            {!self && (u.status === "deactivated"
                              ? <button role="menuitem" onClick={() => act(u, "reactivate")}><Icon i={UserCheck01Icon} />Reactivate</button>
                              : <button role="menuitem" className="danger" onClick={() => act(u, "deactivate")}><Icon i={UserBlock01Icon} />Deactivate</button>)}
                            {!self && <button role="menuitem" className="danger" onClick={() => act(u, "delete")}><Icon i={Delete02Icon} />Delete</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {invite && <InviteDrawer brands={brands} onClose={() => setInvite(false)} onInvited={(u) => setUsers((l) => [...(l || []), u])} />}
      {edit && <EditDrawer user={edit === "new" ? null : edit} self={edit !== "new" && edit.id === meId} brands={brands}
        onClose={() => setEdit(null)} onSaved={(u, isNew) => { if (isNew) setUsers((l) => [...(l || []), u]); else replace(u); setEdit(null); }} />}
      {share && (
        <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setShare(null); }}>
          <div className="ss-modal" role="dialog" aria-modal="true" aria-label={share.kind === "invite" ? "Invite link" : "Reset link"}>
            <div className="ss-modal-h"><h3>{share.kind === "invite" ? `New invite for ${share.name}` : `Reset link for ${share.name}`}</h3><button type="button" className="ss-btn" onClick={() => setShare(null)} aria-label="Close">×</button></div>
            {share.kind === "invite" && <p className="ss-note" style={{ margin: 0 }}>Any older invite link for them has stopped working.</p>}
            <ShareLinkBox link={share.link} expiresAt={share.expiresAt} emailed={share.emailed} email={share.email} name={share.name} kind={share.kind} />
            <div className="ss-modal-f"><button type="button" className="ss-chip dark" onClick={() => setShare(null)}>Done</button></div>
          </div>
        </div>
      )}
      {devicesOf && <DevicesDrawer user={devicesOf} onClose={() => setDevicesOf(null)} />}
      {activityOf && <ActivityDrawer user={activityOf} onClose={() => setActivityOf(null)} />}
    </div>
  );
}

/* ── Invite ── */
function InviteDrawer({ brands, onClose, onInvited }: { brands: Brand[]; onClose: () => void; onInvited: (u: AdminUser) => void }) {
  const blank = { name: "", email: "", title: "", roles: ["marketer"] as string[], brands: [] as string[], sendEmail: true };
  const [f, setF] = useState(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<(ShareLink & { user: AdminUser }) | null>(null);
  const set = (k: keyof typeof blank, v: unknown) => { setF((x) => ({ ...x, [k]: v })); setErrs({}); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = "Enter their name.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = "Enter a valid email address.";
    if (!f.roles.length) er.roles = "Pick at least one role.";
    if (Object.keys(er).length) { setErrs(er); return; }
    setBusy(true);
    try {
      const r = await api.inviteUser({ name: f.name.trim(), email: f.email.trim(), title: f.title.trim() || undefined, roles: f.roles, socialClients: f.brands.map(Number), sendEmail: f.sendEmail });
      setDone(r); onInvited(r.user);
    } catch (ex) {
      const x = apiErr(ex);
      setErrs({ [x.field === "email" ? "email" : x.field === "roles" || x.field === "role" ? "roles" : "form"]: x.message });
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <Drawer title="Invite ready" sub={<>{done.user.name} · {done.user.email}</>} onClose={onClose}>
        <Note kind="ok" title={`${done.user.name} is invited.`}>They set their own password with this link, then sign in.</Note>
        <ShareLinkBox link={done.link} expiresAt={done.expiresAt} emailed={done.emailed} email={done.user.email} name={done.user.name} kind="invite" />
        <div className="adm-drawer-actions">
          <button type="button" className="adm-btn primary" onClick={onClose}>Done</button>
          <button type="button" className="adm-btn ghost" onClick={() => { setDone(null); setF(blank); }}>Invite another</button>
        </div>
      </Drawer>
    );
  }

  return (
    <Drawer title="Invite member" sub="They get a link to set their own password. No need to share passwords." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {errs.form && <Note kind="err">{errs.form}</Note>}
        <div className="acc-two">
          <div className="adm-field">
            <label htmlFor="iv-name">Full name</label>
            <input id="iv-name" value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus aria-invalid={!!errs.name || undefined} />
            <FieldError msg={errs.name} />
          </div>
          <div className="adm-field">
            <label htmlFor="iv-email">Email</label>
            <input id="iv-email" type="email" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@finvera.solutions" aria-invalid={!!errs.email || undefined} />
            <FieldError msg={errs.email} />
          </div>
        </div>
        <div className="adm-field">
          <label htmlFor="iv-title">Job title <span className="acc-opt">(optional)</span></label>
          <input id="iv-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Graphic designer" />
        </div>
        <div className="adm-field">
          <label>Roles (what they can open)</label>
          <MultiPick label="Roles" options={ROLES} value={f.roles} onChange={(v) => set("roles", v)} />
          <FieldError msg={errs.roles} />
        </div>
        {!f.roles.includes("admin") && (
          <div className="adm-field">
            <label>Content planner brands</label>
            <p className="acc-hint">Tick every brand they can see. None ticked = no planner access.</p>
            {brands.length ? <MultiPick label="Brands" options={brands.map((b) => ({ value: String(b.id), label: b.name }))} value={f.brands} onChange={(v) => set("brands", v)} />
              : <p className="acc-hint">No brands yet.</p>}
          </div>
        )}
        <div className="adm-field">
          <Toggle checked={f.sendEmail} onChange={(v) => set("sendEmail", v)} label="Email the invite to them" />
          <p className="acc-hint">You&apos;ll also get the link to copy or send on WhatsApp.</p>
        </div>
        <div className="adm-drawer-actions">
          <button className="adm-btn primary" type="submit" disabled={busy}>{busy ? <><span className="spin" /> Inviting…</> : <><Icon i={UserAdd01Icon} size={16} />Send invite</>}</button>
          <button className="adm-btn ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Drawer>
  );
}

/* ── Add with password / Edit ── */
function EditDrawer({ user, self, brands, onClose, onSaved }: {
  user: AdminUser | null; self: boolean; brands: Brand[]; onClose: () => void; onSaved: (u: AdminUser, isNew: boolean) => void;
}) {
  const isNew = !user;
  const [f, setF] = useState({
    name: user?.name || "", email: user?.email || "", title: user?.title || "", avatar: user?.avatar || "",
    roles: user?.roles?.length ? user.roles : ["marketer"], brands: (user?.socialClients || []).map(String),
    password: "", active: user ? user.active : true, mustChangePassword: user ? user.mustChangePassword : true,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: unknown) => { setF((x) => ({ ...x, [k]: v })); setErrs({}); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.name.trim()) er.name = "Enter their name.";
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) er.email = "Enter a valid email address.";
    if (!f.roles.length) er.roles = "Pick at least one role.";
    if ((isNew || f.password) && !passwordOk(f.password)) er.password = "Password must be at least 8 characters and include at least one letter and one number.";
    if (Object.keys(er).length) { setErrs(er); return; }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: f.name.trim(), email: f.email.trim(), title: f.title.trim() || null, avatar: f.avatar || null,
        roles: f.roles, socialClients: f.brands.map(Number),
      };
      if (f.password) body.password = f.password;
      if (!self) body.active = f.active;
      // Only send the flag when it changed — each change is written to the security log.
      if (isNew || f.mustChangePassword !== user!.mustChangePassword) body.mustChangePassword = f.mustChangePassword;
      const saved = isNew ? await api.createUser(body) : await api.updateUser(user!.id, body);
      toast(isNew ? "User added" : "Changes saved", "ok", { description: isNew ? `${saved.name} can sign in with ${saved.email}` : saved.name });
      onSaved(saved, isNew);
    } catch (ex) {
      const x = apiErr(ex);
      const k = x.field === "password" || x.field === "email" || x.field === "name" ? x.field : /email/i.test(x.message) && x.status === 409 ? "email" : x.field === "roles" ? "roles" : "form";
      setErrs({ [k]: x.message });
    } finally { setBusy(false); }
  }

  const status = user ? STATUS[user.status] : null;
  return (
    <Drawer title={isNew ? "Add user with a password" : `Edit ${user!.name}`} onClose={onClose}
      sub={isNew ? "You choose their first password and share it with them. To let them pick their own, use Invite member instead." : <>{user!.email}{status && <> · <span className={"acc-pill " + status.cls}>{status.label}</span></>}</>}>
      <form onSubmit={submit} noValidate>
        {errs.form && <Note kind="err">{errs.form}</Note>}
        <div className="adm-field"><label>Photo</label><PhotoPick value={f.avatar} onChange={(v) => set("avatar", v)} name={f.name} /></div>
        <div className="acc-two">
          <div className="adm-field">
            <label htmlFor="ed-name">Full name</label>
            <input id="ed-name" value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errs.name || undefined} />
            <FieldError msg={errs.name} />
          </div>
          <div className="adm-field">
            <label htmlFor="ed-email">Email</label>
            <input id="ed-email" type="email" inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@finvera.solutions" aria-invalid={!!errs.email || undefined} />
            <FieldError msg={errs.email} />
          </div>
        </div>
        <div className="adm-field">
          <label htmlFor="ed-title">Job title <span className="acc-opt">(optional)</span></label>
          <input id="ed-title" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Head of Design" />
        </div>
        <div className="adm-field">
          <label>Roles (what they can open)</label>
          <MultiPick label="Roles" options={ROLES} value={f.roles} onChange={(v) => set("roles", v)} />
          <FieldError msg={errs.roles} />
        </div>
        {!f.roles.includes("admin") && (
          <div className="adm-field">
            <label>Content planner brands</label>
            <p className="acc-hint">Tick every brand they can see. None ticked = no planner access; admins see all.</p>
            {brands.length ? <MultiPick label="Brands" options={brands.map((b) => ({ value: String(b.id), label: b.name }))} value={f.brands} onChange={(v) => set("brands", v)} />
              : <p className="acc-hint">No brands yet.</p>}
          </div>
        )}
        <div className="adm-field">
          <label htmlFor="ed-pw">{isNew ? "Password" : "New password"} {!isNew && <span className="acc-opt">(leave empty to keep it)</span>}</label>
          <PasswordInput id="ed-pw" value={f.password} onChange={(v) => set("password", v)} placeholder={isNew ? "At least 8 characters" : "Set a new password"} invalid={!!errs.password} describedBy="ed-pw-err" />
          {(isNew || f.password) && <PasswordRules value={f.password} />}
          <FieldError id="ed-pw-err" msg={errs.password} />
          {!isNew && f.password && <p className="acc-hint">They&apos;ll be signed out on their devices{self ? " (except this one)" : ""}.</p>}
        </div>
        <div className="adm-field">
          <Toggle checked={f.mustChangePassword} onChange={(v) => set("mustChangePassword", v)} label="Ask them to choose a new password when they sign in" />
        </div>
        {!self && (
          <div className="adm-field">
            <Toggle checked={f.active} onChange={(v) => set("active", v)} label="Active (account can sign in)" />
          </div>
        )}
        <div className="adm-drawer-actions">
          <button className="adm-btn primary" type="submit" disabled={busy}>{busy ? <><span className="spin" /> Saving…</> : isNew ? "Add user" : "Save"}</button>
          <button className="adm-btn ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Drawer>
  );
}

/* ── A member's devices ── */
function DevicesDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [list, setList] = useState<Session[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const load = useCallback(() => api.userSessions(user.id).then((r) => setList(r.sessions)).catch((e) => { setList([]); toast("Couldn't load devices", "err", { description: apiErr(e).message }); }), [user.id]);
  useEffect(() => { load(); }, [load]);
  async function one(s: Session) {
    setBusy(s.id);
    try { await api.revokeUserSession(user.id, s.id); toast("Signed out", "ok", { description: `${user.name} · ${s.device}` }); await load(); }
    catch (e) { toast("Couldn't sign out", "err", { description: apiErr(e).message }); }
    finally { setBusy(null); }
  }
  async function all() {
    const yes = await dialog.confirm({ title: `Sign ${user.name} out everywhere?`, message: "Every phone and computer they use will need to sign in again.", confirmText: "Sign out everywhere", danger: true });
    if (!yes) return;
    setAllBusy(true);
    try { const r = await api.logoutUserAll(user.id); toast(r.message, "ok"); await load(); }
    catch (e) { toast("Couldn't sign out", "err", { description: apiErr(e).message }); }
    finally { setAllBusy(false); }
  }
  const others = (list || []).filter((s) => !s.current);
  return (
    <Drawer title={`${user.name}'s devices`} sub={`${user.email} · last sign-in ${ago(user.lastLoginAt).toLowerCase()}`} onClose={onClose}>
      {!list ? <div className="ss-loading">Loading devices…</div> : (
        <>
          <SessionList sessions={list} onSignOut={one} busy={busy} emptyText={`${user.name} isn't signed in anywhere.`} />
          {others.length > 1 && (
            <div className="adm-drawer-actions">
              <button type="button" className="adm-btn danger" onClick={all} disabled={allBusy}><Icon i={Logout03Icon} size={16} />{allBusy ? "Signing out…" : "Sign out of all devices"}</button>
            </div>
          )}
        </>
      )}
    </Drawer>
  );
}

/* ── A member's activity ── */
function ActivityDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SecPage | null>(null);
  useEffect(() => {
    let alive = true; setData(null);
    api.userActivity(user.id, { page, limit: 20 }).then((d) => alive && setData(d))
      .catch((e) => { if (alive) { setData({ items: [], total: 0, page: 1, limit: 20, pages: 1, types: [] }); toast("Couldn't load activity", "err", { description: apiErr(e).message }); } });
    return () => { alive = false; };
  }, [page, user.id]);
  return (
    <Drawer title={`${user.name}'s activity`} sub={user.email} onClose={onClose}>
      {!data ? <div className="ss-loading">Loading activity…</div> : (
        <>
          <ActivityList items={data.items} emptyText="No activity yet." />
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </Drawer>
  );
}

/* ── Security log (whole team) ── */
const TYPE_GROUPS: { value: string; label: string }[] = [
  { value: "", label: "All events" },
  { value: "login_failed,lockout,2fa_failed", label: "Failed sign-ins & lockouts" },
  { value: "login_success,new_device", label: "Sign-ins" },
  { value: "password_changed,password_reset,password_set_by_admin,reset_requested,reset_link_created,must_change_password", label: "Passwords & reset links" },
  { value: "invite_sent,invite_accepted,user_created,user_deleted,deactivated,reactivated,role_changed,email_changed", label: "Account changes" },
  { value: "2fa_enabled,2fa_disabled,2fa_failed", label: "Two-step login" },
  { value: "logout,logout_all,session_revoked", label: "Sign-outs" },
];
const localStart = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : "");
const localEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999`).toISOString() : "");

function SecurityLog({ users }: { users: AdminUser[] }) {
  const [userId, setUserId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [qDeb, setQDeb] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SecPage | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { const t = setTimeout(() => setQDeb(q.trim()), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [userId, type, from, to, qDeb]);
  useEffect(() => {
    let alive = true;
    api.securityLog({ page, limit: 25, userId, type, from: localStart(from), to: localEnd(to), q: qDeb })
      .then((d) => { if (alive) { setData(d); setErr(""); } })
      .catch((e) => alive && setErr(apiErr(e).message));
    return () => { alive = false; };
  }, [page, userId, type, from, to, qDeb]);

  const typeOptions = useMemo(() => [
    ...TYPE_GROUPS,
    ...(data?.types || []).map((t) => ({ value: t, label: `Only: ${EVENT_LABEL[t] || t}` })),
  ], [data?.types]);
  const anyFilter = userId || type || from || to || q;
  const failed = (data?.items || []).filter((e) => e.type === "login_failed" || e.type === "lockout").length;

  return (
    <section className="acc-panel acc-log-panel">
      <div className="acc-filters">
        <div className="adm-field">
          <label htmlFor="sl-user">Person</label>
          <Select id="sl-user" value={userId} onChange={setUserId} ariaLabel="Person"
            options={[{ value: "", label: "Everyone" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} />
        </div>
        <div className="adm-field">
          <label htmlFor="sl-type">What happened</label>
          <Select id="sl-type" value={type} onChange={setType} ariaLabel="Event type" options={typeOptions} />
        </div>
        <div className="adm-field">
          <label htmlFor="sl-from">From</label>
          <DatePicker id="sl-from" value={from} onChange={setFrom} placeholder="Any date" />
        </div>
        <div className="adm-field">
          <label htmlFor="sl-to">To</label>
          <DatePicker id="sl-to" value={to} onChange={setTo} placeholder="Any date" />
        </div>
        <div className="adm-field acc-fsearch">
          <label htmlFor="sl-q">Email contains</label>
          <input id="sl-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. gmail.com" inputMode="email" />
        </div>
      </div>
      <div className="acc-panel-h">
        <p className="acc-sub" style={{ margin: 0 }}>
          {data ? `${data.total} event${data.total === 1 ? "" : "s"}` : "Loading…"}
          {failed > 0 && <span className="acc-badfail">· <Icon i={Alert02Icon} size={13} /> {failed} failed on this page</span>}
        </p>
        {anyFilter && <button type="button" className="acc-link" onClick={() => { setUserId(""); setType(""); setFrom(""); setTo(""); setQ(""); }}>Clear filters</button>}
      </div>
      {err && <Note kind="err">{err}</Note>}
      {!data ? <div className="ss-loading">Loading the log…</div> : (
        <>
          <ActivityList items={data.items} showUser emptyText={anyFilter ? "Nothing matches these filters." : "No security events yet."} />
          <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
      <p className="acc-hint" style={{ marginTop: 12 }}><Icon i={Clock01Icon} size={13} /> Times are shown in your timezone. Newest first. {data && data.items[0] ? `Latest: ${fmtWhen(data.items[0].createdAt)}.` : ""}</p>
    </section>
  );
}
