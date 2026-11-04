"use client";

import { useRef, useState } from "react";
import InstagramImageTags, { type ImageTag } from "./InstagramImageTags";

type Artwork = { url: string; type: "image" | "video"; name?: string; thumbUrl?: string | null; userTags?: ImageTag[] };
type Props = {
  media: Artwork[];
  busy: boolean;
  disabled: boolean;
  editable: boolean;
  posted: boolean;
  error?: string;
  staged?: boolean;
  onFiles: (files: File[]) => Promise<void>;
  onRemove: (index: number) => void;
  onTags: (index: number, tags: ImageTag[]) => Promise<boolean>;
};

export default function SocialUploadWork({ media, busy, disabled, editable, posted, error, staged = false, onFiles, onRemove, onTags }: Props) {
  const [tagging, setTagging] = useState<string | null>(null);
  const tagIndex = media.findIndex((item) => item.url === tagging);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const remaining = Math.max(0, 10 - media.length);
  const canUpload = editable && !posted && !disabled && !busy && remaining > 0;

  async function select(files: File[]) {
    setDragging(false); depth.current = 0;
    if (!canUpload || !files.length) return;
    if (files.length > remaining) { setLocalError(`You have room for ${remaining} more file${remaining === 1 ? "" : "s"}. Choose fewer files or remove an existing one.`); return; }
    const unsupported = files.find((file) => !/\.(jpe?g|png|webp|mp4|mov|m4v)$/i.test(file.name));
    if (unsupported) { setLocalError(`${unsupported.name} isn’t supported. Choose JPG, PNG, WebP, MP4 or MOV.`); return; }
    setLocalError(""); setPending(files);
    try { await onFiles(files); } finally { setPending([]); }
  }

  return (
    <section className="sw-upload" aria-label="Final artwork" aria-busy={busy}>
      <div className="sw-upload-heading"><div><span className="sw-upload-kicker">THE CREATIVE HANDOFF</span><h3>Give your idea its final look.</h3></div><span className="sw-upload-count">{media.length}<span> / 10 files</span></span></div>
      <p className="sw-upload-intro">Add the artwork your reviewer will check.</p>

      {editable && !posted && <div className={"sw-drop" + (dragging ? " is-dragging" : "") + (busy ? " is-busy" : "") + (!canUpload ? " is-disabled" : "")}
        onDragEnter={(e) => { e.preventDefault(); if (canUpload && e.dataTransfer.types.includes("Files")) { depth.current++; setDragging(true); } }}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = canUpload ? "copy" : "none"; }}
        onDragLeave={(e) => { e.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }}
        onDrop={(e) => { e.preventDefault(); select(Array.from(e.dataTransfer.files)); }}>
        <span className="sw-upload-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m-4 4 4-4 4 4M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg></span>
        <strong>{busy ? "Giving your files a home…" : !remaining ? "Your artwork collection is full" : dragging ? "Drop it here ✦" : "Drop your next masterpiece"}</strong>
        <span className="sw-drop-hint">{busy ? "Uploading and saving to this post" : !remaining ? "Remove a file to make room for another." : "Drag images or videos here, or choose them below."}</span>
        <input ref={input} type="file" multiple hidden aria-label="Choose final artwork" disabled={!canUpload} accept=".jpg,.jpeg,.png,.webp,.mp4,.mov,.m4v" onChange={(e) => { select(Array.from(e.target.files || [])); e.target.value = ""; }} />
        <button type="button" className="sw-upload-button" disabled={!canUpload} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload"}</button>
        <small>JPG, PNG, WebP · MP4, MOV · up to 10 files</small>
        {busy && <div className="sw-upload-progress" role="status"><i /><span className="sw-sr-only">Uploading {pending.length || "selected"} files. Please wait.</span></div>}
      </div>}

      {(localError || error) && <p className="sw-upload-error" role="alert">{localError || error}</p>}
      {busy && pending.length > 0 && <ul className="sw-upload-pending">{pending.map((file, i) => <li key={file.name + i}><span className="sw-pending-dot" />{file.name}<small>Uploading</small></li>)}</ul>}

      {media.length > 0 && <div className="sw-artwork-grid">{media.map((file, index) => {
        const video = file.type === "video" || /\.(mp4|mov|m4v)(\?|$)/i.test(file.url);
        return <article className="sw-artwork" key={file.url + index}>
          <a className="sw-artwork-preview" href={file.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${file.name || `artwork ${index + 1}`}`} draggable={false}>
            {video ? <video src={file.url} muted playsInline preload="metadata" /> : <img src={file.thumbUrl || file.url} alt={file.name || `Artwork ${index + 1}`} draggable={false} />}
            <span className="sw-artwork-number">{String(index + 1).padStart(2, "0")}</span><span className="sw-artwork-type">{video ? "▶ Video" : "Image"}</span>
          </a>
          <div className="sw-artwork-info"><div><strong title={file.name}>{file.name || `Artwork ${index + 1}`}</strong><small>{staged ? "Ready to save with this post" : "✓ Saved to this post"}</small></div>{editable && !posted && !video && <button type="button" disabled={disabled || busy} onClick={() => setTagging(file.url)}>Tag profiles{file.userTags?.length ? ` (${file.userTags.length})` : ""}</button>}{editable && !posted && <button type="button" disabled={disabled || busy} aria-label={`Remove ${file.name || `artwork ${index + 1}`}`} onClick={() => { setLocalError(""); onRemove(index); }}>Remove</button>}</div>
        </article>;
      })}</div>}
      {tagIndex >= 0 && <InstagramImageTags saveLabel={staged ? "Apply image tags" : "Save image tags"} key={tagging} url={media[tagIndex].url} tags={media[tagIndex].userTags || []} onSave={(tags) => onTags(tagIndex, tags)} onClose={() => setTagging(null)} />}
      <div className="sw-upload-footer"><span aria-hidden="true">✦</span><p>{posted ? "Live now. Your artwork stays with this post’s history." : staged ? "Save this post to apply artwork and tag changes." : media.length ? "Looking good. Send your saved artwork for review when it’s ready." : "One good handoff at a time. Upload here, then send for review."}<small>Uploading does not publish your post.</small></p></div>
    </section>
  );
}
