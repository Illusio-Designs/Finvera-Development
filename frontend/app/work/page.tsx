import Link from "next/link";
import { Arrow } from "@/components/icons";

export const metadata = { title: "Work" };

const projects = [
  { tag: "SaaS · Fintech", t: "Vaultly Payments", d: "A multi-currency billing platform processing $40M+ monthly with sub-second latency.", m: "+312% throughput" },
  { tag: "CRM · B2B", t: "Orbital Sales Cloud", d: "Custom CRM that lifted the sales team's conversion rate by 34% in one quarter.", m: "+34% conversion" },
  { tag: "AI · SaaS", t: "Quanta Insights", d: "An AI analytics copilot answering natural-language questions over live data.", m: "5M+ queries/mo" },
  { tag: "SaaS · HealthTech", t: "Prismix Care", d: "A HIPAA-compliant patient platform with real-time scheduling and messaging.", m: "99.98% uptime" },
  { tag: "CRM · Real Estate", t: "Loopwork Deals", d: "Deal-flow CRM with automated document generation and e-sign integration.", m: "12h saved / week" },
  { tag: "Cloud · Logistics", t: "Nexora Fleet", d: "Real-time fleet tracking platform ingesting 2M+ GPS events per minute.", m: "2M events/min" },
];
const testimonials = [
  { q: "Finvera shipped our CRM in six weeks — something two agencies quoted us six months for. Absolute pros.", n: "Aisha Khan", r: "CEO, Orbital", a: "AK" },
  { q: "The animation and polish on our SaaS dashboard genuinely moved our trial-to-paid numbers.", n: "Daniel Mercer", r: "Founder, Vaultly", a: "DM" },
  { q: "They think like product owners, not just developers. Best engineering partner we've worked with.", n: "Sofia Rossi", r: "CPO, Quanta", a: "SR" },
  { q: "Reliable, fast and deeply talented. Our uptime hasn't dropped once since Finvera took over infra.", n: "James Lee", r: "CTO, Prismix", a: "JL" },
];

export default function Work() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Our work</span>
          <h1 className="reveal d1">Products that<br /><span className="grad-word">deliver results</span></h1>
          <p className="reveal d2">A selection of SaaS and CRM products we&apos;ve designed, built and scaled for teams around the world.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Work</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          <div className="grid-3">
            {projects.map((p, i) => (
              <article className={"card reveal" + (i % 3 ? " d" + (i % 3) : "")} data-tilt data-cursor key={p.t}>
                <div className="mock-head" style={{ marginBottom: 14 }}>
                  <b style={{ color: "var(--blue-400)" }}>{p.tag}</b>
                  <span className="tag">{p.m}</span>
                </div>
                <h3>{p.t}</h3><p>{p.d}</p>
                <Link href="/contact" className="more" data-cursor>View case study <Arrow /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="stats reveal">
            <div className="stat"><b data-count="250" data-suffix="+">0</b><span>Projects delivered</span></div>
            <div className="stat"><b data-count="99" data-suffix="%">0</b><span>Uptime guaranteed</span></div>
            <div className="stat"><b data-count="34" data-suffix="%">0</b><span>Avg. conversion lift</span></div>
            <div className="stat"><b data-count="18" data-suffix="+">0</b><span>Countries served</span></div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">Client love</span>
            <h2>What partners <span className="grad-word">say about us</span></h2>
          </div>
        </div>
        <div className="marquee" style={{ ["--dur" as string]: "44s" } as React.CSSProperties}>
          <div className="marquee-track" style={{ gap: 20 }}>
            {[...testimonials, ...testimonials].map((t, i) => (
              <div className="tcard" key={i}>
                <div className="stars">★★★★★</div><p>&quot;{t.q}&quot;</p>
                <div className="who"><span className="av">{t.a}</span><div><b>{t.n}</b><small>{t.r}</small></div></div>
              </div>
            ))}
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
