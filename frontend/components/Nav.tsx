"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark, Arrow } from "./icons";

const LINKS = [
  ["/", "Home"],
  ["/about", "About"],
  ["/services", "Services"],
  ["/solutions", "Solutions"],
  ["/work", "Work"],
  ["/blog", "Blog"],
  ["/contact", "Contact"],
] as const;

export default function Nav() {
  const path = usePathname();
  return (
    <header className="nav" id="nav">
      <div className="container">
        <div className="nav-inner">
          <Link href="/" className="brand" data-cursor>
            <Mark /> Finvera
          </Link>
          <nav className="nav-links" id="navLinks">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} className={path === href ? "active" : ""}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="nav-cta">
            <Link href="/contact" className="btn btn-primary" data-cursor>
              Get Started <Arrow />
            </Link>
            <button className="burger" id="burger" aria-label="Menu"><span /></button>
          </div>
        </div>
      </div>
    </header>
  );
}
