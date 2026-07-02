"use client";
import Link from "next/link";
import { Mark, Arrow, XIcon, LinkedIn, GitHub } from "./icons";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="foot-grid">
          <div className="foot-brand">
            <Link href="/" className="brand"><Mark /> Finvera</Link>
            <p>
              Future-driven SaaS &amp; CRM development. We build software that helps
              businesses grow, scale and innovate.
            </p>
            <div className="foot-social">
              <a href="#" data-cursor aria-label="X"><XIcon /></a>
              <a href="#" data-cursor aria-label="LinkedIn"><LinkedIn /></a>
              <a href="#" data-cursor aria-label="GitHub"><GitHub /></a>
            </div>
          </div>
          <div className="foot-col">
            <h5>Services</h5>
            <Link href="/services">SaaS Development</Link>
            <Link href="/services">CRM Solutions</Link>
            <Link href="/services">Cloud &amp; DevOps</Link>
            <Link href="/services">AI Automation</Link>
          </div>
          <div className="foot-col">
            <h5>Company</h5>
            <Link href="/about">About</Link>
            <Link href="/work">Our Work</Link>
            <Link href="/solutions">Solutions</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div className="foot-col">
            <h5>Get the newsletter</h5>
            <p style={{ color: "var(--muted)", fontSize: "12.5px" }}>
              Product &amp; engineering insights, monthly.
            </p>
            <form className="newsletter" onSubmit={(e) => e.preventDefault()}>
              <input type="email" placeholder="you@company.com" aria-label="Email" required />
              <button data-cursor aria-label="Subscribe"><Arrow /></button>
            </form>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Finvera. All rights reserved.</span>
          <span>Privacy · Terms · Built with care.</span>
        </div>
      </div>
    </footer>
  );
}
