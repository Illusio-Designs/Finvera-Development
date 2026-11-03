"use client";
import Link from "next/link";
import { Mark, XIcon, LinkedIn, GitHub, Instagram } from "./icons";
import { toast } from "@/lib/toast";

type FooterSettings = Partial<Record<"social_x" | "social_linkedin" | "social_instagram" | "social_github" | "contact_email" | "contact_phone" | "site_tagline", string>>;
const okUrl = (u?: string) => !!u && /^https?:\/\/\S+$/i.test(u.trim());

/* Contact details and social links come from Settings & pixels in the admin. */
export default function Footer({ settings = {} }: { settings?: FooterSettings }) {
  const email = settings.contact_email?.trim() || "finvetasolutionsllp@gmail.com";
  const phone = settings.contact_phone?.trim() || "+91 84900 09684";
  const social = ([
    ["social_x", "X (Twitter)", "X", XIcon], ["social_linkedin", "LinkedIn", "LinkedIn", LinkedIn], ["social_instagram", "Instagram", "Instagram", Instagram], ["social_github", "GitHub", "GitHub", GitHub],
  ] as const).filter(([k]) => okUrl(settings[k]));
  return (
    <footer className="footer">
      <div className="container">
        <div className="foot-card">
          {/* Floating glossy logo badge (overlaps top-right) */}
          <span className="foot-badge" aria-hidden><Mark /></span>
          {/* Blue brand panel */}
          <div className="foot-card-left">
            <Link href="/" className="brand"><Mark /> Finvera</Link>
            <p className="tag">{settings.site_tagline?.trim() || <>Future-driven SaaS &amp; CRM development, powered by a team that ships.</>}</p>
            <div className="foot-contact">
              <a href={`mailto:${email}`}>{email}</a>
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
            </div>
            {social.length > 0 && (
              <div className="foot-stay">
                <span>Stay in touch!</span>
                <div className="foot-social">
                  {social.map(([k, tip, label, Ico]) => (
                    <a key={k} href={settings[k]!.trim()} target="_blank" rel="noopener noreferrer" data-cursor data-tip={tip} aria-label={label}><Ico /></a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Light nav + newsletter panel */}
          <div className="foot-card-right">
            <div className="foot-nav">
              <div className="foot-col">
                <h5>Navigation</h5>
                <Link href="/services">Services</Link>
                <Link href="/work">Work</Link>
                <Link href="/solutions">Solutions</Link>
                <Link href="/blog">Blog</Link>
              </div>
              <div className="foot-col">
                <h5>Company</h5>
                <Link href="/about">About</Link>
                <Link href="/contact">Contact</Link>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/terms">Terms &amp; Conditions</Link>
              </div>
            </div>
            <div className="foot-news">
              <p className="foot-news-lead">Product &amp; engineering insights.</p>
              <p className="foot-news-title">Stay ahead with Finvera.</p>
              <form className="newsletter" onSubmit={(e) => { e.preventDefault(); (e.currentTarget as HTMLFormElement).reset(); toast("Subscribed — welcome aboard! 🎉"); }}>
                <input type="email" placeholder="Enter email address" aria-label="Email" required />
                <button data-cursor type="submit">Subscribe</button>
              </form>
            </div>
          </div>
        </div>

        <div className="foot-mark" aria-hidden>Finvera</div>

        <div className="foot-bottom">
          <span>© 2026 Finvera Solutions LLP. All rights reserved.</span>
          <span>Privacy · Terms · Built with care.</span>
        </div>
      </div>
    </footer>
  );
}
