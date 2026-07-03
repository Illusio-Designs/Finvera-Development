"use client";
import Link from "next/link";
import { Mark, XIcon, LinkedIn, GitHub } from "./icons";
import { toast } from "@/lib/toast";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="foot-card">
          {/* Floating glossy logo badge (overlaps top-right) */}
          <span className="foot-badge" aria-hidden><Mark /></span>
          {/* Blue brand panel */}
          <div className="foot-card-left">
            <Link href="/" className="brand"><Mark /> Finvera</Link>
            <p className="tag">Future-driven SaaS &amp; CRM development, powered by a team that ships.</p>
            <div className="foot-contact">
              <a href="mailto:finvetasolutionsllp@gmail.com">finvetasolutionsllp@gmail.com</a>
              <a href="tel:+918490009684">+91 84900 09684</a>
            </div>
            <div className="foot-stay">
              <span>Stay in touch!</span>
              <div className="foot-social">
                <a href="#" data-cursor data-tip="X (Twitter)" aria-label="X"><XIcon /></a>
                <a href="#" data-cursor data-tip="LinkedIn" aria-label="LinkedIn"><LinkedIn /></a>
                <a href="#" data-cursor data-tip="GitHub" aria-label="GitHub"><GitHub /></a>
              </div>
            </div>
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
                <Link href="/">Privacy Policy</Link>
                <Link href="/">Terms &amp; Conditions</Link>
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
