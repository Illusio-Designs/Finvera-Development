import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import ServiceIcon from "@/components/serviceIcons";
import { getServices, getSeo } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("services");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

const steps = [["01", "Discover", "We map your goals, users and constraints into a sharp product blueprint."], ["02", "Design", "Wireframes to polished UI with motion, validated against real users."], ["03", "Build", "Agile sprints, weekly demos and production-grade, tested code."], ["04", "Scale", "Launch, monitor and iterate — we grow with you long after go-live."]];

export default async function Services() {
  const services = await getServices();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Services</span>
          <h1 className="reveal d1">Everything you need<br />to <span className="grad-word">build &amp; scale</span></h1>
          <p className="reveal d2">One senior team across design, engineering and DevOps — so your product ships faster and stays reliable as you grow.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Services</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          <div className="grid-3">
            {services.map((s, i) => (
              <article className={"card reveal" + (i % 3 ? " d" + (i % 3) : "")} data-tilt data-cursor key={s.id}>
                <div className="ic"><ServiceIcon name={s.icon} /></div>
                <h3>{s.title}</h3><p>{s.description}</p>
                <Link href="/contact" className="more" data-cursor>Get a quote <Arrow /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }} id="process">
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">How we work</span>
            <h2>A proven path from <span className="grad-word">idea to impact</span></h2>
          </div>
          <div className="steps">
            {steps.map(([n, h, p], i) => (
              <div className={"step reveal" + (i ? " d" + i : "")} key={n}><div className="num">{n}</div><h4>{h}</h4><p>{p}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band reveal">
            <h2>Not sure where to start?</h2>
            <p>Book a free technical consultation and we&apos;ll map the fastest path to your goals.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Book a free consultation <Arrow /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
