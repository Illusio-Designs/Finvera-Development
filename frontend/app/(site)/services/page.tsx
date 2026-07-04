import Link from "next/link";
import type { Metadata } from "next";
import { Arrow } from "@/components/icons";
import ServiceGrid from "@/components/ServiceGrid";
import ProcessSteps from "@/components/ProcessSteps";
import { getServices, getSeo } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("services");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

export default async function Services() {
  const services = await getServices();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Our Services</span>
          <h1 className="reveal d1">SaaS &amp; CRM development,<br /><span className="grad-word">end to end</span></h1>
          <p className="reveal d2">A full-service SaaS &amp; CRM development agency — one senior team across design, engineering and DevOps, so your product ships faster and stays reliable as you grow.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Services</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container">
          <ServiceGrid services={services} cta="Get a quote" href="/contact" />
        </div>
      </section>

      <ProcessSteps />

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
