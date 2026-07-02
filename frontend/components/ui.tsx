/* =========================================================
   Finvera shared UI components (widgets)
   Reusable presentational building blocks used across the
   site and showcased on the hidden /widgets route.
   ========================================================= */
import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";
import { Arrow, Check } from "./icons";

/* --- Button --- */
export function Button({
  children, href, variant = "primary", magnetic, cursor = true, style, type,
}: {
  children: ReactNode; href?: string; variant?: "primary" | "ghost" | "grad";
  magnetic?: boolean; cursor?: boolean; style?: CSSProperties; type?: "button" | "submit";
}) {
  const cls = `btn btn-${variant}`;
  const attrs = { className: cls, style, ...(cursor ? { "data-cursor": true } : {}), ...(magnetic ? { "data-magnetic": true } : {}) };
  if (href) return <Link href={href} {...attrs}>{children}</Link>;
  return <button type={type || "button"} {...attrs}>{children}</button>;
}

/* --- Pill (status chip) --- */
export function Pill({ children }: { children: ReactNode }) {
  return <span className="pill"><span className="dot" /> {children}</span>;
}

/* --- Tag (inline label) --- */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

/* --- Eyebrow --- */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

/* --- Section heading --- */
export function SectionHeading({
  eyebrow, title, text, center,
}: { eyebrow?: string; title: ReactNode; text?: string; center?: boolean }) {
  return (
    <div className={"section-head" + (center ? " center" : "")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}

/* --- Service / feature card --- */
export function ServiceCard({
  icon, title, text, href, tilt = true,
}: { icon: ReactNode; title: string; text: string; href?: string; tilt?: boolean }) {
  return (
    <article className="card" {...(tilt ? { "data-tilt": true } : {})} data-cursor>
      <div className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>{icon}</svg></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {href && <Link href={href} className="more" data-cursor>Learn more <Arrow /></Link>}
    </article>
  );
}

/* --- Stat (animated count-up) --- */
export function Stat({ value, suffix = "", label }: { value: number; suffix?: string; label: string }) {
  return (
    <div className="stat">
      <b data-count={value} data-suffix={suffix}>0</b>
      <span>{label}</span>
    </div>
  );
}

/* --- Feature list item --- */
export function FeatureItem({ title, text }: { title: string; text?: string }) {
  return (
    <li>
      <span className="fi"><Check width={15} /></span>
      <div><h4>{title}</h4>{text && <p>{text}</p>}</div>
    </li>
  );
}

/* --- FAQ accordion item (wired by Chrome effects) --- */
export function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="qa">
      <button className="q">{q}<span className="pm" /></button>
      <div className="a"><p>{a}</p></div>
    </div>
  );
}

/* --- Testimonial card --- */
export function TestimonialCard({
  quote, name, role, avatar,
}: { quote: string; name: string; role: string; avatar: string }) {
  return (
    <div className="tcard">
      <div className="stars">★★★★★</div>
      <p>&quot;{quote}&quot;</p>
      <div className="who"><span className="av">{avatar}</span><div><b>{name}</b><small>{role}</small></div></div>
    </div>
  );
}

/* --- Process step --- */
export function Step({ num, title, text }: { num: string; title: string; text: string }) {
  return <div className="step"><div className="num">{num}</div><h4>{title}</h4><p>{text}</p></div>;
}

/* --- Contact info item --- */
export function InfoItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="info-item">
      <div className="ic"><svg viewBox="0 0 24 24" width={20} fill="none" stroke="currentColor" strokeWidth={2}>{icon}</svg></div>
      <div><h4>{title}</h4><p>{text}</p></div>
    </div>
  );
}

/* --- CTA band --- */
export function CTABand({ title, text, cta }: { title: ReactNode; text: string; cta: { label: string; href: string } }) {
  return (
    <div className="cta-band">
      <h2>{title}</h2>
      <p>{text}</p>
      <Button href={cta.href} magnetic>{cta.label} <Arrow /></Button>
    </div>
  );
}

/* --- Marquee (infinite scroll strip) --- */
export function Marquee({ items, duration = "30s", gap = 54 }: { items: ReactNode[]; duration?: string; gap?: number }) {
  return (
    <div className="marquee" style={{ ["--dur" as string]: duration } as CSSProperties}>
      <div className="marquee-track" style={{ gap }}>
        {[...items, ...items].map((it, i) => <span key={i} style={{ display: "flex" }}>{it}</span>)}
      </div>
    </div>
  );
}

/* --- Dashboard mock: bar chart --- */
export function BarsMock({ data = [0.4, 0.6, 0.45, 0.85, 0.6, 0.95, 0.7, 1] }: { data?: number[] }) {
  return (
    <div className="mock">
      <div className="mock-head"><b>Revenue overview</b><small>Last 30 days</small></div>
      <div className="bars">
        {data.map((h, i) => <span className="bar" key={i} style={{ ["--h" as string]: h } as CSSProperties} />)}
      </div>
    </div>
  );
}

/* --- Dashboard mock: progress ring --- */
export function RingMock({ label = "99.9%", deg = "356deg" }: { label?: string; deg?: string }) {
  return (
    <div className="mock">
      <div className="mock-head"><b>Uptime</b><small>Rolling 90 days</small></div>
      <div className="ring" style={{ ["--p" as string]: deg } as CSSProperties}><b>{label}</b></div>
    </div>
  );
}

/* --- Form field --- */
export function Field({
  label, id, type = "text", placeholder, textarea,
}: { label: string; id: string; type?: string; placeholder?: string; textarea?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {textarea
        ? <textarea id={id} name={id} placeholder={placeholder} />
        : <input id={id} name={id} type={type} placeholder={placeholder} />}
    </div>
  );
}
