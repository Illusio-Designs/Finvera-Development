import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
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
                <article className={"card reveal" + (i % 3 ? " d" + (i % 3) : "")} data-tilt data-cursor key={post.id}>
                  <div className="mock-head" style={{ marginBottom: 12 }}>
                    <b style={{ color: "var(--blue-400)" }}>{post.category || "Article"}</b>
                    <small style={{ color: "var(--muted-2)" }}>{fmt(post.publishedAt)}</small>
                  </div>
                  <h3 style={{ marginBottom: 10 }}>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <Link href={`/blog/${post.slug}`} className="more" data-cursor>Read article <Arrow /></Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
