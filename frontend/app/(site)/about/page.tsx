import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import { getTeam, getSeo } from "@/lib/api";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PaintBoardIcon, Calculator01Icon, Store01Icon, Megaphone01Icon, SourceCodeIcon,
  Rocket01Icon, Target02Icon, Award01Icon, Agreement01Icon,
} from "@hugeicons/core-free-icons";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("about");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

const brands = [
  { name: "Illusio Designs", cat: "Design & Marketing", icon: PaintBoardIcon,
    d: "Our founding studio. Brand identity, web design and growth marketing — the craft that gives every product a sharp, memorable presence." },
  { name: "Fintranzact", cat: "Accounting SaaS", icon: Calculator01Icon,
    d: "Cloud accounting built for modern businesses — invoicing, reconciliation, tax-ready books and real-time financial clarity." },
  { name: "Kartuq", cat: "Omni-Channel SaaS", icon: Store01Icon,
    d: "One platform to run every sales channel — inventory, orders and fulfilment synced across marketplaces, retail and D2C." },
  { name: "Collabhype", cat: "Influencer Collaboration", icon: Megaphone01Icon,
    d: "Where brands and creators meet — discover, manage and measure influencer campaigns from first message to final report." },
  { name: "Finvera", cat: "CRM & SaaS Development", icon: SourceCodeIcon,
    d: "Our flagship — custom CRM systems and SaaS platforms engineered to help businesses grow, scale and innovate." },
];

const timeline = [
  { y: "2017", t: "Illusio Designs is born", d: "We start as a small design & marketing studio, helping brands look sharper and sell better." },
  { y: "2019", t: "Into web & product", d: "Client demand pulls us from brand design into websites, product UI and front-end engineering." },
  { y: "2021", t: "Our first SaaS", d: "We ship our first SaaS products — for clients and for ourselves — and fall for building software." },
  { y: "2023", t: "The brand family grows", d: "Fintranzact, Kartuq and Collabhype take shape — accounting, omni-channel retail and creator collaboration." },
  { y: "2024", t: "Finvera Solutions LLP", d: "We formally incorporate. Finvera becomes our CRM & SaaS development flagship." },
  { y: "Today", t: "A multi-product group", d: "Five brands, one team — building design, software and SaaS for businesses worldwide." },
];

const values = [
  { t: "Ship fast", d: "Momentum compounds. We deliver working software every single week.", icon: Rocket01Icon },
  { t: "Own the outcome", d: "We measure success by your metrics, not billed hours.", icon: Target02Icon },
  { t: "Craft matters", d: "Details are the product. We sweat the pixels and the milliseconds.", icon: Award01Icon },
  { t: "Partner, not vendor", d: "We work as an extension of your team — transparent and hands-on.", icon: Agreement01Icon },
];

export default async function About() {
  const team = await getTeam();
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

      {/* Brand ecosystem */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">Our ecosystem</span>
            <h2>One group, <span className="grad-word">five brands</span></h2>
            <p>Different products, one team and one standard of craft — each brand focused on a problem we care about solving well.</p>
          </div>
          <div className="brands">
            {brands.map((b, i) => (
              <div className={"brand-card reveal" + (i % 3 ? " d" + (i % 3) : "")} key={b.name} data-cursor>
                <span className="brand-ic"><HugeiconsIcon icon={b.icon} size={24} strokeWidth={1.8} className="hgi" /></span>
                <div className="brand-cat">{b.cat}</div>
                <h3>{b.name}</h3>
                <p>{b.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">Our journey</span>
            <h2>Nine years, <span className="grad-word">one throughline</span></h2>
          </div>
          <div className="timeline">
            {timeline.map((s, i) => (
              <div className={"tl-item reveal" + (i ? " d" + (i % 3) : "")} key={s.y}>
                <div className="tl-marker"><span className="tl-dot" /></div>
                <div className="tl-body">
                  <span className="tl-year">{s.y}</span>
                  <h4>{s.t}</h4>
                  <p>{s.d}</p>
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
              <div className={"card value reveal" + (i ? " d" + i : "")} data-cursor key={v.t}>
                <div className="vic"><HugeiconsIcon icon={v.icon} size={22} strokeWidth={1.8} className="hgi" /></div>
                <h4>{v.t}</h4><p>{v.d}</p>
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
                <div className={"card team-card reveal" + (i ? " d" + i : "")} data-cursor key={m.id}>
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
