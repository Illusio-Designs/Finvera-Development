export type PreviewPost = { id?: number; client?: string; theme?: string; format?: string | null; caption?: string | null; keywords?: string | null; keywordHashtags?: boolean | number; postDate?: string | null; postTime?: string | null; publishTo?: string[] | null; media?: { url: string; type: string; name?: string; coverUrl?: string | null; thumbUrl?: string | null }[] };
export function previewCaption(p: PreviewPost) {
  const caption = String(p.caption || "").trim(), re = /#[\p{L}\p{N}_]+/gu;
  const have = new Set((caption.match(re) || []).map(h => h.toLowerCase())), extra: string[] = [];
  if (p.keywordHashtags !== false && p.keywordHashtags !== 0) for (const raw of String(p.keywords || "").split(/[,\n;|]+/)) {
    const tag = "#" + raw.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]+/gu, "");
    if (tag.length < 2 || have.has(tag.toLowerCase())) continue;
    have.add(tag.toLowerCase()); extra.push(tag);
  }
  return [caption, extra.slice(0, Math.max(0, 30 - (caption.match(re) || []).length)).join(" ")].filter(Boolean).join("\n\n").slice(0, 2200);
}
export const previewKind = (format?: string | null) => /story|stories/i.test(format || "") ? "story" : /reel/i.test(format || "") ? "reel" : "feed";
export const previewTargets = (post: PreviewPost, connected: string[]) => post.publishTo == null ? connected : connected.filter(p => post.publishTo!.includes(p));
