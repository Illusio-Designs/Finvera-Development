"use client";
import { useState } from "react";
import { dialog } from "@/lib/dialog";
import InstagramImageTags, { type ImageTag } from "./InstagramImageTags";
type Media = { url: string; type: "image" | "video"; name?: string; userTags?: ImageTag[] };
export default function SocialTagCorrection({ post, onClose, onSave }: {
  post: { theme: string; tags?: string; media?: Media[] };
  onClose: () => void; onSave: (tags: string, media: Media[]) => Promise<boolean>;
}) {
  const [tags, setTags] = useState(post.tags || ""), [media, setMedia] = useState(post.media || []);
  const [selected, setSelected] = useState<number | null>(null), [busy, setBusy] = useState(false);
  async function close() {
    if ((tags !== (post.tags || "") || JSON.stringify(media) !== JSON.stringify(post.media || [])) && !(await dialog.confirm({ title: "Discard tag changes?", message: "These tag corrections have not been saved.", confirmText: "Discard changes", danger: true }))) return;
    onClose();
  }
  return <div className="adm-overlay"><aside className="adm-drawer cal-view" role="dialog" aria-modal="true" aria-label="Correct Instagram tags">
    <div className="cal-vtop"><h2>Correct Instagram tags</h2><button type="button" className="cal-x" disabled={busy} onClick={close} aria-label="Close">×</button></div>
    <p>{post.theme}</p><p className="cal-pubnote">Facebook is live. Only Instagram tags change here. Save, review again, then publish the remaining Instagram post.</p>
    <div className="adm-field"><label>Instagram profiles to tag<input aria-label="Instagram profiles to tag" value={tags} disabled={busy} onChange={(event) => setTags(event.target.value)} /></label><small>Exact @usernames separated by commas. Clear to remove post-wide tags.</small></div>
    {media.map((item, index) => item.type !== "video" && <div className="cal-vsec" key={item.url}><b>Image {index + 1}</b><p>{item.userTags?.map((tag) => `@${tag.username}`).join(", ") || "No image-specific tags"}</p><button type="button" className="cal-btn" disabled={busy} onClick={() => setSelected(index)}>Edit image {index + 1} tags</button></div>)}
    {selected != null && <InstagramImageTags key={selected} url={media[selected].url} tags={media[selected].userTags || []} saveLabel="Apply image tags" onClose={() => setSelected(null)} onSave={async (next) => { setMedia((items) => items.map((item, index) => index === selected ? { ...item, userTags: next } : item)); return true; }} />}
    <div className="adm-drawer-actions"><button type="button" className="cal-primary" disabled={busy || selected != null} onClick={async () => { setBusy(true); try { if (await onSave(tags, media)) onClose(); } finally { setBusy(false); } }}>{busy ? "Saving…" : "Save for review"}</button><button type="button" className="cal-btn" disabled={busy} onClick={close}>Cancel</button></div>
  </aside></div>;
}
