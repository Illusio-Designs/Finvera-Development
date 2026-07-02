import Link from "next/link";
import { Arrow, Check } from "@/components/icons";

export const metadata = { title: "Contact" };

const info = [
  { t: "Email us", d: "hello@finvera.dev", i: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></> },
  { t: "Call us", d: "+1 (415) 555-0132", i: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /> },
  { t: "Visit us", d: "500 Market St, San Francisco, CA", i: <><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></> },
];

export default function Contact() {
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Contact</span>
          <h1 className="reveal d1">Let&apos;s build<br /><span className="grad-word">something great</span></h1>
          <p className="reveal d2">Tell us about your product and goals. We&apos;ll get back to you within one business day.</p>
          <div className="crumbs reveal d3"><Link href="/">Home</Link><span className="sep">/</span><span>Contact</span></div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 40 }}>
        <div className="container contact-grid">
          <div className="card reveal" style={{ padding: 30 }}>
            <h3 style={{ marginBottom: 6 }}>Send us a message</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 22 }}>Fields marked * are required.</p>
            <form id="contactForm">
              <div className="field row">
                <div className="field" style={{ margin: 0, flex: 1 }}>
                  <label htmlFor="name">Full name *</label>
                  <input id="name" name="name" required placeholder="Jane Doe" />
                </div>
                <div className="field" style={{ margin: 0, flex: 1 }}>
                  <label htmlFor="email">Work email *</label>
                  <input id="email" name="email" type="email" required placeholder="jane@company.com" />
                </div>
              </div>
              <div className="field">
                <label htmlFor="company">Company</label>
                <input id="company" name="company" placeholder="Acme Inc." />
              </div>
              <div className="field">
                <label htmlFor="budget">Project type</label>
                <select id="budget" name="budget">
                  <option>SaaS platform</option>
                  <option>CRM system</option>
                  <option>Cloud &amp; DevOps</option>
                  <option>AI &amp; automation</option>
                  <option>Something else</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="message">Project details *</label>
                <textarea id="message" name="message" required placeholder="Tell us what you're building, timeline and goals..." />
              </div>
              <button type="submit" className="btn btn-primary" data-cursor data-magnetic style={{ width: "100%", justifyContent: "center" }}>
                Send message <Arrow />
              </button>
              <p className="form-note">By submitting, you agree to our privacy policy. This demo form does not send data.</p>
              <div id="formOk" style={{ display: "none", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(40,200,64,.12)", border: "1px solid rgba(40,200,64,.3)", color: "#8fe6a0", fontSize: 14 }}>
                <Check width={18} /> Thanks! Your message has been received — we&apos;ll be in touch shortly.
              </div>
            </form>
          </div>

          <div>
            <div className="contact-info">
              {info.map((it, i) => (
                <div className={"info-item reveal" + (i ? " d" + i : "")} key={it.t}>
                  <div className="ic"><svg viewBox="0 0 24 24" width={20} fill="none" stroke="currentColor" strokeWidth={2}>{it.i}</svg></div>
                  <div><h4>{it.t}</h4><p>{it.d}</p></div>
                </div>
              ))}
            </div>
            <div className="card reveal d2" style={{ marginTop: 16, padding: 24 }}>
              <h4 style={{ marginBottom: 12 }}>Why teams choose Finvera</h4>
              <ul className="feature-list" style={{ marginTop: 4 }}>
                <li><span className="fi"><Check width={15} /></span><div><h4>Reply within 1 business day</h4></div></li>
                <li><span className="fi"><Check width={15} /></span><div><h4>Senior-only squads, no hand-offs</h4></div></li>
                <li><span className="fi"><Check width={15} /></span><div><h4>You own 100% of the code &amp; IP</h4></div></li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
