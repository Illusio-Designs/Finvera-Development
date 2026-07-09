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
  const [post, all] = await Promise.all([getPost(slug), getBlog()]);
  if (!post || post.status !== "published") notFound();

  const published = all.filter((p) => p.status === "published");
  const idx = published.findIndex((x) => x.slug === post.slug);
  const next = published.length > 1 ? published[(idx + 1) % published.length] : null;

  const words = (post.content || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(words / 200));
  const facts: [string, string][] = [
    ["Category", post.category || "Article"],
    ["Published", fmt(post.publishedAt)],
    ["Author", post.author || "Finvera"],
    ["Read time", `${readTime} min`],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <article className="pdetail">
      {/* Hero — editorial, left aligned (matches work detail) */}
      <section className="page-hero pdetail-hero">
        <div className="container">
          <div className="crumbs reveal">
            <Link href="/">Home</Link><span className="sep">/</span>
            <Link href="/blog">Blog</Link><span className="sep">/</span><span>{post.category || "Article"}</span>
          </div>
          <span className="eyebrow reveal d1">{post.category || "Article"}</span>
          <h1 className="reveal d1">{post.title}</h1>
          <p className="reveal d2">{post.excerpt}</p>
          <div className="pd-cta reveal d3">
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Start a project <Arrow /></Link>
            <Link href="/blog" className="btn btn-ghost" data-cursor>← All articles</Link>
          </div>
        </div>
      </section>

      {/* Facts strip */}
      {!!facts.length && (
        <section className="container">
          <div className="pd-facts reveal">
            {facts.map(([k, v]) => (<div key={k} className="pd-fact"><span>{k}</span><b>{v}</b></div>))}
          </div>
        </section>
      )}

      {/* Cover */}
      {post.coverImage && (
        <section className="section" style={{ paddingTop: 34 }}>
          <div className="container">
            <div className="pd-cover reveal">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.coverImage} alt={post.title} />
            </div>
          </div>
        </section>
      )}

      {/* Body */}
      <section className="section" style={{ paddingTop: post.coverImage ? 44 : 34 }}>
        <div className="container" style={{ maxWidth: 760 }}>
          <div className="prose reveal" dangerouslySetInnerHTML={{ __html: post.content || "" }} />

          <div className="pd-author reveal">
            <span className="pd-author-av">{(post.author || "F").slice(0, 1)}</span>
            <div>
              <b>{post.author || "Finvera"}</b>
              <small>Finvera team</small>
            </div>
          </div>
        </div>
      </section>

      {/* Next article */}
      {next && next.slug !== post.slug && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <Link href={`/blog/${next.slug}`} className="pdetail-next reveal" data-cursor>
              <span className="lbl">Next article</span>
              <span className="ttl">{next.title} <Arrow /></span>
              <span className="cat">{next.category || "Article"}</span>
            </Link>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band reveal">
            <h2>Have a project in mind?</h2>
            <p>Let&apos;s build something worth writing about. Book a free strategy call today.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Start your project <Arrow /></Link>
          </div>
        </div>
      </section>
    </article>
  );
}
