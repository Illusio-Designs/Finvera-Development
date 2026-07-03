import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Arrow } from "@/components/icons";
import SiteShot from "@/components/SiteShot";
import { getProject, getProjects } from "@/lib/api";
import type { Project } from "@/lib/types";

export async function generateStaticParams() {
  try {
    const projects = await getProjects();
    return projects.filter((p) => p.status === "published").map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProject(slug);
  if (!p) return { title: "Project not found" };
  return {
    title: `${p.title} — Finvera Work`,
    description: p.blurb,
    keywords: (p.tags || []).join(", "),
    openGraph: { images: [p.coverImage || p.desktopImage || ""].filter(Boolean) },
  };
}

function Desktop({ p }: { p: Project }) {
  if (p.desktopImage) {
    return (
      <div className="shot-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shot ready" src={p.desktopImage} alt={`${p.title} desktop`} />
      </div>
    );
  }
  return <SiteShot url={p.url} kind="desktop" alt={`${p.title} desktop`} />;
}
function Mobile({ p }: { p: Project }) {
  if (p.mobileImage) {
    return (
      <div className="shot-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shot ready" src={p.mobileImage} alt={`${p.title} mobile`} />
      </div>
    );
  }
  return <SiteShot url={p.url} kind="mobile" alt={`${p.title} mobile`} />;
}

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, all] = await Promise.all([getProject(slug), getProjects()]);
  if (!p || p.status !== "published") notFound();

  const idx = all.findIndex((x) => x.slug === p.slug);
  const next = all[(idx + 1) % all.length] || all[0];
  const host = (() => { try { return new URL(p.url).host.replace(/^www\./, ""); } catch { return p.url; } })();

  return (
    <>
      {/* Hero */}
      <section className="page-hero pdetail-hero">
        <div className="container">
          <div className="crumbs reveal">
            <Link href="/">Home</Link><span className="sep">/</span>
            <Link href="/work">Work</Link><span className="sep">/</span><span>{p.title}</span>
          </div>
          <span className="eyebrow reveal d1">{p.category}</span>
          <h1 className="reveal d1" style={{ marginTop: 14 }}>{p.title}</h1>
          <p className="reveal d2" style={{ maxWidth: 620 }}>{p.blurb}</p>
          <div className="case-tags reveal d2" style={{ justifyContent: "center", marginTop: 18 }}>
            {(p.tags || []).map((t) => <span key={t}>{t}</span>)}
          </div>
          <div className="reveal d3" style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
            <a className="btn btn-primary" href={p.url} target="_blank" rel="noopener noreferrer" data-cursor data-magnetic>
              Visit live site <Arrow />
            </a>
            <Link href="/work" className="btn btn-ghost" data-cursor>← All work</Link>
          </div>
        </div>
      </section>

      {/* 3D mockup — the "work result" */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="container">
          <div className="stage reveal">
            <div className="browser">
              <div className="bar"><i /><i /><i /><span className="url">{host}</span></div>
              <Desktop p={p} />
            </div>
            <div className="phone"><Mobile p={p} /></div>
          </div>
        </div>
      </section>

      {/* Overview + meta */}
      <section className="section" style={{ paddingTop: 10 }}>
        <div className="container pdetail-grid">
          <div className="pdetail-body">
            <span className="case-index">Overview</span>
            {p.content ? (
              <div className="prose" dangerouslySetInnerHTML={{ __html: p.content }} />
            ) : (
              <p style={{ color: "var(--muted)", fontSize: 16, lineHeight: 1.8 }}>{p.blurb}</p>
            )}
          </div>
          <aside className="pdetail-meta reveal d1">
            <div className="row"><span>Client</span><b>{p.title}</b></div>
            <div className="row"><span>Category</span><b>{p.category}</b></div>
            <div className="row"><span>Services</span><b>{(p.tags || []).join(", ") || "—"}</b></div>
            <div className="row"><span>Website</span><a href={p.url} target="_blank" rel="noopener noreferrer">{host} ↗</a></div>
            <a className="case-visit" href={p.url} target="_blank" rel="noopener noreferrer" data-cursor style={{ marginTop: 8 }}>
              View the live result <Arrow />
            </a>
          </aside>
        </div>
      </section>

      {/* Next project */}
      {next && next.slug !== p.slug && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <Link href={`/work/${next.slug}`} className="pdetail-next reveal" data-cursor>
              <span className="lbl">Next project</span>
              <span className="ttl">{next.title} <Arrow /></span>
              <span className="cat">{next.category}</span>
            </Link>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Want a result like this?</h2>
            <p>Let&apos;s design and build your product. Book a free strategy call today.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Start your project <Arrow /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
