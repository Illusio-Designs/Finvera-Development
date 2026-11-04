"use client";
import { useState } from "react";
export type ImageTag = { username: string; x: number; y: number };
export default function InstagramImageTags({ url, tags: saved, onSave, onClose, saveLabel = "Save image tags" }: { saveLabel?: string; url: string; tags: ImageTag[]; onSave: (tags: ImageTag[]) => Promise<boolean>; onClose: () => void }) {
  const [tags, setTags] = useState(saved);
  const [username, setUsername] = useState("");
  const [x, setX] = useState(50), [y, setY] = useState(50);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  function add(horizontal = x, vertical = y) {
    const name = username.trim().replace(/^@/, "");
    if (!/^[a-zA-Z0-9_.]{1,30}$/.test(name) || name.startsWith(".") || name.endsWith(".") || name.includes("..")) { setError("Enter the exact Instagram username first."); return; }
    if (!Number.isFinite(horizontal) || !Number.isFinite(vertical) || horizontal < 0 || horizontal > 100 || vertical < 0 || vertical > 100) { setError("Positions must be between 0 and 100 percent."); return; }
    if (tags.length >= 20 && !tags.some((tag) => tag.username.toLowerCase() === name.toLowerCase())) { setError("Finvera allows up to 20 tags per image."); return; }
    setTags((old) => [...old.filter((tag) => tag.username.toLowerCase() !== name.toLowerCase()), { username: name, x: horizontal / 100, y: vertical / 100 }]);
    setUsername(""); setError("");
  }
  return <section className="sw-tag-editor" aria-label="Instagram image tags">
    <div className="sw-upload-heading"><h3>Tag Instagram profiles</h3><button type="button" className="cal-btn sm" disabled={busy} onClick={onClose}>Cancel</button></div>
    <p>Enter a username, then click its position on the image. You can also set the percentages below.</p>
    <div className="sw-tag-canvas"><img src={url} alt="Artwork to position Instagram tags" onClick={(event) => { if (busy) return; const box = event.currentTarget.getBoundingClientRect(); add(100 * (event.clientX - box.left) / box.width, 100 * (event.clientY - box.top) / box.height); }} />{tags.map((tag) => <span className="sw-tag-marker" key={tag.username} style={{ left: `${tag.x * 100}%`, top: `${tag.y * 100}%` }}>@{tag.username}</span>)}</div>
    <div className="sw-tag-fields"><label>Username<input aria-label="Instagram tag username" value={username} disabled={busy} placeholder="@username" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} onChange={(event) => setUsername(event.target.value)} /></label><label>X %<input aria-label="Horizontal tag position" type="number" min={0} max={100} value={x} disabled={busy} onChange={(event) => setX(Number(event.target.value))} /></label><label>Y %<input aria-label="Vertical tag position" type="number" min={0} max={100} value={y} disabled={busy} onChange={(event) => setY(Number(event.target.value))} /></label><button type="button" className="cal-btn" disabled={busy} onClick={() => add()}>Add tag</button></div>
    <ul className="sw-tag-list">{tags.map((tag) => <li key={tag.username}><span>@{tag.username} · {Math.round(tag.x * 100)}%, {Math.round(tag.y * 100)}%</span><button type="button" disabled={busy} aria-label={`Remove tag ${tag.username}`} onClick={() => setTags((old) => old.filter((item) => item.username !== tag.username))}>Remove</button></li>)}</ul>
    {error && <p className="sw-upload-error" role="alert">{error}</p>}
    <p className="sw-tag-help">For Instagram images and carousel images. Entered accounts are not looked up or verified here; Meta may reject an ineligible account. Caption mentions and Facebook tagging are separate.</p>
    <button type="button" className="cal-primary" disabled={busy} onClick={async () => { setBusy(true); try { if (await onSave(tags)) onClose(); } finally { setBusy(false); } }}>{busy ? "Saving…" : saveLabel}</button>
  </section>;
}
