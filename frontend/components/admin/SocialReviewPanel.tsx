"use client";
import { useEffect, useRef, useState } from "react";

type Post = { id: number; theme: string; client: string; format?: string | null; caption?: string; tags?: string; keywords?: string; requirements?: string; remarks?: string; postDate?: string | null; postTime?: string | null; updatedAt?: string; publishTo?: string[] | null; media?: { url: string; type: string; name?: string; thumbUrl?: string | null; userTags?: { username: string; x: number; y: number }[] }[] };
const CHECKS = ["Artwork and media order", "Caption and hashtags", "People to tag and requirements", "Channels and go-live time"];

export default function SocialReviewPanel({ post, loaded, canReview, reviewer, channels, preflightIssues = [], preflightLoading = false, preflightError, onClose, onApprove, onChanges, onEdit }: {
  post: Post; loaded: boolean; canReview: boolean; reviewer: string; channels: string[];
  preflightIssues?: { field: string; message: string }[]; preflightLoading?: boolean; preflightError?: string;
  onClose: () => void; onApprove: () => Promise<void>; onChanges: (note: string) => Promise<void>; onEdit: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState(0);
  const [checks, setChecks] = useState<boolean[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const media = post.media || [];
  const active = media[Math.min(selected, Math.max(0, media.length - 1))];
  const video = active?.type === "video" || /\.(mp4|mov|m4v)(\?|$)/i.test(active?.url || "");
  const ready = loaded && canReview && CHECKS.every((_, index) => checks[index]) && media.length > 0 && !preflightLoading && !preflightError && !preflightIssues.length && !busy;
  useEffect(() => { setChecks([]); }, [post.id, post.updatedAt]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href]') || []).filter((node) => node.getClientRects().length);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [post.id]);
  async function action(kind: "approve" | "changes") {
    if (kind === "changes" && !note.trim()) { setError("Tell the maker what needs changing."); return; }
    setBusy(true); setError("");
    try { if (kind === "approve") await onApprove(); else await onChanges(note.trim()); }
    finally { setBusy(false); }
  }
  return <aside ref={root} className="adm-drawer sw-review-drawer" role="dialog" aria-modal="true" aria-label={`Review ${post.theme}`}>
    <header className="sw-review-head"><div><span className="sw-upload-kicker">THE REVIEW DESK</span><h2>One last look. Then let it shine.</h2></div><button type="button" className="cal-x" onClick={onClose} aria-label="Close" disabled={busy}>×</button></header>
    <div className="sw-review-title"><div><strong>{post.theme}</strong><p>{post.client} · {post.format || "Social post"}</p></div><span className="sw-upload-count">Pending approval</span></div>
    {!loaded && <p role="status">Loading the saved version…</p>}
    <div className="sw-review-columns"><section className="sw-review-content" aria-label="Saved post preview">
      <div className="sw-review-art">{active ? video ? <video key={active.url} src={active.url} controls playsInline preload="metadata" /> : <img src={active.url} alt={active.name || "Saved post artwork"} /> : <p>No artwork attached.<small>Ask the maker to upload the finished work.</small></p>}</div>
      {media.length > 1 && <div className="sw-review-thumbs">{media.map((item, index) => <button type="button" key={item.url + index} aria-label={`Preview artwork ${index + 1}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>{item.type === "video" ? <span>▶ {index + 1}</span> : <img src={item.thumbUrl || item.url} alt={`Artwork ${index + 1}`} />}</button>)}</div>}
      <div className="sw-review-copy"><span className="sw-upload-kicker">CAPTION & HASHTAGS</span><p>{post.caption || "No caption added."}</p>{post.keywords && <small>Keywords: {post.keywords}</small>}</div>
      <div className="sw-review-copy"><span className="sw-upload-kicker">PEOPLE & REQUIREMENTS</span><p>{post.tags || (media.some((item) => item.userTags?.length) ? "Image-specific profiles are listed below." : "No Instagram profiles tagged.")}</p><small>These profiles are tagged on Instagram images at the center unless a position is saved on the artwork. Image tags are not sent to Facebook.</small>{media.some((item) => item.userTags?.length) && <ul>{media.map((item, index) => item.userTags?.length ? <li key={index}>Image {index + 1}: {item.userTags.map((tag) => `@${tag.username} (${Math.round(tag.x * 100)}%, ${Math.round(tag.y * 100)}%)`).join(", ")}</li> : null)}</ul>}{post.requirements && <p>{post.requirements}</p>}{post.remarks && <p>Team notes: {post.remarks}</p>}</div>
      <button type="button" className="cal-btn" disabled={busy || !loaded} onClick={onEdit}>Edit saved content</button>
    </section><section className="sw-review-checklist" aria-label="Review checklist">
      <span className="sw-upload-kicker">CHECK IT. PASS IT ON.</span><h3>Ready for its moment?</h3>
      <p className="sw-review-sub">Review the saved artwork and content before approving.</p>
      <div className="sw-review-plan"><span>Goes live · India time</span><strong>{post.postDate ? new Date(post.postDate + "T00:00:00+05:30").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "Date not set"} · {post.postTime || "10:00"} IST</strong><p>{channels.length ? "Connected: " + channels.join(" · ") : "No connected publishing targets — approval alone will not schedule a job."}</p><small>Reviewer: {reviewer}</small><small>Queued jobs depend on channel readiness and pause status.</small></div>
      {preflightLoading && <p role="status">Checking the saved post…</p>}
      {preflightError && <p className="sw-upload-error" role="alert">Could not check this post: {preflightError}. Reopen Review to try again.</p>}
      {preflightIssues.length > 0 && <div className="sw-upload-error" role="alert"><b>Fix before approval</b><ul>{preflightIssues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul><small>Use Edit saved content, then review the saved version again.</small></div>}
      <div className="sw-review-checks">{CHECKS.map((label, index) => <label key={label}><input type="checkbox" checked={!!checks[index]} disabled={!loaded || !canReview || busy} onChange={(e) => setChecks((old) => CHECKS.map((_, i) => i === index ? e.target.checked : !!old[i]))} /><span>{label}</span></label>)}</div>
      <label className="sw-review-note" htmlFor="review-change-note">Feedback for the maker<textarea id="review-change-note" rows={3} placeholder="What should we improve?" value={note} disabled={!canReview || busy} onChange={(e) => setNote(e.target.value)} /></label>
      {error && <p className="sw-upload-error" role="alert">{error}</p>}
      {!canReview && <p className="sw-upload-error">Only the assigned social reviewer or an admin can approve this post.</p>}
      <button type="button" className="cal-primary wide" disabled={!ready} onClick={() => action("approve")}>{busy ? "Saving…" : channels.length ? "Approve & schedule" : "Approve for manual posting"}</button>
      <button type="button" className="cal-btn" disabled={!loaded || !canReview || busy} onClick={() => action("changes")}>Request changes</button>
      <p className="sw-review-sub">Approval uses the saved version. Later content changes pause publishing for another review.</p>
    </section></div>
  </aside>;
}
