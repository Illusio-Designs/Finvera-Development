import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import Manifesto from "@/components/Manifesto";
import { getBlog, getSeo } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("blog");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

function fmt(d: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return ""; }
}

export default async function Blog() {
  const posts = (await getBlog()).filter((p) => p.status === "published");
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Blog</span>
          <h1 className="reveal d1">Insights on <span className="grad-word">building software</span></h1>
          <p className="reveal d2">Product and engineering notes from the team building SaaS &amp; CRM software.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Blog</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          {posts.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)" }}>No posts yet — check back soon.</p>
          ) : (
            <div className="grid-3">
              {posts.map((post, i) => (
                <Link href={`/blog/${post.slug}`} className={"blog-card reveal-x" + (i % 2 ? " r" : "") + " d" + ((i % 3) + 1)} data-cursor key={post.id}>
                  <div className="blog-card-media reveal-clip">
                    {post.coverImage
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={post.coverImage} alt={post.title} loading="lazy" />
                      : <span className="blog-card-ph">{(post.category || "Article").slice(0, 1)}</span>}
                    <span className="blog-card-cat">{post.category || "Article"}</span>
                  </div>
                  <div className="blog-card-body">
                    <small className="blog-card-date">{fmt(post.publishedAt)}</small>
                    <h3>{post.title}</h3>
                    <p>{post.excerpt}</p>
                    <span className="more">Read article <Arrow /></span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <Manifesto text="Notes from the team building SaaS and CRM software — product and engineering thinking, shared openly." />
    </>
  );
}
