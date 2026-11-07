import LogoMark from "@/components/LogoMark";
import type { Logo } from "@/lib/types";

export default function ClientLogos({ items, variant = "marquee" }: { items: Logo[]; variant?: "marquee" | "grid" }) {
  const logos = items.filter(item => !item.status || item.status === "published");
  if (!logos.length) return null;
  if (variant === "grid") return <section className="section" style={{ paddingTop: 0 }} id="clients">
    <div className="container">
      <div className="section-head center reveal"><span className="eyebrow">Our clients</span><h2>Brands we&apos;ve <span className="grad-word">worked with</span></h2><p>A few of the brands we&apos;ve designed, built and shipped for.</p></div>
      <div className="logo-grid">{logos.map((logo, index) => <span className={"logo-item reveal-x" + (index % 2 ? " r" : "") + " d" + ((index % 4) + 1)} key={logo.id}><LogoMark name={logo.name} image={logo.image} /></span>)}</div>
    </div>
  </section>;
  return <section className="section" style={{ paddingTop: 0 }} aria-label="Trusted by" id="trusted-by">
    <div className="container"><p className="reveal" style={{ textAlign: "center", color: "var(--muted-2)", fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 30 }}>Trusted by fast-scaling teams worldwide</p>
      <div className="marquee"><div className="marquee-track">{[0, 1].flatMap(copy => logos.map(logo => <span className="logo-item" key={`${copy}-${logo.id}`} aria-hidden={copy === 1 ? true : undefined}><LogoMark name={logo.name} image={logo.image} /></span>))}</div></div>
    </div>
  </section>;
}
