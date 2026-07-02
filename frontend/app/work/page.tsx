import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import SiteShot from "@/components/SiteShot";
import { getProjects, getSeo } from "@/lib/api";
import type { Project } from "@/lib/mock";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("work");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

/* Uses an uploaded image from the backend when available; otherwise
   falls back to a live screenshot of the site. */
function Shot({ p, kind }: { p: Project; kind: "desktop" | "mobile" }) {
  const img = kind === "desktop" ? p.desktopImage : p.mobileImage;
  if (img) {
    return (
      <div className="shot-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="shot ready" src={img} alt={`${p.title} ${kind} screenshot`} loading="lazy" />
      </div>
    );
  }
  return <SiteShot url={p.url} kind={kind} alt={`${p.title} ${kind} screenshot`} />;
}

function Case({ p, i }: { p: Project; i: number }) {
  const display = p.url.replace(/^https?:\/\//, "");
  return (
    <div className={"case" + (i % 2 ? " rev" : "")}>
      <div className="case-copy reveal">
        <span className="case-index">Project {String(i + 1).padStart(2, "0")} · {p.category}</span>
        <h3>{p.title}</h3>
        <div className="case-tags">{(p.tags || []).map((t) => <span key={t}>{t}</span>)}</div>
        <p>{p.blurb}</p>
        <a className="case-visit" href={p.url} target="_blank" rel="noopener noreferrer" data-cursor data-magnetic>
          Visit live site <Arrow />
        </a>
      </div>
      <div className="case-visual reveal d1">
        <div className="stage">
          <div className="browser">
            <div className="bar"><i /><i /><i /><span className="url">{display}</span></div>
            <Shot p={p} kind="desktop" />
          </div>
          <div className="phone"><Shot p={p} kind="mobile" /></div>
        </div>
      </div>
    </div>
  );
}

export default async function Work() {
  const projects = await getProjects();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Our work</span>
          <h1 className="reveal d1">Real products,<br /><span className="grad-word">real results</span></h1>
          <p className="reveal d2">A selection of websites, stores and platforms we&apos;ve designed and developed for brands around the world.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Work</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 48 }}>
        <div className="container">
          <div className="cases">
            {projects.map((p, i) => <Case key={p.id} p={p} i={i} />)}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="stats reveal">
            <div className="stat"><b data-count={projects.length} data-suffix="+">0</b><span>Live projects shown</span></div>
            <div className="stat"><b data-count="99" data-suffix="%">0</b><span>Uptime guaranteed</span></div>
            <div className="stat"><b data-count="7" data-suffix="+">0</b><span>Industries served</span></div>
            <div className="stat"><b data-count="100" data-suffix="%">0</b><span>Client ownership</span></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
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
