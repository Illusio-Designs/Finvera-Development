import AboutTimeline from "@/components/AboutTimeline";
import AboutValues from "@/components/AboutValues";
import { seoMetadata } from "@/lib/seoMetadata";
import { testimonialInitials } from "@/lib/testimonialPresentation";
import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import ContentIcon from "@/components/contentIcon";
import BrandShowcase from "@/components/BrandShowcase";
import LogoMark from "@/components/LogoMark";
import { getTeam, getSeo, getBrands, getMilestones, getValues, getLogos } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("about");
  return seoMetadata(s);
}

export default async function About() {
  const [team, brandsRes, timelineRes, valuesRes, clientLogos] = await Promise.all([getTeam(), getBrands(), getMilestones(), getValues(), getLogos()]);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Illusio Designs · since 2017</span>
          <h1 className="reveal d1">Nine years of design,<br /><span className="grad-word">products &amp; platforms</span></h1>
          <p className="reveal d2">For nine years we&apos;ve been known in the industry as <strong>Illusio Designs</strong>. Today that journey lives under <strong>Finvera Solutions LLP</strong> — a product group building design, software and SaaS across a family of specialised brands.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>About</span></div>
        </div>
      </section>

      {/* Story */}
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container about-split">
          <div className="reveal">
            <span className="eyebrow">Our story</span>
            <h2 style={{ margin: "14px 0 14px", fontSize: "clamp(24px,3.2vw,36px)", letterSpacing: "-.02em" }}>From a design studio to a <span className="grad-word">multi-product group</span></h2>
            <p style={{ color: "var(--muted)", marginBottom: 14 }}>We began in 2017 as Illusio Designs — a small design &amp; marketing studio helping brands look and sell better. As clients asked for more, we grew from design into websites, products and, eventually, software.</p>
            <p style={{ color: "var(--muted)" }}>Nine years on, Finvera Solutions LLP is the home of five specialised brands — spanning design, accounting, retail, the creator economy and CRM software — each solving a real problem for growing businesses.</p>
            <div className="hero-meta" style={{ marginTop: 30 }}>
              <div className="m"><strong data-count="9" data-suffix="+">0</strong><span>Years</span></div>
              <div className="m"><strong data-count="5" data-suffix="">0</strong><span>Brands</span></div>
              <div className="m"><strong data-count="250" data-suffix="+">0</strong><span>Projects</span></div>
            </div>
          </div>
          <div className="about-media reveal d2">
            <svg className="lg" viewBox="0 0 500 500" aria-hidden="true"><use href="#finmark" /></svg>
          </div>
        </div>
      </section>

      {/* Brand ecosystem — pinned horizontal showcase (the /experience effect) */}
      <BrandShowcase brands={brandsRes} />

      <AboutTimeline items={timelineRes} />

      <AboutValues items={valuesRes} />

      {/* Team */}
      {team.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head center reveal">
              <span className="eyebrow">The people</span>
              <h2>Meet the <span className="grad-word">core team</span></h2>
            </div>
            <div className="grid-4">
              {team.map((m, i) => (
                <div className={"card team-card reveal-x" + (i % 2 ? " r" : "") + " d" + ((i % 4) + 1)} data-cursor key={m.id}>
                  <div className="ph">{m.photo
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={m.photo} alt={m.name} />
                    : testimonialInitials(m.name, m.initials)}</div><h4>{m.name}</h4><span>{m.role}</span><p>{m.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Brands we've served — logo box grid (from CMS) */}
      {clientLogos.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="section-head center reveal">
              <span className="eyebrow">Our clients</span>
              <h2>Brands we&apos;ve <span className="grad-word">worked with</span></h2>
              <p>A few of the brands we&apos;ve designed, built and shipped for.</p>
            </div>
            <div className="logo-grid">
              {clientLogos.map((l, i) => (
                <span className={"logo-item reveal-x" + (i % 2 ? " r" : "") + " d" + ((i % 4) + 1)} key={l.id}>
                  <LogoMark name={l.name} image={l.image} />
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
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
