import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "@/components/icons";
import ContactForm from "@/components/ContactForm";
import { getSeo, getSettings } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("contact");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

export default async function Contact() {
  const settings = await getSettings();
  const info = [
    { t: "Email us", d: settings.contact_email || "hello@finvera.dev", i: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M22 7l-10 6L2 7" /></> },
    { t: "Call us", d: settings.contact_phone || "+91 84900 09684", i: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /> },
    { t: "Visit us", d: settings.contact_address || "B-603, 6th Floor, Darshan Shrusti Apartment, Nanavati Chowk, Rajkot", i: <><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></> },
  ];

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
            <ContactForm />
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
