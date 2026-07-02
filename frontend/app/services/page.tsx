import Link from "next/link";
import { Arrow } from "@/components/icons";

export const metadata = { title: "Services" };

const services = [
  { t: "SaaS Development", d: "Multi-tenant architecture, subscription billing, auth, admin panels and dashboards — production-ready from day one.", i: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /><rect x="9" y="9" width="6" height="6" rx="1" /></> },
  { t: "CRM Solutions", d: "Custom pipelines, lead scoring, automations and reporting — plus migrations from Salesforce, HubSpot and Zoho.", i: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></> },
  { t: "Cloud & DevOps", d: "CI/CD pipelines, containerization, autoscaling and 24/7 monitoring on AWS, GCP or Azure.", i: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /> },
  { t: "API & Integrations", d: "REST & GraphQL APIs, webhooks, payment gateways and third-party integrations that never break.", i: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></> },
  { t: "UI/UX Design", d: "User research, design systems, prototyping and delightful micro-interactions that lift conversion.", i: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></> },
  { t: "AI Automation", d: "LLM copilots, predictive scoring and workflow automation embedded right into your product.", i: <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z" /> },
];
const steps = [["01", "Discover", "We map your goals, users and constraints into a sharp product blueprint."], ["02", "Design", "Wireframes to polished UI with motion, validated against real users."], ["03", "Build", "Agile sprints, weekly demos and production-grade, tested code."], ["04", "Scale", "Launch, monitor and iterate — we grow with you long after go-live."]];

export default function Services() {
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
              <article className={"card reveal" + (i % 3 ? " d" + (i % 3) : "")} data-tilt data-cursor key={s.t}>
                <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{s.i}</svg></div>
                <h3>{s.t}</h3><p>{s.d}</p>
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
