import Link from "next/link";
import { Arrow, Check, XIcon, LinkedIn, Instagram } from "@/components/icons";

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

const services = [
  { t: "SaaS Development", d: "Multi-tenant, subscription-ready platforms built for scale — billing, auth, dashboards and everything in between.", i: <><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" /><rect x="9" y="9" width="6" height="6" rx="1" /></> },
  { t: "CRM Solutions", d: "Custom CRM engines with smart pipelines, lead scoring, and automations tailored to how your team actually sells.", i: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></> },
  { t: "Cloud & DevOps", d: "Zero-downtime infrastructure, CI/CD pipelines and observability so you can ship confidently, every single day.", i: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" /> },
  { t: "API & Integrations", d: "Connect your stack — payments, messaging, analytics and 3rd-party tools — with resilient, well-documented APIs.", i: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></> },
  { t: "UI/UX Design", d: "Interfaces people love — research-driven, pixel-perfect, and engineered with motion that feels effortless.", i: <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></> },
  { t: "AI Automation", d: "Embed intelligence into your product — copilots, predictions and workflow automation that save real hours.", i: <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3v1a3 3 0 0 0 6 0v-1a3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3V5a3 3 0 0 0-3-3z" /> },
];

const logos = ["Nexora", "Orbital", "Vaultly", "Prismix", "Loopwork", "Quanta"];
const work = [
  { tag: "AI · SaaS", t: "Antimatter AI", d: "A fast, modern marketing site for an AI product studio — built for clarity and conversion." },
  { tag: "B2B · E-commerce", t: "Stallion Eyewear", d: "A B2B ordering portal streamlining wholesale purchasing for a growing eyewear brand." },
  { tag: "Fintech", t: "CrossCoin", d: "A sleek, secure-feeling fintech platform interface designed to build instant trust." },
];
const testimonials = [
  { q: "Finvera shipped our CRM in six weeks — something two agencies quoted us six months for. Absolute pros.", n: "Aisha Khan", r: "CEO, Orbital", a: "AK" },
  { q: "The animation and polish on our SaaS dashboard genuinely moved our trial-to-paid numbers. Worth every penny.", n: "Daniel Mercer", r: "Founder, Vaultly", a: "DM" },
  { q: "They think like product owners, not just developers. Best engineering partner we've worked with, hands down.", n: "Sofia Rossi", r: "CPO, Quanta", a: "SR" },
  { q: "Reliable, fast and deeply talented. Our uptime hasn't dropped once since Finvera took over infra.", n: "James Lee", r: "CTO, Prismix", a: "JL" },
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

export default function Home() {
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
              <span className="pill reveal"><span className="dot" /> Empowering Global SaaS &amp; CRM Growth</span>
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
                <div className="ic"><svg viewBox="0 0 24 24" width={17} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 17l6-6 4 4 8-8" /><path d="M21 7v5" /></svg></div>
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
              <article className={"card reveal" + (i % 3 ? " d" + (i % 3) : "")} data-tilt data-cursor key={s.t}>
                <div className="ic"><Ic>{s.i}</Ic></div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
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
            <div className="mock-head"><b>Revenue overview</b><small>Last 30 days</small></div>
            <div className="bars">
              {[0.45, 0.62, 0.4, 0.8, 0.55, 0.95, 0.7, 1].map((h, i) => (
                <span className="bar" key={i} style={{ ["--h" as string]: h } as React.CSSProperties} />
              ))}
            </div>
            <div className="crm-rows">
              <div className="crm-row"><span className="av" /><span className="nm">Acme Corp<small>Enterprise • $48k</small></span><span className="tag">Won</span></div>
              <div className="crm-row"><span className="av" /><span className="nm">Globex<small>Growth • $12k</small></span><span className="tag">Negotiation</span></div>
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
            {[["01", "Discover", "We map your goals, users and constraints into a sharp product blueprint."], ["02", "Design", "Wireframes to polished UI with motion, validated against real users."], ["03", "Build", "Agile sprints, weekly demos and production-grade, tested code."], ["04", "Scale", "Launch, monitor and iterate — we grow with you long after go-live."]].map(([n, h, p], i) => (
              <div className={"step reveal" + (i ? " d" + i : "")} key={n}><div className="num">{n}</div><h4>{h}</h4><p>{p}</p></div>
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
          <div className="grid-3">
            {work.map((w, i) => (
              <article className={"card reveal" + (i ? " d" + i : "")} data-tilt data-cursor key={w.t}>
                <div className="mock-head" style={{ marginBottom: 14 }}><b style={{ color: "var(--blue-400)" }}>{w.tag}</b></div>
                <h3>{w.t}</h3><p>{w.d}</p>
                <Link href="/work" className="more" data-cursor>View case study <Arrow /></Link>
              </article>
            ))}
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
            {[...testimonials, ...testimonials].map((t, i) => (
              <div className="tcard" key={i}>
                <div className="stars">★★★★★</div><p>&quot;{t.q}&quot;</p>
                <div className="who"><span className="av">{t.a}</span><div><b>{t.n}</b><small>{t.r}</small></div></div>
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
