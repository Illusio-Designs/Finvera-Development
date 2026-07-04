import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import ContentIcon from "@/components/contentIcon";
import BrandShowcase from "@/components/BrandShowcase";
import { getTeam, getSeo, getBrands, getMilestones, getValues, getLogos } from "@/lib/api";
import type { Brand, Milestone, ValueItem } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("about");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

const FB_BRANDS: Brand[] = [
  { id: 1, name: "Illusio Designs", category: "Design & Marketing", icon: "paint", url: "https://illusiodesigns.agency", description: "Our founding studio. Brand identity, web design and growth marketing — the craft that gives every product a sharp, memorable presence." },
  { id: 2, name: "Fintranzact", category: "Accounting SaaS", icon: "calculator", url: "https://fintranzact.com", description: "Cloud accounting built for modern businesses — invoicing, reconciliation, tax-ready books and real-time financial clarity." },
  { id: 3, name: "Kartriq", category: "Omni-Channel SaaS", icon: "store", url: "https://kartriq.com", description: "One platform to run every sales channel — inventory, orders and fulfilment synced across marketplaces, retail and D2C." },
  { id: 4, name: "Collabhype", category: "Influencer Collaboration", icon: "megaphone", url: "https://collabhype.in", description: "Where brands and creators meet — discover, manage and measure influencer campaigns from first message to final report." },
  { id: 5, name: "Finvera", category: "CRM & SaaS Development", icon: "code", url: "https://finvera.solutions", description: "Our flagship — custom CRM systems and SaaS platforms engineered to help businesses grow, scale and innovate." },
];
const FB_TIMELINE: Milestone[] = [
  { id: 1, year: "2017", title: "Illusio Designs is born", description: "We start as a small design & marketing studio, helping brands look sharper and sell better." },
  { id: 2, year: "2019", title: "Into web & product", description: "Client demand pulls us from brand design into websites, product UI and front-end engineering." },
  { id: 3, year: "2021", title: "Our first SaaS", description: "We ship our first SaaS products — for clients and for ourselves — and fall for building software." },
  { id: 4, year: "2023", title: "The brand family grows", description: "Fintranzact, Kartriq and Collabhype take shape — accounting, omni-channel retail and creator collaboration." },
  { id: 5, year: "2024", title: "Finvera Solutions LLP", description: "We formally incorporate. Finvera becomes our CRM & SaaS development flagship." },
  { id: 6, year: "Today", title: "A multi-product group", description: "Five brands, one team — building design, software and SaaS for businesses worldwide." },
];
const FB_VALUES: ValueItem[] = [
  { id: 1, title: "Ship fast", description: "Momentum compounds. We deliver working software every single week.", icon: "rocket" },
  { id: 2, title: "Own the outcome", description: "We measure success by your metrics, not billed hours.", icon: "target" },
  { id: 3, title: "Craft matters", description: "Details are the product. We sweat the pixels and the milliseconds.", icon: "award" },
  { id: 4, title: "Partner, not vendor", description: "We work as an extension of your team — transparent and hands-on.", icon: "agreement" },
];

export default async function About() {
  const [team, brandsRes, timelineRes, valuesRes, clientLogos] = await Promise.all([getTeam(), getBrands(), getMilestones(), getValues(), getLogos()]);
  const brands = brandsRes.length ? brandsRes : FB_BRANDS;
  const timeline = timelineRes.length ? timelineRes : FB_TIMELINE;
  const values = valuesRes.length ? valuesRes : FB_VALUES;
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
      <BrandShowcase brands={brands} />

      {/* Timeline */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">Our journey</span>
            <h2>Nine years, <span className="grad-word">one throughline</span></h2>
          </div>
          <div className="timeline">
            {timeline.map((s, i) => (
              <div className={"tl-item reveal-x" + (i % 2 ? " r" : "")} key={s.id}>
                <div className="tl-marker"><span className="tl-dot" /></div>
                <div className="tl-body">
                  <span className="tl-year">{s.year}</span>
                  <h4>{s.title}</h4>
                  <p>{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">What drives us</span>
            <h2>Values we <span className="grad-word">build by</span></h2>
          </div>
          <div className="grid-4">
            {values.map((v, i) => (
              <div className={"card value reveal" + (i ? " d" + i : "")} data-cursor key={v.id}>
                <div className="vic"><ContentIcon name={v.icon} size={22} /></div>
                <h4>{v.title}</h4><p>{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                    : m.initials}</div><h4>{m.name}</h4><span>{m.role}</span><p>{m.bio}</p>
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
                  {l.image
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img className="logo-img" src={l.image} alt={l.name} loading="lazy" />
                    : <span className="logo-name">{l.name}</span>}
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
