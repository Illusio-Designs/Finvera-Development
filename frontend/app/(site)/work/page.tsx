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
      <div className="pcard-shot">
        <Thumb p={p} />
      </div>
      <div className="pcard-folder">
        <span className="pcard-step">Project {String(i + 1).padStart(2, "0")}</span>
        <span className="pcard-cat">{p.category}</span>
        <h3>{p.title}</h3>
        <div className="ptags">{(Array.isArray(p.tags) ? p.tags : []).slice(0, 3).map((t) => <span key={t}>{t}</span>)}</div>
        <span className="pcard-btn">View case study <Arrow /></span>
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
