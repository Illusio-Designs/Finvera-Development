"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { api } from "@/lib/adminApi";
import { userRoles } from "@/lib/permissions";
import ChannelAvatar from "@/components/admin/ChannelAvatar";
import Select from "@/components/Select";
import { dialog } from "@/lib/dialog";
import "./social-profile-editor.css";

type Platform = "facebook" | "instagram";
type Profile = Record<string, any>;
type Account = { client: string; pageId?: string; igUserId?: string; igUsername?: string; status: string };
const fields = ["about", "description", "website", "phone", "email"] as const;
const draft = (p: Profile) => Object.fromEntries(fields.map(k => [k, p[k] || ""])) as Record<string, string>;

type Props = { initialClient?: string; initialPlatform?: Platform; onClose?: () => void };
export default function SocialProfileEditor({ initialClient, initialPlatform, onClose }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([]), [admin, setAdmin] = useState(false);
  const [client, setClient] = useState(""), [platform, setPlatform] = useState<Platform>("facebook");
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [profile, setProfile] = useState<Profile | null>(null), [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [photoBusy, setPhotoBusy] = useState(false);
  const [access, setAccess] = useState<string>("unknown");
  const generation = useRef(0);
  const dirty = !!profile && fields.some(k => form[k] !== (profile[k] || ""));
  const studio = `/dashboard/social-studio?tab=channels&brand=${encodeURIComponent(client)}`;
  useEffect(() => {
    let active = true;
    Promise.all([api.socialAccounts(), api.me()]).then(([rows, me]) => {
      if (!active) return;
      const list: Account[] = Array.isArray(rows) ? rows : rows.accounts || [];
      setAccounts(list); setAdmin(userRoles(me?.user ?? me).includes("admin"));
      const query = new URLSearchParams(window.location.search);
      setPlatform(initialPlatform || (query.get("platform") === "instagram" ? "instagram" : "facebook"));
      setClient(list.find(a => a.client === (initialClient || query.get("brand")))?.client || list[0]?.client || "");
      if (!list.length) setStatus("ready");
    }).catch(e => { if (active) { setError(e.message); setStatus("error"); } });
    return () => { active = false; };
  }, [initialClient, initialPlatform]);
  useEffect(() => {
    if (!client) return;
    const id = ++generation.current;
    setStatus("loading"); setProfile(null); setError(""); setNotice(""); setAccess("unknown"); setPhotoBusy(false);
    if (!onClose) window.history.replaceState(null, "", `?brand=${encodeURIComponent(client)}&platform=${platform}`);
    api.channelProfile(client, platform).then(p => {
      if (generation.current !== id) return;
      setProfile(p); setForm(draft(p)); setStatus("ready");
    }).catch(e => { if (generation.current === id) { setError(e.message); setStatus("error"); } });
    api.channelCapabilities(client, platform).then(r => {
      if (generation.current === id) setAccess(r.actions?.find((a: any) => a.id === "edit")?.state || "unknown");
    }).catch(() => {});
    return () => { generation.current++; };
  }, [client, platform]);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", guard); return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const busy = status === "saving";
  async function discardChanges() {
    return !dirty || await dialog.confirm({ title: "Discard profile changes?", message: "Your unsaved changes will be lost.", confirmText: "Discard changes", danger: true });
  }
  async function switchTo(brand: string, channel: Platform) {
    if (busy || (brand === client && channel === platform) || !await discardChanges()) return;
    setClient(brand); setPlatform(channel);
  }
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
    if (!admin || platform !== "facebook" || busy || !dirty) return;
    const id = generation.current;
    setStatus("saving"); setError(""); setNotice("");
    try {
      const p = await api.updatePageProfile(client, form);
      if (id !== generation.current) return;
      setProfile(p); setForm(draft(p)); setStatus("ready"); setNotice("Page details saved to Facebook.");
    } catch (e: any) { if (id === generation.current) { setError(e.message); setStatus("ready"); } }
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
  const content = <div className="social-profiles">
    <header className="sp-header">
      <div><small>SOCIAL MEDIA</small><h1>Social profiles</h1><p>Update connected profiles without leaving your workspace.</p></div>
      {onClose ? <button className="adm-btn ghost" type="button" disabled={busy} onClick={close} aria-label="Close profile editor">Close</button> : <Link className="adm-btn ghost" href={studio}>Manage connections</Link>}
    </header>
    <div className="sp-controls">
      <div className="adm-field sp-brand"><label htmlFor="profile-brand">Brand</label><Select id="profile-brand" ariaLabel="Brand" value={client} disabled={busy} onChange={brand => switchTo(brand, platform)} options={accounts.map(a => a.client)} /></div>
      <div role="group" aria-label="Platform" className="sp-platforms">{(["facebook", "instagram"] as const).map(p => <button className={"adm-btn " + (platform === p ? "primary" : "ghost")} key={p} aria-pressed={platform === p} disabled={busy} onClick={() => switchTo(client, p)}>{p === "facebook" ? "Facebook" : "Instagram"}</button>)}</div>
    </div>
    {error && <p className="sp-error" role="alert">{error}</p>}{notice && <p className="sp-success" role="status">{notice}</p>}
    {status === "loading" && <p role="status">Loading profile…</p>}
    {!accounts.length && status === "ready" && <section><h2>No connected profiles</h2><p>Connect a Facebook Page and its Instagram account to manage their details.</p><Link href={studio}>Open channel connections</Link></section>}
    {status === "error" && <p>Could not load this profile. {client && <Link href={studio}>Check this brand’s connection</Link>}</p>}
    {profile && <div className="sp-grid">
      <section className="sp-identity"><ChannelAvatar picture={profile.picture} label={profile.name || client} className="sp-avatar"/><div><h2>{profile.name || profile.username || client}</h2><p>{platform === "instagram" ? `@${profile.username || ""}` : profile.category || "Facebook Page"}</p><p>{profile.followers == null ? "Follower count unavailable" : `${Number(profile.followers).toLocaleString()} followers`}</p></div><button className="adm-btn ghost" type="button" onClick={refreshPhoto} disabled={photoBusy || busy}>{photoBusy ? "Refreshing…" : "Refresh photo"}</button><p className="sp-note">Photo refresh reads the current platform picture. Photo and name updates are unavailable in this editor.</p></section>
      <section><h2>{platform === "facebook" ? "Page details" : "Instagram details"}</h2>
        {platform === "instagram" ? <><div className="adm-field"><label htmlFor="profile-bio">Bio</label><textarea id="profile-bio" rows={4} value={profile.biography || ""} readOnly /></div><div className="adm-field"><label htmlFor="profile-website">Website</label><input id="profile-website" value={profile.website || ""} readOnly /></div><p className="sp-note">Instagram profile editing is unavailable through the connected Meta API. These details are read-only; publishing and scheduling posts remain available in Finvera.</p></> : <form onSubmit={e => { e.preventDefault(); void save(); }}>
          {!admin && <p className="sp-note">An administrator can update these Page details.</p>}
          {admin && access !== "permission_granted" && <p className="sp-note">Meta has not confirmed Page editing access. A save may require permission approval and reconnecting this brand.</p>}
          {fields.map(k => <div className="adm-field" key={k}><label htmlFor={`profile-${k}`}>{k.charAt(0).toUpperCase() + k.slice(1)}</label>{k === "description" ? <textarea id={`profile-${k}`} rows={4} maxLength={5000} value={form[k] || ""} disabled={!admin || busy} onChange={e => setForm({ ...form, [k]: e.target.value })}/> : <input id={`profile-${k}`} type={k === "email" ? "email" : k === "website" ? "url" : "text"} maxLength={255} value={form[k] || ""} disabled={!admin || busy} onChange={e => setForm({ ...form, [k]: e.target.value })}/>}</div>)}
          <div className="adm-drawer-actions">
            {onClose && <button className="adm-btn ghost" type="button" disabled={busy} onClick={close}>Cancel</button>}
            {admin && <button className="adm-btn primary" type="submit" disabled={!dirty || busy}>{busy ? "Saving…" : "Save changes"}</button>}
          </div>
        </form>}
      </section>
    </div>}
  </div>;
  return onClose && typeof document !== "undefined" ? createPortal(<div className="adm-overlay" onMouseDown={event => { if (event.target === event.currentTarget) void close(); }}><div className="adm-drawer sp-drawer" role="dialog" aria-modal="true" aria-label="Edit social profile" tabIndex={-1} ref={drawer}>{content}</div></div>, document.body) : <main>{content}</main>;
}
