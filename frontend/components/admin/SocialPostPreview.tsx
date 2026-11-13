"use client";
import { useEffect, useState } from "react";
import ChannelAvatar from "./ChannelAvatar";
import { previewCaption, previewKind, previewTargets, type PreviewPost } from "@/lib/socialPostPreview";
import "./social-post-preview.css";
export default function SocialPostPreview({ post, connected = [], instagramName, facebookName, picture }: { post: PreviewPost; connected?: string[]; instagramName?: string | null; facebookName?: string | null; picture?: string | null }) {
  const targets = previewTargets(post, connected);
  const [platform, setPlatform] = useState("instagram"), [selected, setSelected] = useState(0), [expanded, setExpanded] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => { setSelected(0); setExpanded(false); }, [post.id, post.client, post.format]);
  const media = post.media || [], index = Math.min(selected, Math.max(0, media.length - 1)), active = media[index];
  useEffect(() => setFailed(false), [active?.url]);
  const kind = previewKind(post.format), vertical = kind !== "feed", caption = previewCaption(post);
  const name = platform === "instagram" ? instagramName || post.client || "Your brand" : facebookName || post.client || "Your brand";
  const video = active?.type === "video" || /\.(mp4|mov|m4v)(\?|$)/i.test(active?.url || "");
  return <section className="spp-panel" aria-label="Platform post preview">
    <header className="spp-heading"><div><h3>Post preview</h3><p>Approximate layout · Meta may crop media or display text differently.</p></div><div className="spp-tabs" role="group" aria-label="Preview platform">{["instagram", "facebook"].map(p => <button type="button" key={p} className={`adm-btn ${platform === p ? "primary" : "ghost"}`} aria-pressed={platform === p} onClick={() => { setPlatform(p); setExpanded(false); }}>{p === "instagram" ? "Instagram" : "Facebook"}</button>)}</div></header>
    <p className="spp-target">{targets.includes(platform) ? "Selected for publishing" : connected.includes(platform) ? "Preview only — this channel is not selected" : "Preview only — this channel is not connected"}</p>
    <div className={`spp-post ${platform} ${kind}`}>
      {kind === "story" && <div className="spp-progress">{media.map((_, i) => <i key={i} className={i === index ? "active" : ""}/>)}</div>}
      <header className="spp-identity"><ChannelAvatar label={name} picture={picture} className="spp-avatar"/><div><b>{name}</b><small>{platform === "facebook" ? "Scheduled post · Public" : kind === "story" ? "Your story" : kind === "reel" ? "Reel" : "Original post"}</small></div><span aria-hidden="true">•••</span></header>
      {platform === "facebook" && kind === "feed" && caption && <div className="spp-caption">{expanded || caption.length < 220 ? caption : caption.slice(0, 220) + "…"}{caption.length >= 220 && <button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "See more"}</button>}</div>}
      <div className={`spp-art ${vertical ? "vertical" : ""}`}>
        {!active ? <p>Add artwork to preview your {kind === "feed" ? "post" : kind}.</p> : failed ? <p>Artwork could not load. Check the saved media.</p> : video ? <video key={active.url} src={active.url} poster={active.coverUrl || undefined} controls playsInline preload="metadata" onError={() => setFailed(true)} /> : <img src={active.url} alt={active.name || `Artwork ${index + 1}`} onError={() => setFailed(true)} />}
        {media.length > 1 && <span className="spp-count">{index + 1}/{media.length}</span>}
        {kind === "reel" && <span className="spp-reel-label">Reel · {platform === "instagram" ? "Instagram" : "Facebook"}</span>}
      </div>
      {media.length > 1 && <div className="spp-carousel" aria-label="Preview media order">{media.map((_, i) => <button key={i} className="adm-btn ghost" type="button" aria-label={`Preview media ${i + 1}`} aria-pressed={i === index} onClick={() => setSelected(i)}>{i + 1}</button>)}</div>}
      {kind !== "story" && <><div className="spp-actions" aria-hidden="true">{platform === "instagram" ? "♡　♧　↗" : "Like　·　Comment　·　Share"}</div>{(platform === "instagram" || kind === "reel") && <div className="spp-caption"><b>{name} </b>{expanded || caption.length < 150 ? caption || "No caption added." : caption.slice(0, 150) + "…"}{caption.length >= 150 && <button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : "More"}</button>}</div>}</>}
    </div>
    {kind === "story" && <p className="spp-note">Story notes, hashtags, tags and interactive stickers are not added to the published artwork.</p>}
    {kind === "reel" && active?.coverUrl && <details className="spp-cover"><summary>Saved Reel cover</summary><img src={active.coverUrl} alt="Saved Reel cover"/></details>}
    <p className="spp-note">Go-live: {post.postDate || "Date not set"} · {post.postTime || "10:00"} IST. Previewing does not save, schedule or publish.</p>
  </section>;
}
