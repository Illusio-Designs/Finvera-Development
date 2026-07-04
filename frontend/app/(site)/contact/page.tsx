import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "@/components/icons";
import ContactForm from "@/components/ContactForm";
import { getSeo, getSettings } from "@/lib/api";
import { HugeiconsIcon } from "@hugeicons/react";
import { Mail01Icon, Call02Icon, Location01Icon } from "@hugeicons/core-free-icons";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSeo("contact");
  return { title: s.title, description: s.description, keywords: s.keywords };
}

export default async function Contact() {
  const settings = await getSettings();
  const info = [
    { t: "Email us", d: settings.contact_email || "hello@finvera.dev", i: Mail01Icon },
    { t: "Call us", d: settings.contact_phone || "+91 84900 09684", i: Call02Icon },
    { t: "Visit us", d: settings.contact_address || "B-603, 6th Floor, Darshan Shrusti Apartment, Nanavati Chowk, Rajkot", i: Location01Icon },
  ];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow reveal">Contact</span>
          <h1 className="reveal d1">Let&apos;s build your<br /><span className="grad-word">SaaS or CRM</span></h1>
          <p className="reveal d2">Tell us about your product and goals. As a SaaS &amp; CRM development agency, we&apos;ll get back to you within one business day.</p>
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
                  <div className="ic"><HugeiconsIcon icon={it.i} size={20} strokeWidth={1.8} className="hgi" /></div>
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
