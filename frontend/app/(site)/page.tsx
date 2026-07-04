import Link from "next/link";
import type { Metadata } from "next";
import { Arrow, Check, XIcon, LinkedIn, Instagram } from "@/components/icons";
import ProjectCard from "@/components/ProjectCard";
import ServiceIcon from "@/components/serviceIcons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, PaintBoardIcon, SourceCodeIcon, Rocket01Icon, AnalyticsUpIcon } from "@hugeicons/core-free-icons";
import { getServices, getProjects, getTestimonials, getSeo } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("home");
  return { title: s.title, description: s.description, keywords: s.keywords };
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

const logos = ["Nexora", "Orbital", "Vaultly", "Prismix", "Loopwork", "Quanta"];
const revBars = [
  { d: "Mon", h: 0.48 }, { d: "Tue", h: 0.66 }, { d: "Wed", h: 0.4 }, { d: "Thu", h: 0.82 },
  { d: "Fri", h: 0.58 }, { d: "Sat", h: 1 }, { d: "Sun", h: 0.72 },
];
const pipeline = [
  { co: "Acme Corp", meta: "Enterprise • $48k", tag: "Won", cls: "win", in: "AC" },
  { co: "Globex", meta: "Growth • $12k", tag: "Negotiation", cls: "neg", in: "GX" },
  { co: "Nexora", meta: "Startup • $6k", tag: "Proposal", cls: "prop", in: "NX" },
];
const faqs = [
  ["How fast can you start on my project?", "Most engagements kick off within one week. After a short discovery call we assemble a squad and schedule your first sprint immediately."],
  ["Do you build both SaaS and CRM products?", "Yes — it's our core focus. We build multi-tenant SaaS platforms and fully custom CRM systems, including migrations from tools like Salesforce and HubSpot."],
  ["Who owns the code and IP?", "You do, 100%. All source code, designs and infrastructure are transferred to your organization with full documentation."],
  ["Can you take over an existing codebase?", "Absolutely. We regularly audit, stabilize and scale existing products — starting with a technical review before any changes ship."],
];

const Ic = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{children}</svg>
);

export default async function Home() {
  const [services, projects, testimonials] = await Promise.all([getServices(), getProjects(), getTestimonials()]);
  const featured = (projects.filter((p) => p.featured).length ? projects.filter((p) => p.featured) : projects).slice(0, 3);
  const tRow = [...testimonials, ...testimonials];

  return (
    <>
      {/* Hero */}
      <section className="hero" id="home">
        <div className="hero-social">
          <span>Follow</span>
          <a href="#" data-cursor aria-label="X"><XIcon width={15} /></a>
          <a href="#" data-cursor aria-label="LinkedIn"><LinkedIn width={15} /></a>
          <a href="#" data-cursor aria-label="Instagram"><Instagram width={15} /></a>
        </div>
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

      {/* Logos marquee */}
      <section className="section" style={{ paddingTop: 0 }} aria-label="Trusted by">
        <div className="container">
          <p className="reveal" style={{ textAlign: "center", color: "var(--muted-2)", fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 30 }}>
            Trusted by fast-scaling teams worldwide
          </p>
          <div className="marquee">
            <div className="marquee-track">
              {[...logos, ...logos].map((l, i) => (
                <span className="logo-item" key={i}><Ic><rect x="3" y="3" width="18" height="18" rx="4" /></Ic>{l}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="section" id="services">
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">What we do</span>
            <h2>End-to-end <span className="grad-word">product engineering</span></h2>
            <p>From first line of code to global scale — we design, build, and operate the software that powers modern businesses.</p>
          </div>
          <div className="grid-3">
            {services.map((s, i) => (
              <article className={"card reveal" + (i % 3 ? " d" + (i % 3) : "")} data-tilt data-cursor key={s.id}>
                <div className="ic"><ServiceIcon name={s.icon} /></div>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <Link href="/services" className="more" data-cursor>Learn more <Arrow /></Link>
              </article>
            ))}
          </div>
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
              {[["Smart pipelines", "Drag-and-drop deal stages with automated hand-offs."], ["AI lead scoring", "Know which leads to call first, ranked in real time."], ["Live analytics", "Boardroom-ready dashboards updated to the second."]].map(([h, p]) => (
                <li key={h}><span className="fi"><Check width={15} /></span><div><h4>{h}</h4><p>{p}</p></div></li>
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

      {/* Stats */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="stats reveal">
            <div className="stat"><b data-count="250" data-suffix="+">0</b><span>Projects delivered</span></div>
            <div className="stat"><b data-count="99" data-suffix="%">0</b><span>Uptime guaranteed</span></div>
            <div className="stat"><b data-count="18" data-suffix="+">0</b><span>Countries served</span></div>
            <div className="stat"><b data-count="4" data-suffix="min">0</b><span>Avg. deploy time</span></div>
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="section" id="process">
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">How we work</span>
            <h2>A proven path from <span className="grad-word">idea to impact</span></h2>
          </div>
          <div className="steps">
            {[
              { n: "01", h: "Discover", p: "We map your goals, users and constraints into a sharp product blueprint.", ic: Search01Icon },
              { n: "02", h: "Design", p: "Wireframes to polished UI with motion, validated against real users.", ic: PaintBoardIcon },
              { n: "03", h: "Build", p: "Agile sprints, weekly demos and production-grade, tested code.", ic: SourceCodeIcon },
              { n: "04", h: "Scale", p: "Launch, monitor and iterate — we grow with you long after go-live.", ic: Rocket01Icon },
            ].map((s, i) => (
              <div className={"step reveal" + (i ? " d" + i : "")} key={s.n}>
                <span className="step-num">{s.n}.</span>
                <span className="step-ic"><HugeiconsIcon icon={s.ic} strokeWidth={1.8} className="hgi" /></span>
                <h4>{s.h}</h4>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                <div className="stars">{"★".repeat(t.rating || 5)}</div><p>&quot;{t.quote}&quot;</p>
                <div className="who"><span className="av">{t.avatar}</span><div><b>{t.name}</b><small>{t.role}{t.company ? `, ${t.company}` : ""}</small></div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="container">
          <div className="section-head center reveal">
            <span className="eyebrow">FAQ</span>
            <h2>Questions, <span className="grad-word">answered</span></h2>
          </div>
          <div className="faq">
            {faqs.map(([q, a], i) => (
              <div className={"qa reveal" + (i ? " d" + i : "")} key={q}>
                <button className="q">{q}<span className="pm" /></button>
                <div className="a"><p>{a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
