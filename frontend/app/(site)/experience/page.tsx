"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { HugeiconsIcon } from "@hugeicons/react";
import { PaintBoardIcon, Calculator01Icon, Store01Icon, Megaphone01Icon, SourceCodeIcon } from "@hugeicons/core-free-icons";

const panels = [
  { n: "01", name: "Illusio Designs", cat: "Design & Marketing", icon: PaintBoardIcon, c: "#6d5cff" },
  { n: "02", name: "Fintranzact", cat: "Accounting SaaS", icon: Calculator01Icon, c: "#2fa36b" },
  { n: "03", name: "Kartuq", cat: "Omni-Channel SaaS", icon: Store01Icon, c: "#ff8a3d" },
  { n: "04", name: "Collabhype", cat: "Creator Collaboration", icon: Megaphone01Icon, c: "#ff5f8f" },
  { n: "05", name: "Finvera", cat: "CRM & SaaS Development", icon: SourceCodeIcon, c: "#3e60ab" },
];
const manifesto = "We design, build and ship software that feels alive — where every pixel earns its place and every interaction moves business forward.".split(" ");
const stats = [["9", "+", "Years in motion"], ["5", "", "Brands, one studio"], ["250", "+", "Products shipped"], ["40", "+", "People worldwide"]];

export default function Experience() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Experience — Finvera";
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context((self) => {
      const q = self.selector!;
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;

      // Hero kinetic headline
      gsap.from(q(".xp-hero .word"), { yPercent: 130, opacity: 0, duration: 1.1, ease: "power4.out", stagger: 0.08, delay: 0.15 });
      gsap.from(q(".xp-hero .xp-sub, .xp-hero .xp-scroll"), { y: 24, opacity: 0, duration: 1, ease: "power3.out", stagger: 0.12, delay: 0.6 });
      // Hero orb parallax
      gsap.to(q(".xp-orb"), { yPercent: 40, ease: "none", scrollTrigger: { trigger: ".xp-hero", start: "top top", end: "bottom top", scrub: true } });

      // Pinned horizontal scroll
      const track = q(".xp-track")[0] as HTMLElement;
      if (track) {
        const dist = () => track.scrollWidth - window.innerWidth;
        const horiz = gsap.to(track, {
          x: () => -dist(), ease: "none",
          scrollTrigger: { trigger: ".xp-pin", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true },
        });
        // reveal each panel's contents as it enters the viewport horizontally
        q(".xp-panel").forEach((p: Element) => {
          gsap.from((p as HTMLElement).querySelectorAll(".xp-panel-in > *"), {
            y: 44, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08,
            scrollTrigger: { trigger: p as HTMLElement, containerAnimation: horiz, start: "left 80%" },
          });
        });
      }

      // Manifesto word-by-word scrub
      gsap.to(q(".xp-manifesto .w"), {
        opacity: 1, ease: "none", stagger: 0.5,
        scrollTrigger: { trigger: ".xp-manifesto", start: "top 75%", end: "bottom 60%", scrub: true },
      });

      // Stats count + rise
      q(".xp-stat").forEach((s: Element) => {
        const el = s as HTMLElement;
        const num = el.querySelector(".xp-num") as HTMLElement;
        const target = Number(num.dataset.to || "0");
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target, duration: 1.6, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onUpdate: () => { num.firstChild!.textContent = String(Math.round(obj.v)); },
        });
        gsap.from(el, { y: 30, opacity: 0, duration: 0.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
    }, root);
    // Recalculate after fonts/layout settle
    const t = setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => { clearTimeout(t); ctx.revert(); };
  }, []);

  return (
    <div ref={root} className="xp">
      {/* Hero */}
      <section className="xp-hero">
        <span className="xp-orb" aria-hidden />
        <div className="container">
          <span className="xp-eyebrow xp-sub">Finvera Solutions LLP · The Studio</span>
          <h1 className="xp-title">
            <span className="line"><span className="word">We</span> <span className="word">make</span></span>
            <span className="line"><span className="word grad">software</span> <span className="word grad">move.</span></span>
          </h1>
          <p className="xp-sub">A premium, motion-first showcase of the group — five brands building design, software and SaaS that feels alive.</p>
          <div className="xp-scroll"><span className="xp-scroll-dot" /> Scroll to explore</div>
        </div>
      </section>

      {/* Pinned horizontal brands */}
      <section className="xp-pin">
        <div className="xp-track">
          <div className="xp-panel xp-intro">
            <div className="xp-panel-in">
              <span className="xp-eyebrow">Our ecosystem</span>
              <h2>Five brands.<br />One studio.</h2>
              <p>Scroll sideways →</p>
            </div>
          </div>
          {panels.map((p) => (
            <div className="xp-panel" key={p.name} style={{ ["--c" as string]: p.c } as React.CSSProperties}>
              <div className="xp-panel-in">
                <span className="xp-panel-n">{p.n}</span>
                <span className="xp-panel-ic"><HugeiconsIcon icon={p.icon} size={30} strokeWidth={1.8} className="hgi" /></span>
                <span className="xp-panel-cat">{p.cat}</span>
                <h3>{p.name}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Manifesto scrub */}
      <section className="xp-manifesto">
        <div className="container">
          <p>{manifesto.map((w, i) => <span className="w" key={i}>{w} </span>)}</p>
        </div>
      </section>

      {/* Stats */}
      <section className="xp-stats">
        <div className="container">
          <div className="xp-stat-grid">
            {stats.map(([n, suf, label]) => (
              <div className="xp-stat" key={label}>
                <div className="xp-num" data-to={n}>0<span>{suf}</span></div>
                <span className="xp-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="xp-cta">
        <div className="container">
          <h2>Let&apos;s make yours <span className="grad">move</span>.</h2>
          <Link href="/contact" className="btn btn-primary" data-cursor data-magnetic>Start a project →</Link>
        </div>
      </section>
    </div>
  );
}
