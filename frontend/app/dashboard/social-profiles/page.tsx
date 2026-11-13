"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { userRoles } from "@/lib/permissions";
import ChannelAvatar from "@/components/admin/ChannelAvatar";
import "./profiles.css";

type Platform = "facebook" | "instagram";
type Profile = Record<string, any>;
type Account = { client: string; pageId?: string; igUserId?: string; igUsername?: string; status: string };
const fields = ["about", "description", "website", "phone", "email"] as const;
const draft = (p: Profile) => Object.fromEntries(fields.map(k => [k, p[k] || ""])) as Record<string, string>;
const safeLink = (url?: string) => url && /^https?:\/\//i.test(url) ? url : undefined;

export default function SocialProfiles() {
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
      setPlatform(query.get("platform") === "instagram" ? "instagram" : "facebook");
      setClient(list.find(a => a.client === query.get("brand"))?.client || list[0]?.client || "");
      if (!list.length) setStatus("ready");
    }).catch(e => { if (active) { setError(e.message); setStatus("error"); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!client) return;
    const id = ++generation.current;
    setStatus("loading"); setProfile(null); setError(""); setNotice(""); setAccess("unknown"); setPhotoBusy(false);
    window.history.replaceState(null, "", `?brand=${encodeURIComponent(client)}&platform=${platform}`);
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
  function switchTo(brand: string, channel: Platform) {
    if (dirty && !window.confirm("Discard unsaved profile changes?")) return;
    setClient(brand); setPlatform(channel);
  }
  async function save() {
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
  const external = platform === "instagram" ? "https://www.instagram.com/accounts/edit/" : safeLink(profile?.link) || (accounts.find(a => a.client === client)?.pageId ? `https://www.facebook.com/${encodeURIComponent(accounts.find(a => a.client === client)!.pageId!)}` : "https://www.facebook.com/");
  return <main className="social-profiles">
    <header><div><small>SOCIAL MEDIA</small><h1>Social profiles</h1><p>Keep your connected brand profiles up to date.</p></div><Link href={studio}>Manage connections ↗</Link></header>
    <div className="sp-controls"><label>Brand<select aria-label="Brand" value={client} disabled={status === "saving"} onChange={e => switchTo(e.target.value, platform)}>{accounts.map(a => <option key={a.client}>{a.client}</option>)}</select></label><div role="group" aria-label="Platform">{(["facebook", "instagram"] as const).map(p => <button key={p} aria-pressed={platform === p} disabled={status === "saving"} onClick={() => switchTo(client, p)}>{p === "facebook" ? "Facebook" : "Instagram"}</button>)}</div></div>
    {error && <p className="sp-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {status === "loading" && <p role="status">Loading profile…</p>}
    {!accounts.length && status !== "loading" && <section><h2>No connected profiles</h2><p>Connect a Facebook Page and its Instagram account to manage their details.</p><Link href={studio}>Open channel connections</Link></section>}
    {status === "error" && client && <Link href={studio}>Check this brand’s connection</Link>}
    {profile && <div className="sp-grid"><section><ChannelAvatar picture={profile.picture} label={profile.name || client} className="sp-avatar"/><h2>{profile.name || profile.username || client}</h2><p>{platform === "instagram" ? `@${profile.username || ""}` : profile.category || "Facebook Page"}</p><p>{profile.followers == null ? "Follower count unavailable" : `${Number(profile.followers).toLocaleString()} followers`}</p><div className="sp-actions"><button onClick={refreshPhoto} disabled={photoBusy || status === "saving"}>{photoBusy ? "Refreshing…" : "Refresh photo"}</button><a href={external} target="_blank" rel="noopener noreferrer">Change name or photo ↗</a></div><p className="sp-note">Change the picture on {platform === "facebook" ? "Facebook" : "Instagram"}, then refresh it here.</p></section>
    <section><h2>{platform === "facebook" ? "Page details" : "Instagram details"}</h2>{platform === "instagram" ? <><p>{profile.biography || "No bio yet."}</p>{safeLink(profile.website) && <a href={safeLink(profile.website)} target="_blank" rel="noopener noreferrer">{profile.website}</a>}<p>Edit your bio, website, name and photo on Instagram.</p><a href={external} target="_blank" rel="noopener noreferrer">Edit on Instagram ↗</a></> : <form onSubmit={e => { e.preventDefault(); save(); }}>
      {!admin && <p className="sp-note">An administrator can update these Page details.</p>}
      {admin && access !== "permission_granted" && <p className="sp-note">Page editing access has not been confirmed. Check permission readiness in <Link href={studio}>Channels</Link> before saving. Meta may require approval and reconnecting this brand.</p>}
      {fields.map(k => <label key={k}>{k.charAt(0).toUpperCase() + k.slice(1)}{k === "description" ? <textarea rows={4} value={form[k] || ""} disabled={!admin || status === "saving"} onChange={e => setForm({ ...form, [k]: e.target.value })}/> : <input type={k === "email" ? "email" : k === "website" ? "url" : "text"} maxLength={k === "about" ? 255 : undefined} value={form[k] || ""} disabled={!admin || status === "saving"} onChange={e => setForm({ ...form, [k]: e.target.value })}/>}</label>)}
      {admin && <button type="submit" disabled={!dirty || status === "saving"}>{status === "saving" ? "Saving…" : "Save to Facebook"}</button>}
    </form>}</section></div>}
  </main>;
}
