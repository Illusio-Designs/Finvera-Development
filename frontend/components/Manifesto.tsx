"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/* Manifesto scrub band — the /experience word-by-word reveal, reusable on any
   public page. Words start faded and light up as the section scrolls through. */
export default function Manifesto({ text }: { text: string }) {
  const root = useRef<HTMLDivElement>(null);
  const words = text.split(" ");

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = root.current;
    if (!el) return;
    if (reduce) { el.querySelectorAll<HTMLElement>(".w").forEach((w) => (w.style.opacity = "1")); return; }

    const ctx = gsap.context((self) => {
      gsap.to(self.selector!(".w"), {
        opacity: 1, ease: "none", stagger: 0.5,
        scrollTrigger: { trigger: el, start: "top 75%", end: "bottom 60%", scrub: true },
      });
    }, root);
    const t = setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => { clearTimeout(t); ctx.revert(); };
  }, []);

  return (
    <section className="xp-manifesto" ref={root}>
      <div className="container">
        <p>{words.map((w, i) => <span className="w" key={i}>{w}</span>)}</p>
      </div>
    </section>
  );
}
