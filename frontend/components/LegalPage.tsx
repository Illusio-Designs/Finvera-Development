import Link from "next/link";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/api";

function fmt(d?: string) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
  catch { return ""; }
}

/* Renders a CMS-managed content page (privacy, terms…) by slug. */
export default async function LegalPage({ slug, fallbackTitle }: { slug: string; fallbackTitle: string }) {
  const page = await getPage(slug);
  if (!page || page.status !== "published") notFound();

  return (
    <article className="section" style={{ paddingTop: 150 }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="reveal">
          <div className="crumbs" style={{ marginBottom: 18 }}>
            <Link href="/">Home</Link><span className="sep">/</span><span>{page.title || fallbackTitle}</span>
          </div>
          <h1 style={{ fontFamily: "var(--display)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".01em", fontSize: "clamp(28px,4.4vw,48px)", lineHeight: 1.05, margin: "10px 0 12px" }}>
            {page.title || fallbackTitle}
          </h1>
          {page.updatedAt && <p style={{ color: "var(--muted-2)", fontSize: 13.5 }}>Last updated {fmt(page.updatedAt)}</p>}
        </div>

        <div
          className="reveal d1 prose"
          style={{ marginTop: 30, color: "var(--muted)", fontSize: 16, lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: page.content || "" }}
        />

        <div style={{ marginTop: 44 }}>
          <Link href="/" className="btn btn-ghost" data-cursor data-magnetic>← Back home</Link>
        </div>
      </div>
    </article>
  );
}
