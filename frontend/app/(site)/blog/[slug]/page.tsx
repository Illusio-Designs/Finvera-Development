import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Arrow } from "@/components/icons";
import { getPost, getBlog } from "@/lib/api";

export async function generateStaticParams() {
  try {
    const posts = await getBlog();
    return posts.filter((p) => p.status === "published").map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Article not found" };
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    keywords: post.seoKeywords,
    openGraph: post.coverImage ? { images: [post.coverImage] } : undefined,
  };
}

function fmt(d: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return ""; }
}

export default async function Post({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post || post.status !== "published") notFound();

  return (
    <article className="section" style={{ paddingTop: 150 }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="reveal">
          <div className="crumbs" style={{ marginBottom: 18 }}>
            <Link href="/blog">Blog</Link><span className="sep">/</span><span>{post.category || "Article"}</span>
          </div>
          <span className="eyebrow">{post.category || "Article"} · {fmt(post.publishedAt)}</span>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 400, textTransform: "uppercase", letterSpacing: ".01em", fontSize: "clamp(30px,5vw,56px)", lineHeight: 1, margin: "16px 0 14px" }}>
            {post.title}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 17 }}>{post.excerpt}</p>
        </div>

        {post.coverImage && (
          <div className="reveal d1" style={{ margin: "30px 0", borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--line-2)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.coverImage} alt={post.title} style={{ width: "100%", display: "block" }} loading="lazy" />
          </div>
        )}

        <div
          className="reveal d1 prose"
          style={{ marginTop: 30, color: "var(--muted)", fontSize: 16, lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: post.content || "" }}
        />

        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tcard-av" style={{ width: 44, height: 44, borderRadius: 12, background: "var(--grad)", display: "grid", placeItems: "center", fontWeight: 700 }}>
            {(post.author || "F").slice(0, 1)}
          </span>
          <div><b style={{ fontSize: 14 }}>{post.author || "Finvera"}</b><small style={{ display: "block", color: "var(--muted-2)", fontSize: 12 }}>Finvera team</small></div>
        </div>

        <div style={{ marginTop: 44 }}>
          <Link href="/blog" className="btn btn-ghost" data-cursor data-magnetic>← Back to blog</Link>
          <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic style={{ marginLeft: 12 }}>Start a project <Arrow /></Link>
        </div>
      </div>
    </article>
  );
}
