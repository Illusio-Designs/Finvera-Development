import WebsiteStats from "@/components/WebsiteStats";
import HomeFaqs from "@/components/HomeFaqs";
import { seoMetadata } from "@/lib/seoMetadata";
import { testimonialRating, testimonialInitials } from "@/lib/testimonialPresentation";
import Link from "next/link";
import type { Metadata } from "next";
import { Arrow, Check, XIcon, LinkedIn, Instagram } from "@/components/icons";
import ProjectCard from "@/components/ProjectCard";
import ServiceGrid from "@/components/ServiceGrid";
import ProcessSteps from "@/components/ProcessSteps";
import Manifesto from "@/components/Manifesto";
import ClientLogos from "@/components/ClientLogos";
import { HugeiconsIcon } from "@hugeicons/react";
import { AnalyticsUpIcon } from "@hugeicons/core-free-icons";
import { getServices, getProjects, getTestimonials, getSeo, getFaqs, getLogos, getStats, getFeatures, getSettings } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("home");
  return seoMetadata(s);
}

const codeHtml = `
<span class="ln"><span class="k">import</span> { <span class="f">Finvera</span> } <span class="k">from</span> <span class="s">'@finvera/core'</span>;</span>
<span class="ln"> </span>
<span class="ln"><span class="k">const</span> <span class="f">crm</span> = <span class="k">new</span> <span class="f">Finvera</span>.<span class="f">CRM</span>({</span>
<span class="ln">  workspace: <span class="s">'growth-team'</span>,</span>
<span class="ln">  pipeline: <span class="s">'enterprise'</span>,</span>
<span class="ln">  automations: <span class="p">true</span>,</span>
<span class="ln">});</span>
<span class="ln"> </span>
<span class="ln"><span class="f">crm</span>.<span class="f">on</span>(<span class="s">'lead'</span>, <span class="k">async</span> (lead) <span class="p">=></span> {</span>
<span class="ln">  <span class="k">await</span> <span class="f">crm</span>.<span class="f">score</span>(lead);      <span class="c">// AI scoring</span></span>
<span class="ln">  <span class="k">await</span> <span class="f">crm</span>.<span class="f">route</span>(lead);      <span class="c">// smart routing</span></span>
<span class="ln">});</span>
<span class="ln"> </span>
<span class="ln"><span class="f">crm</span>.<span class="f">deploy</span>();  <span class="c">// ship in minutes</span></span>`;

const FB_FEATURES = [
  { title: "Smart pipelines", description: "Drag-and-drop deal stages with automated hand-offs." },
  { title: "AI lead scoring", description: "Know which leads to call first, ranked in real time." },
  { title: "Live analytics", description: "Boardroom-ready dashboards updated to the second." },
];
const revBars = [
  { d: "Mon", h: 0.48 }, { d: "Tue", h: 0.66 }, { d: "Wed", h: 0.4 }, { d: "Thu", h: 0.82 },
  { d: "Fri", h: 0.58 }, { d: "Sat", h: 1 }, { d: "Sun", h: 0.72 },
];
const pipeline = [
  { co: "Acme Corp", meta: "Enterprise • $48k", tag: "Won", cls: "win", in: "AC" },
  { co: "Globex", meta: "Growth • $12k", tag: "Negotiation", cls: "neg", in: "GX" },
  { co: "Nexora", meta: "Startup • $6k", tag: "Proposal", cls: "prop", in: "NX" },
];
export default async function Home() {
  const [services, projects, testimonials, faqsRes, logosRes, statsRes, featuresRes] = await Promise.all([
    getServices(), getProjects(), getTestimonials(), getFaqs(), getLogos(), getStats(), getFeatures(),
  ]);
  const featured = (projects.filter((p) => p.featured).length ? projects.filter((p) => p.featured) : projects).slice(0, 3);
  const tRow = [...testimonials, ...testimonials];
  const features = featuresRes.length ? featuresRes : FB_FEATURES;
  // Social links from Settings & pixels; icons without a link are hidden.
  const site = await getSettings();
  const heroSocial = ([[site.social_x, "X", XIcon], [site.social_linkedin, "LinkedIn", LinkedIn], [site.social_instagram, "Instagram", Instagram]] as const)
    .filter(([u]) => !!u && /^https?:\/\/\S+$/i.test(String(u).trim())).map(([u, l, I]) => [String(u).trim(), l, I] as const);

  return (
    <>
      {/* Hero */}
      <section className="hero" id="home">
        {heroSocial.length > 0 && (
          <div className="hero-social">
            <span>Follow</span>
            {heroSocial.map(([href, label, Ico]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" data-cursor aria-label={label}><Ico width={15} /></a>)}
          </div>
        )}
        <div className="container">
          <div className="hero-grid">
            <div className="hero-copy">
              <span className="pill reveal"><span className="dot" /> SaaS &amp; CRM Development Agency</span>
              <h1 data-split>
                <span className="line"><span>Future-Driven</span></span>
                <span className="line"><span>SaaS &amp; CRM</span></span>
                <span className="line"><span className="brace">{"{"}</span> <span>Development</span> <span className="brace">{"}"}</span></span>
              </h1>
              <p className="sub reveal d2">We craft high-quality SaaS platforms and CRM systems that help businesses grow, scale, and innovate in a fast-changing world.</p>
              <div className="hero-actions reveal d3">
                <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Get Started <Arrow /></Link>
                <Link href="/work" className="btn btn-ghost" data-cursor data-magnetic>See Our Work</Link>
              </div>
              <div className="hero-meta reveal d4">
                <div className="m"><strong data-count="250" data-suffix="+">0</strong><span>Products Shipped</span></div>
                <div className="m"><strong data-count="98" data-suffix="%">0</strong><span>Client Retention</span></div>
                <div className="m"><strong data-count="40" data-suffix="+">0</strong><span>Global Teams</span></div>
              </div>
            </div>
            <div className="hero-card reveal d2">
              <div className="code-card" id="tiltCard" data-cursor>
                <div className="cc-bar">
                  <span className="dots"><i /><i /><i /></span>
                  <span className="tab">crm-engine.js</span>
                  <span className="cc-actions"><i>↻</i><i>+</i><i>@</i></span>
                </div>
                <div className="code" id="codeBlock" dangerouslySetInnerHTML={{ __html: codeHtml }} />
              </div>
              <div className="float-card fc1">
                <div className="ic"><HugeiconsIcon icon={AnalyticsUpIcon} size={17} strokeWidth={1.8} className="hgi" /></div>
                <div><small>Revenue</small><strong>+38% MRR</strong></div>
              </div>
              <div className="float-card fc2">
                <div className="ic"><Check width={17} /></div>
                <div><small>Deploy</small><strong>Live in 4 min</strong></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client logos — saved publication state and order */}
      <ClientLogos items={logosRes} />

      {/* Services */}
      <section className="section" id="services">
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">What we do</span>
            <h2>End-to-end <span className="grad-word">product engineering</span></h2>
            <p>From first line of code to global scale — we design, build, and operate the software that powers modern businesses.</p>
          </div>
          <ServiceGrid services={services} cta="Learn more" href="/services" />
        </div>
      </section>

      {/* Solutions split */}
      <section className="section" id="solutions">
        <div className="container split">
          <div className="reveal">
            <span className="eyebrow">Built for growth</span>
            <h2 style={{ margin: "14px 0 12px", fontSize: "clamp(24px,3.2vw,38px)", letterSpacing: "-.02em" }}>One platform to <span className="grad-word">run your revenue</span></h2>
            <p style={{ color: "var(--muted)" }}>Finvera unifies your product, sales and success teams around a single source of truth — so nothing slips through the cracks.</p>
            <ul className="feature-list">
              {features.map((f) => (
                <li key={f.title}><span className="fi"><Check width={15} /></span><div><h4>{f.title}</h4><p>{f.description}</p></div></li>
              ))}
            </ul>
            <Link href="/solutions" className="btn btn-grad" data-cursor data-magnetic style={{ marginTop: 26 }}>Explore solutions <Arrow /></Link>
          </div>
          <div className="mock reveal d2">
            <div className="mock-head">
              <div><b>Revenue overview</b><span className="mock-sub">Last 30 days</span></div>
              <span className="mock-trend up">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v5h-5" /></svg>
                18.2%
              </span>
            </div>
            <div className="mock-kpi"><strong>$128,400</strong><span>closed · 42 deals</span></div>
            <div className="bars">
              {revBars.map((b, i) => (
                <span className="bar-col" key={b.d}>
                  <span className="bar" style={{ ["--h" as string]: b.h, animationDelay: `${i * 70}ms` } as React.CSSProperties} />
                  <span className="bar-x">{b.d}</span>
                </span>
              ))}
            </div>
            <div className="crm-rows">
              {pipeline.map((p) => (
                <div className="crm-row" key={p.co}>
                  <span className="av">{p.in}</span>
                  <span className="nm">{p.co}<small>{p.meta}</small></span>
                  <span className={"tag " + p.cls}>{p.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats — published CMS content only */}
      <WebsiteStats items={statsRes} />

      {/* Process — shared component (identical on Services) */}
      <ProcessSteps />

      {/* Work preview */}
      <section className="section" id="work" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">Selected work</span>
            <h2>Products we&apos;re <span className="grad-word">proud of</span></h2>
          </div>
          <div className="pgrid">
            {featured.map((w, i) => <ProjectCard key={w.id} p={w} i={i} />)}
          </div>
          <div className="reveal" style={{ textAlign: "center", marginTop: 44 }}>
            <Link href="/work" className="btn btn-ghost" data-cursor data-magnetic>View all work <Arrow /></Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section" id="testimonials" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">Loved by founders</span>
            <h2>Don&apos;t take our <span className="grad-word">word for it</span></h2>
          </div>
        </div>
        <div className="marquee" style={{ ["--dur" as string]: "44s" } as React.CSSProperties}>
          <div className="marquee-track" style={{ gap: 20 }}>
            {tRow.map((t, i) => (
              <div className="tcard" key={i}>
                <div className="stars">{"★".repeat(testimonialRating(t.rating))}</div><p>&quot;{t.quote}&quot;</p>
                <div className="who"><span className="av">{testimonialInitials(t.name, t.avatar)}</span><div><b>{t.name}</b><small>{t.role}{t.company ? `, ${t.company}` : ""}</small></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HomeFaqs items={faqsRes} />

      <Manifesto text="We craft SaaS and CRM software that helps businesses grow, scale and innovate — where every release moves your revenue forward." />

      {/* CTA */}
      <section className="section">
        <div className="container">
          <div className="cta-band reveal">
            <h2>Ready to build something<br />your users will love?</h2>
            <p>Let&apos;s turn your roadmap into a fast, beautiful, revenue-driving product. Book a free 30-minute strategy call.</p>
            <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Book a free consultation <Arrow /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
