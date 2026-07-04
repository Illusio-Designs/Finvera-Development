import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import ProjectCard from "@/components/ProjectCard";
import Manifesto from "@/components/Manifesto";
import { getProjects, getSeo } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("work");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

export default async function Work() {
  const projects = await getProjects();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Our work</span>
          <h1 className="reveal d1">Selected <span className="grad-word">projects</span></h1>
          <p className="reveal d2">SaaS platforms, CRM systems and product websites our agency has designed and developed for brands around the world.</p>
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

      <Manifesto text="Real products, shipped and scaled — design and engineering our clients trust to move their business forward." />

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
