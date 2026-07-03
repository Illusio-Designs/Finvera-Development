import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import { getTeam, getSeo } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("about");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

const values = [
  { t: "Ship fast", d: "Momentum compounds. We deliver working software every single week.", i: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /> },
  { t: "Own the outcome", d: "We measure success by your metrics, not billed hours.", i: <><path d="M12 2a10 10 0 1 0 10 10" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></> },
  { t: "Craft matters", d: "Details are the product. We sweat the pixels and the milliseconds.", i: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M9 12l2 2 4-4" /></> },
  { t: "Partner, not vendor", d: "We work as an extension of your team — transparent and hands-on.", i: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></> },
];

export default async function About() {
  const team = await getTeam();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">SaaS &amp; CRM Development Agency</span>
          <h1 className="reveal d1">We build SaaS &amp; CRM<br />that <span className="grad-word">moves business</span></h1>
          <p className="reveal d2">Finvera is a SaaS &amp; CRM development agency. Since day one our mission has been simple: help ambitious teams design, build and scale SaaS platforms and CRM systems their customers genuinely love.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>About</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container about-split">
          <div className="reveal">
            <span className="eyebrow">Our story</span>
            <h2 style={{ margin: "14px 0 14px", fontSize: "clamp(24px,3.2vw,36px)", letterSpacing: "-.02em" }}>From a two-person team to a <span className="grad-word">global studio</span></h2>
            <p style={{ color: "var(--muted)", marginBottom: 14 }}>What started as two engineers frustrated by bloated, slow-to-ship software has grown into a distributed studio of designers, engineers and product thinkers across 18 countries.</p>
            <p style={{ color: "var(--muted)" }}>We&apos;ve shipped 250+ products — from zero-to-one MVPs to platforms serving millions. We stay small on every project on purpose: senior squads, no hand-offs, real ownership.</p>
            <div className="hero-meta" style={{ marginTop: 30 }}>
              <div className="m"><strong data-count="250" data-suffix="+">0</strong><span>Products Shipped</span></div>
              <div className="m"><strong data-count="40" data-suffix="+">0</strong><span>Team Members</span></div>
              <div className="m"><strong data-count="18" data-suffix="+">0</strong><span>Countries</span></div>
            </div>
          </div>
          <div className="about-media reveal d2">
            <svg className="lg" viewBox="0 0 500 500" aria-hidden="true"><use href="#finmark" /></svg>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">What drives us</span>
            <h2>Values we <span className="grad-word">build by</span></h2>
          </div>
          <div className="grid-4">
            {values.map((v, i) => (
              <div className={"card value reveal" + (i ? " d" + i : "")} data-cursor key={v.t}>
                <div className="vic"><svg viewBox="0 0 24 24" width={22} fill="none" stroke="currentColor" strokeWidth={2}>{v.i}</svg></div>
                <h4>{v.t}</h4><p>{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">The people</span>
            <h2>Meet the <span className="grad-word">core team</span></h2>
          </div>
          <div className="grid-4">
            {team.map((m, i) => (
              <div className={"card team-card reveal" + (i ? " d" + i : "")} data-cursor key={m.id}>
                <div className="ph">{m.initials}</div><h4>{m.name}</h4><span>{m.role}</span><p>{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band reveal">
            <h2>Want to build with us?</h2>
            <p>We take on a handful of new partners each quarter. Tell us what you&apos;re building.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Start a conversation <Arrow /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
