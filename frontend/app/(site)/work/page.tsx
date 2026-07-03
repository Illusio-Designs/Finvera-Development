import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import SiteShot from "@/components/SiteShot";
import { getProjects, getSeo } from "@/lib/api";
import type { Project } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("work");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

function Thumb({ p }: { p: Project }) {
  if (p.desktopImage) {
    return (
      <div className="shot-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shot ready" src={p.desktopImage} alt={`${p.title} screenshot`} loading="lazy" />
      </div>
    );
  }
  return <SiteShot url={p.url} kind="desktop" alt={`${p.title} screenshot`} />;
}

function ProjectCard({ p, i }: { p: Project; i: number }) {
  return (
    <Link className="pcard reveal" href={`/work/${p.slug}`} data-cursor>
      <div className="pfolder">
        <svg className="pf-back" viewBox="0 0 50 40" preserveAspectRatio="none" fill="none" aria-hidden>
          <path d="M0 4C0 1.79086 1.79086 0 4 0H16.524C17.721 0 18.8415 0.54051 19.574 1.4673L22.426 5.0654C23.1585 5.99219 24.279 6.5327 25.476 6.5327H46C48.2091 6.5327 50 8.32356 50 10.5327V36C50 38.2091 48.2091 40 46 40H4C1.79086 40 0 38.2091 0 36V4Z" fill="#1c3f86" />
        </svg>
        <span className="pf-tab-label">{String(i + 1).padStart(2, "0")}</span>
        <div className="pf-photo"><Thumb p={p} /></div>
        <div className="pf-front">
          <svg viewBox="0 0 50 34" preserveAspectRatio="none" fill="none" aria-hidden>
            <path d="M0 4C0 1.79086 1.79086 0 4 0H46C48.2091 0 50 1.79086 50 4V30C50 32.2091 48.2091 34 46 34H4C1.79086 34 0 32.2091 0 30V4Z" fill="#3e60ab" />
          </svg>
          <div className="pf-info"><span className="cat">{p.category}</span><h3>{p.title}</h3></div>
        </div>
      </div>
    </Link>
  );
}

export default async function Work() {
  const projects = await getProjects();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Our work</span>
          <h1 className="reveal d1">Selected <span className="grad-word">projects</span></h1>
          <p className="reveal d2">Websites, stores and platforms we&apos;ve designed and developed for brands around the world.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Work</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          <div className="pgrid">
            {projects.map((p, i) => <ProjectCard key={p.id} p={p} i={i} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Your product could be next</h2>
            <p>Let&apos;s build something worth showing off. Book a free strategy call today.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Start your project <Arrow /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
