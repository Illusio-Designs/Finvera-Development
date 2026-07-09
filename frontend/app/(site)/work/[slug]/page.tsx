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

const hostOf = (url: string) => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; } };
const parseResult = (s: string) => {
  const m = s.split(/\s*[—|:]\s*/);
  return { value: (m[0] || s).trim(), label: (m[1] || "").trim() };
};

export default async function ProjectDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [p, all] = await Promise.all([getProject(slug), getProjects()]);
  if (!p || p.status !== "published") notFound();

  const idx = all.findIndex((x) => x.slug === p.slug);
  const next = all[(idx + 1) % all.length] || all[0];
  const host = hostOf(p.url);
  const cover = p.coverImage || p.desktopImage;
  const facts: [string, string][] = [
    ["Client", p.client || p.title],
    ["Industry", p.industry || p.category],
    ["Timeline", p.duration || ""],
    ["Our role", p.role || (p.tags || []).slice(0, 2).join(" · ")],
    ["Year", p.year || ""],
  ].filter(([, v]) => v) as [string, string][];
  const results = (p.results || []).map(parseResult).filter((r) => r.value);
  const tech = p.tech || [];

  return (
    <article className="pdetail">
      {/* Hero — editorial, left aligned */}
      <section className="page-hero pdetail-hero">
        <div className="container">
          <div className="crumbs reveal">
            <Link href="/">Home</Link><span className="sep">/</span>
            <Link href="/work">Work</Link><span className="sep">/</span><span>{p.title}</span>
          </div>
          <span className="eyebrow reveal d1">{p.category}</span>
          <h1 className="reveal d1">{p.title}</h1>
          <p className="reveal d2">{p.blurb}</p>
          <div className="pd-cta reveal d3">
            <a className="btn btn-primary" href={p.url} target="_blank" rel="noopener noreferrer" data-cursor data-magnetic>Visit live site <Arrow /></a>
            <Link href="/work" className="btn btn-ghost" data-cursor>← All work</Link>
          </div>
        </div>
      </section>

      {/* Facts strip */}
      {!!facts.length && (
        <section className="container">
          <div className="pd-facts reveal">
            {facts.map(([k, v]) => (<div key={k} className="pd-fact"><span>{k}</span><b>{v}</b></div>))}
            <div className="pd-fact"><span>Website</span><a href={p.url} target="_blank" rel="noopener noreferrer">{host} ↗</a></div>
          </div>
        </section>
      )}

      {/* Big cover */}
      <section className="section" style={{ paddingTop: 34 }}>
        <div className="container">
          <div className="pd-cover reveal">
            <div className="pd-cover-bar"><i /><i /><i /><span>{host}</span></div>
            {cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={cover} alt={`${p.title} preview`} />
            ) : (
              <SiteShot url={p.url} kind="desktop" />
            )}
          </div>
        </div>
      </section>

      {/* Results / metrics — trust signal */}
      {!!results.length && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="pd-results reveal">
              {results.map((r, i) => (
                <div className="pd-result" key={i}><b>{r.value}</b>{r.label && <span>{r.label}</span>}</div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Narrative: challenge → approach, or long content */}
      {(p.challenge || p.approach) ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container pd-narrative">
            {p.challenge && <div className="reveal"><span className="case-index">The challenge</span><div className="prose" dangerouslySetInnerHTML={{ __html: p.challenge }} /></div>}
            {p.approach && <div className="reveal d1"><span className="case-index">Our approach</span><div className="prose" dangerouslySetInnerHTML={{ __html: p.approach }} /></div>}
          </div>
        </section>
      ) : p.content ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container" style={{ maxWidth: 760 }}>
            <span className="case-index">Overview</span>
            <div className="prose reveal" dangerouslySetInnerHTML={{ __html: p.content }} />
          </div>
        </section>
      ) : null}

      {/* Tech stack */}
      {!!tech.length && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <span className="case-index">Built with</span>
            <div className="pd-tech reveal">{tech.map((t) => <span key={t}>{t}</span>)}</div>
          </div>
        </section>
      )}

      {/* Mobile shot */}
      {p.mobileImage && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container pd-mobile reveal">
            <div>
              <span className="case-index">Responsive by design</span>
              <p>Every screen is crafted to feel native — fast, tactile and effortless on any device.</p>
            </div>
            <div className="pd-phone">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.mobileImage} alt={`${p.title} mobile`} />
            </div>
          </div>
        </section>
      )}

      {/* Testimonial */}
      {p.testimonialQuote && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <figure className="pd-quote reveal">
              <blockquote>“{p.testimonialQuote}”</blockquote>
              {(p.testimonialName || p.testimonialRole) && (
                <figcaption>
                  <span className="av">{(p.testimonialName || "C").slice(0, 1)}</span>
                  <span><b>{p.testimonialName}</b>{p.testimonialRole && <small>{p.testimonialRole}</small>}</span>
                </figcaption>
              )}
            </figure>
          </div>
        </section>
      )}

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
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band reveal">
            <h2>Want a result like this?</h2>
            <p>Let&apos;s design and build your product. Book a free strategy call today.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Start your project <Arrow /></Link>
          </div>
        </div>
      </section>
    </article>
  );
}
