import Link from "next/link";
import type { Metadata } from "next";
import { Arrow, Check } from "@/components/icons";
import { getSeo } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("solutions");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

const solutions = [
  {
    tag: "SaaS Platforms", t: "Launch a product people pay for",
    d: "We build subscription businesses end-to-end — onboarding, billing, roles, dashboards and analytics — on an architecture that scales from your first user to your millionth.",
    points: ["Multi-tenant & role-based access", "Stripe / usage-based billing", "Admin & customer dashboards"],
    mock: "bars",
  },
  {
    tag: "CRM Systems", t: "A CRM that fits how you sell",
    d: "Off-the-shelf CRMs force your process into their box. We build the opposite — pipelines, automations and reporting shaped around your team, with clean migrations from your old tool.",
    points: ["Custom pipelines & deal stages", "AI lead scoring & routing", "Salesforce / HubSpot migration"],
    mock: "crm",
  },
  {
    tag: "Cloud & Data", t: "Infrastructure that never sleeps",
    d: "Ship confidently with automated pipelines, autoscaling and full observability. We keep your platform fast, secure and available around the clock.",
    points: ["CI/CD & infrastructure as code", "Autoscaling on AWS / GCP / Azure", "24/7 monitoring & alerting"],
    mock: "ring",
  },
  {
    tag: "AI & Automation", t: "Put intelligence to work",
    d: "From copilots to predictive scoring, we embed AI where it actually saves hours — inside your product and your internal workflows.",
    points: ["LLM copilots & assistants", "Predictive scoring & insights", "Workflow automation"],
    mock: "bars",
  },
];

function Mock({ type }: { type: string }) {
  if (type === "crm")
    return (
      <div className="mock reveal d1">
        <div className="mock-head"><b>Pipeline</b><small>This week</small></div>
        <div className="crm-rows">
          <div className="crm-row"><span className="av" /><span className="nm">Acme Corp<small>Enterprise • $48k</small></span><span className="tag">Won</span></div>
          <div className="crm-row"><span className="av" /><span className="nm">Globex<small>Growth • $12k</small></span><span className="tag">Negotiation</span></div>
          <div className="crm-row"><span className="av" /><span className="nm">Initech<small>Starter • $4k</small></span><span className="tag">New</span></div>
        </div>
      </div>
    );
  if (type === "ring")
    return (
      <div className="mock reveal d1">
        <div className="mock-head"><b>Uptime</b><small>Rolling 90 days</small></div>
        <div className="ring" style={{ ["--p" as string]: "356deg" } as React.CSSProperties}><b>99.9%</b></div>
      </div>
    );
  return (
    <div className="mock reveal d1">
      <div className="mock-head"><b>Revenue overview</b><small>Last 30 days</small></div>
      <div className="bars">
        {[0.4, 0.6, 0.45, 0.85, 0.6, 0.95, 0.7, 1].map((h, i) => (
          <span className="bar" key={i} style={{ ["--h" as string]: h } as React.CSSProperties} />
        ))}
      </div>
    </div>
  );
}

export default function Solutions() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Solutions</span>
          <h1 className="reveal d1">SaaS &amp; CRM for every<br /><span className="grad-word">stage of growth</span></h1>
          <p className="reveal d2">As a SaaS &amp; CRM development agency, whether you&apos;re launching an MVP or scaling to millions, we build a solution shaped to your goals — not a template.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Solutions</span></div>
        </div>
      </section>

      {solutions.map((s, i) => (
        <section className="section" style={i === 0 ? { paddingTop: 40 } : { paddingTop: 0 }} key={s.t}>
          <div className={"container split" + (i % 2 ? " rev" : "")}>
            <div className={"reveal-x" + (i % 2 ? " r" : "")}>
              <span className="sol-idx">{String(i + 1).padStart(2, "0")}</span>
              <span className="eyebrow">{s.tag}</span>
              <h2 style={{ margin: "14px 0 12px", fontSize: "clamp(24px,3.2vw,36px)", letterSpacing: "-.02em" }}>{s.t}</h2>
              <p style={{ color: "var(--muted)" }}>{s.d}</p>
              <ul className="feature-list">
                {s.points.map((p) => (
                  <li key={p}><span className="fi"><Check width={15} /></span><div><h4>{p}</h4></div></li>
                ))}
              </ul>
              <Link href="/contact" className="btn btn-grad" data-cursor data-magnetic style={{ marginTop: 26 }}>Discuss your project <Arrow /></Link>
            </div>
            <Mock type={s.mock} />
          </div>
        </section>
      ))}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="cta-band reveal">
            <h2>Have a different challenge?</h2>
            <p>Tell us what you&apos;re building and we&apos;ll propose the right approach.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Talk to an engineer <Arrow /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
