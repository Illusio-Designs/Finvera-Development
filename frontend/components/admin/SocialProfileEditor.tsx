"use client";
import { WorkspaceHero } from "@/components/admin/Workspace";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { api } from "@/lib/adminApi";
import { userRoles } from "@/lib/permissions";
import ChannelAvatar from "@/components/admin/ChannelAvatar";
import { LoadingRegion, Shimmer } from "@/components/admin/PageLoading";
import Select from "@/components/Select";
import { dialog } from "@/lib/dialog";
import "./social-profile-editor.css";

type Platform = "facebook" | "instagram";
type Profile = Record<string, any>;
type Account = { client: string; pageId?: string; igUserId?: string; igUsername?: string; status: string };
const fields = ["about", "description", "website", "phone", "email"] as const;
const draft = (p: Profile) => Object.fromEntries(fields.map(k => [k, p[k] || ""])) as Record<string, string>;

type Props = {
  initialClient?: string;
  initialPlatform?: Platform;
  onClose?: () => void;
  workspace?: {
    brand: string;
    platform: Platform;
    navigationGuard: MutableRefObject<(() => Promise<boolean>) | null>;
    onPlatformChange: (platform: Platform) => void;
    onConnections: () => void;
  };
};
export default function SocialProfileEditor({ initialClient, initialPlatform, onClose, workspace }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]), [roles, setRoles] = useState<string[]>([]);
  const admin = roles.includes("admin");
  const canEditProfile = admin || roles.includes("social");
  const [selectedClient, setClient] = useState(""), [selectedPlatform, setPlatform] = useState<Platform>("facebook");
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const client = workspace ? accounts.find(account => account.client === workspace.brand)?.client || "" : selectedClient;
  const platform = workspace?.platform ?? selectedPlatform;
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [profile, setProfile] = useState<Profile | null>(null), [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [photoBusy, setPhotoBusy] = useState(false);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const leavingForMeta = useRef(false);
  const [missingPagePermission, setMissingPagePermission] = useState(false);
  const generation = useRef(0);
  const dirty = platform === "facebook" && !!profile && fields.some(k => form[k] !== (profile[k] || ""));
  const studio = `/dashboard/social-studio?tab=channels&brand=${encodeURIComponent(client)}`;
  useEffect(() => {
    let active = true;
    Promise.all([api.socialAccounts(), api.me()]).then(([rows, me]) => {
      if (!active) return;
      const list: Account[] = Array.isArray(rows) ? rows : rows.accounts || [];
      setAccounts(list); setAccountsLoaded(true); setRoles(userRoles(me?.user ?? me));
      const query = new URLSearchParams(window.location.search);
      setPlatform(initialPlatform || (query.get("platform") === "instagram" ? "instagram" : "facebook"));
      setClient(list.find(a => a.client === (initialClient || query.get("brand")))?.client || list[0]?.client || "");
      if (!list.length) setStatus("ready");
    }).catch(e => { if (active) { setError(e.message); setStatus("error"); } });
    return () => { active = false; };
  }, [initialClient, initialPlatform]);
  useEffect(() => {
    if (!client) {
      setProfile(null);
      setNotice("");
      if (accountsLoaded) { setStatus("ready"); setError(""); }
      return;
    }
    const id = ++generation.current;
    setStatus("loading"); setProfile(null); setError(""); setNotice(""); setMissingPagePermission(false); setPhotoBusy(false); setDetailsBusy(false);
    if (!onClose && !workspace) window.history.replaceState(null, "", `?brand=${encodeURIComponent(client)}&platform=${platform}`);
    api.channelProfile(client, platform).then(p => {
      if (generation.current !== id) return;
      setProfile(p); setForm(draft(p)); setStatus("ready");
    }).catch(e => { if (generation.current === id) { setError(e.message); setStatus("error"); } });
    if (canEditProfile && platform === "facebook") {
      api.channelCapabilities(client, platform).then(r => {
        if (generation.current !== id) return;
        setMissingPagePermission(r.actions?.some((action: { id: string; state: string }) =>
          action.id === "edit" && action.state === "missing_permission") ?? false);
      }).catch(() => { /* Saving reports any Meta access errors directly. */ });
    }
    return () => { generation.current++; };
  }, [client, platform, accountsLoaded, canEditProfile]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty && !leavingForMeta.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const busy = status === "saving" || reconnecting;
  async function discardChanges() {
    return !dirty || await dialog.confirm({ title: "Discard profile changes?", message: "Your unsaved changes will be lost.", confirmText: "Discard changes", danger: true });
  }
  async function switchTo(brand: string, channel: Platform) {
    if (busy || (brand === client && channel === platform) || !await discardChanges()) return;
    if (workspace) workspace.onPlatformChange(channel);
    else { setClient(brand); setPlatform(channel); }
  }
  const navigationGuard = workspace?.navigationGuard;
  useEffect(() => {
    if (!navigationGuard) return;
    const canLeave = () => busy ? Promise.resolve(false) : discardChanges();
    navigationGuard.current = canLeave;
    return () => { if (navigationGuard.current === canLeave) navigationGuard.current = null; };
  }, [navigationGuard, busy, dirty]);
  async function close() {
    if (!busy && await discardChanges()) onClose?.();
  }
  const embedded = Boolean(onClose);
  const drawer = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!onClose) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawer.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (document.querySelector(".adm-confirm")) return;
      if (event.key === "Escape") { event.preventDefault(); void closeRef.current(); }
      if (event.key === "Tab") {
        const items = Array.from(drawer.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === drawer.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === drawer.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [embedded]);
  async function save() {
    if (!canEditProfile || platform !== "facebook" || busy || !dirty) return;
    const id = generation.current;
    setStatus("saving"); setError(""); setNotice("");
    try {
      const p = await api.updatePageProfile(client, form);
      if (id !== generation.current) return;
      setProfile(p); setForm(draft(p)); setStatus("ready"); setNotice("Page details saved to Facebook.");
    } catch (error) {
      if (id !== generation.current) return;
      const message = error instanceof Error ? error.message : "Could not save Page details.";
      setError(message.replace("Readiness & actions", "Studio → Channels → Connection checks"));
      setStatus("ready");
    }
  }
  async function reconnect() {
    if (!admin || !client || busy || !await discardChanges()) return;
    setReconnecting(true);
    setError("");
    try {
      const { authUrl } = await api.metaStart(client);
      leavingForMeta.current = true;
      window.location.assign(authUrl);
    } catch (error) {
      leavingForMeta.current = false;
      setError(error instanceof Error ? error.message : "Could not start the Meta connection.");
      setReconnecting(false);
    }
  }
  async function refreshPhoto() {
    const id = generation.current;
    setPhotoBusy(true); setError(""); setNotice("");
    try {
      const result = await api.channelPicture(client, platform);
      if (id === generation.current) { setProfile(p => p ? { ...p, picture: result.picture } : p); setNotice("Profile photo refreshed."); }
    } catch (e: any) { if (id === generation.current) setError(e.message); }
    finally { if (id === generation.current) setPhotoBusy(false); }
  }
  async function refreshInstagramDetails() {
    const id = generation.current;
    setDetailsBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.channelProfile(client, "instagram");
      if (id !== generation.current) return;
      setProfile(result);
      setNotice("Instagram details refreshed.");
    } catch (error) {
      if (id === generation.current) {
        setError(error instanceof Error ? error.message : "Could not refresh Instagram details.");
      }
    } finally {
      if (id === generation.current) setDetailsBusy(false);
    }
  }
  const content = <div className={workspace ? "social-profiles sp-inline" : "social-profiles"}>
    {!workspace && <WorkspaceHero eyebrow="SOCIAL MEDIA" title="Social profiles" description="Update connected profiles without leaving your workspace." headingLevel={onClose ? 2 : 1} compact={Boolean(onClose)} actions={<> {onClose ? <button className="adm-btn ghost" type="button" disabled={busy} onClick={close} aria-label="Close profile editor">Close</button> : <Link className="adm-btn ghost" href={studio}>Manage connections</Link>} </>} />
    }
    {workspace && <div><h2>Connected profiles</h2></div>}
    <div className="sp-controls">
      {!workspace && <div className="adm-field sp-brand"><label htmlFor="profile-brand">Brand</label><Select id="profile-brand" ariaLabel="Brand" value={client} disabled={busy} onChange={brand => switchTo(brand, platform)} options={accounts.map(a => a.client)} /></div>}
      <div role="group" aria-label="Platform" className="sp-platforms">{(["facebook", "instagram"] as const).map(p => <button className={"adm-btn " + (platform === p ? "primary" : "ghost")} key={p} aria-pressed={platform === p} disabled={busy || !client} onClick={() => switchTo(client, p)}>{p === "facebook" ? "Facebook" : "Instagram"}</button>)}</div>
      {admin && client && <button type="button" className="adm-btn ghost" disabled={busy}
        onClick={reconnect}>{reconnecting ? "Opening Meta…" : "Reconnect Meta"}</button>}
    </div>
    {error && <p className="sp-error" role="alert">{error}</p>}{notice && <p className="sp-success" role="status">{notice}</p>}
    {status === "loading" && <LoadingRegion label="Loading profile…"><div className="sp-grid">
      <section className="sp-identity sp-loading-identity">
        <Shimmer width={80} height={80} className="sp-loading-avatar" />
        <div className="sp-loading-lines"><Shimmer width="82%" height={22} /><Shimmer width="60%" height={14} /><Shimmer width="68%" height={14} /></div>
        <Shimmer width={123} height={40} /><div className="sp-loading-note"><Shimmer width="100%" height={14} /><Shimmer width="72%" height={14} /></div>
      </section>
      {platform === "instagram" ? <section className="sp-instagram-details">
        <div className="sp-instagram-header"><Shimmer width={175} height={24} /><Shimmer width={76} height={24} /></div>
        <div className="sp-instagram-values">
          <div><Shimmer width={32} height={16} /><Shimmer width="65%" height={20} /></div>
          <div><Shimmer width={60} height={16} /><Shimmer width="45%" height={20} /></div>
        </div>
        <Shimmer width="85%" height={20} />
        <div className="sp-instagram-actions"><Shimmer width={132} height={42} /></div>
      </section> : <section className="sp-loading-details">
        <Shimmer width="38%" height={22} />
        <Shimmer width="87%" height={16} />
        {fields.map(field => <div className="adm-field" key={field}>
          <Shimmer width={80} height={15} /><Shimmer height={field === "description" ? 100 : "var(--ui-field-height, 42px)"} />
        </div>)}
        <Shimmer width={130} height={40} />
      </section>}
    </div></LoadingRegion>}
    {!client && status === "ready" && <section><h2>No connected profiles</h2><p>Connect a Facebook Page and its Instagram account to manage their details.</p>
      {workspace ? <button type="button" className="adm-btn ghost" onClick={workspace.onConnections}>Open channel connections</button> : <Link href={studio}>Open channel connections</Link>}</section>}
    {status === "error" && <p>Could not load this profile. {client && (workspace ? <button type="button" className="adm-btn ghost" onClick={workspace.onConnections}>Check this brand’s connection</button> : <Link href={studio}>Check this brand’s connection</Link>)}</p>}
    {profile && <div className="sp-grid">
      <section className="sp-identity"><ChannelAvatar picture={profile.picture} label={profile.name || client} className="sp-avatar"/><div><h2>{profile.name || profile.username || client}</h2><p>{platform === "instagram" ? (profile.username ? `@${profile.username}` : "Instagram Business") : profile.category || "Facebook Page"}</p><p>{profile.followers == null ? "Follower count unavailable" : `${Number(profile.followers).toLocaleString()} followers`}</p></div><button className="adm-btn ghost" type="button" onClick={refreshPhoto} disabled={photoBusy || detailsBusy || busy}>{photoBusy ? "Refreshing…" : "Refresh photo"}</button><p className="sp-note">Photo refresh reads the current platform picture. Photo and name updates are unavailable in this editor.</p></section>
      {platform === "instagram" ? <section className="sp-instagram-details">
        <div className="sp-instagram-header"><h2>Instagram details</h2><span>Read-only</span></div>
        <dl className="sp-instagram-values">
          <div><dt>Bio</dt><dd>{profile.biography?.trim() || "No bio returned by Instagram"}</dd></div>
          <div><dt>Website</dt><dd>{profile.website?.trim() || "No website returned by Instagram"}</dd></div>
        </dl>
        <p className="sp-note">Meta’s API provides read-only access to these Instagram profile details.</p>
        <div className="sp-instagram-actions">
          <button className="adm-btn ghost" type="button" onClick={refreshInstagramDetails} disabled={detailsBusy || photoBusy || busy}>{detailsBusy ? "Refreshing details…" : "Refresh details"}</button>
        </div>
      </section> : <section><h2>Page details</h2>
        <form onSubmit={e => { e.preventDefault(); void save(); }}>
          {!canEditProfile && <p className="sp-note">Administrators and social media managers can update these Page details.</p>}
          {canEditProfile && missingPagePermission && <p className="sp-note">{admin
            ? "This connection is missing permission to edit Page details. Approve the permission in Meta, then reconnect this brand."
            : "This connection is missing permission to edit Page details. Ask an administrator to check the Meta permissions and reconnect this brand."}</p>}
          {fields.map(k => <div className="adm-field" key={k}><label htmlFor={`profile-${k}`}>{k.charAt(0).toUpperCase() + k.slice(1)}</label>{k === "description" ? <textarea id={`profile-${k}`} rows={4} maxLength={5000} value={form[k] || ""} disabled={!canEditProfile || busy} onChange={e => setForm({ ...form, [k]: e.target.value })}/> : <input id={`profile-${k}`} type={k === "email" ? "email" : k === "website" ? "url" : "text"} maxLength={255} value={form[k] || ""} disabled={!canEditProfile || busy} onChange={e => setForm({ ...form, [k]: e.target.value })}/>}</div>)}
          <div className="adm-drawer-actions">
            {onClose && <button className="adm-btn ghost" type="button" disabled={busy} onClick={close}>Cancel</button>}
            {canEditProfile && <button className="adm-btn primary" type="submit" disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</button>}
          </div>
        </form>
      </section>}
    </div>}
  </div>;
  return onClose && typeof document !== "undefined" ? createPortal(<div className="adm-overlay" onMouseDown={event => { if (event.target === event.currentTarget) void close(); }}><div className="adm-drawer sp-drawer" role="dialog" aria-modal="true" aria-label="Edit social profile" tabIndex={-1} ref={drawer}>{content}</div></div>, document.body) : <main>{content}</main>;
}
