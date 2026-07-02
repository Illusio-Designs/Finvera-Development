import Link from "next/link";
import { Arrow } from "@/components/icons";
import SiteShot from "@/components/SiteShot";

export const metadata = { title: "Work" };

type Project = { name: string; url: string; category: string; tags: string[]; blurb: string };

const projects: Project[] = [
  { name: "Antimatter AI", url: "https://www.antimatterai.com/", category: "AI · SaaS", tags: ["Web Design", "Development", "AI"],
    blurb: "A fast, modern marketing site for an AI product studio — built for clarity, motion and conversion." },
  { name: "Finvera Solutions", url: "https://www.finvera.solutions/", category: "Fintech · SaaS", tags: ["Fintech", "Web Design", "Development"],
    blurb: "The Finvera platform website — accounting and finance, presented with a clean, trustworthy interface." },
  { name: "Stallion Eyewear", url: "https://b2b.stallioneyewear.in/", category: "B2B · E-commerce", tags: ["E-commerce", "B2B", "Development"],
    blurb: "A B2B ordering portal for a fast-growing eyewear brand, streamlining wholesale purchasing." },
  { name: "CrossCoin", url: "https://crosscoin.in/", category: "Fintech", tags: ["Fintech", "Web Design", "Development"],
    blurb: "A sleek, secure-feeling fintech platform interface designed to build instant trust." },
  { name: "Nanak Finserv", url: "https://nanakfinserv.com/", category: "Financial Services", tags: ["Finance", "Web Design"],
    blurb: "A professional web presence for a financial services firm, focused on credibility and clarity." },
  { name: "Velmique", url: "https://www.velmique.co.in/", category: "E-commerce · Brand", tags: ["E-commerce", "Branding", "Development"],
    blurb: "An elegant brand storefront with a refined, mobile-first shopping experience." },
  { name: "Knitwink", url: "https://www.knitwink.com/", category: "Brand Website", tags: ["Web Design", "Development"],
    blurb: "A polished, content-driven website crafted to bring the Knitwink brand to life online." },
  { name: "Volterra Tiles", url: "https://volterratiles.com.au/blog", category: "Content · Editorial", tags: ["Content", "SEO", "Development"],
    blurb: "An editorial blog and content platform for a premium Australian tiles brand." },
  { name: "Amrutkumar Govinddas LLP", url: "https://amrutkumargovinddasllp.com/", category: "Corporate", tags: ["Corporate", "Web Design"],
    blurb: "A clean, professional corporate website for an established LLP." },
  { name: "Aqalite", url: "https://aqalite.co.nz/", category: "Product Website", tags: ["Web Design", "Development"],
    blurb: "A crisp product website for a New Zealand building-products brand." },
  { name: "Nishree", url: "https://nishree.vercel.app/", category: "Brand Website", tags: ["Web Design", "Next.js"],
    blurb: "A fast, minimal brand site deployed on Vercel with a focus on performance." },
];

function Case({ p, i }: { p: Project; i: number }) {
  const display = p.url.replace(/^https?:\/\//, "");
  return (
    <div className={"case" + (i % 2 ? " rev" : "")}>
      <div className="case-copy reveal">
        <span className="case-index">Project {String(i + 1).padStart(2, "0")} · {p.category}</span>
        <h3>{p.name}</h3>
        <div className="case-tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>
        <p>{p.blurb}</p>
        <a className="case-visit" href={p.url} target="_blank" rel="noopener noreferrer" data-cursor data-magnetic>
          Visit live site <Arrow />
        </a>
      </div>
      <div className="case-visual reveal d1">
        <div className="stage">
          <div className="browser">
            <div className="bar"><i /><i /><i /><span className="url">{display}</span></div>
            <SiteShot url={p.url} kind="desktop" alt={`${p.name} desktop screenshot`} />
          </div>
          <div className="phone">
            <SiteShot url={p.url} kind="mobile" alt={`${p.name} mobile screenshot`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Work() {
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
            {projects.map((p, i) => <Case key={p.url} p={p} i={i} />)}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="stats reveal">
            <div className="stat"><b data-count="11" data-suffix="+">0</b><span>Live projects shown</span></div>
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
