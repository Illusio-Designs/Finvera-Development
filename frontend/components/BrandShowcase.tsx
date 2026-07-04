"use client";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ContentIcon from "@/components/contentIcon";
import type { Brand } from "@/lib/types";

/* Pinned horizontal-scroll brand ecosystem — the /experience effect, reusable.
   On coarse-pointer / reduced-motion it gracefully falls back to a normal
   horizontal swipe strip (no pin). */
const COLORS = ["#6d5cff", "#2fa36b", "#ff8a3d", "#ff5f8f", "#3e60ab", "#0ea5e9"];

export default function BrandShowcase({ brands }: { brands: Brand[] }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) return; // CSS fallback = horizontal swipe strip

    const ctx = gsap.context((self) => {
      const q = self.selector!;
      const track = q(".xp-track")[0] as HTMLElement;
      if (!track) return;
      const dist = () => track.scrollWidth - window.innerWidth;
      const horiz = gsap.to(track, {
        x: () => -dist(), ease: "none",
        scrollTrigger: { trigger: ".xp-pin", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true },
      });
      q(".xp-panel").forEach((p: Element) => {
        gsap.from((p as HTMLElement).querySelectorAll(".xp-panel-in > *"), {
          y: 44, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08,
          scrollTrigger: { trigger: p as HTMLElement, containerAnimation: horiz, start: "left 80%" },
        });
      });
    }, root);
    const t = setTimeout(() => ScrollTrigger.refresh(), 300);
    return () => { clearTimeout(t); ctx.revert(); };
  }, [brands.length]);

  return (
    <div ref={root} className="xp-pin xp-embed">
      <div className="xp-track">
        <div className="xp-panel xp-intro">
          <div className="xp-panel-in">
            <span className="xp-eyebrow">Our ecosystem</span>
            <h2>Five brands.<br />One studio.</h2>
            <p>Scroll sideways →</p>
          </div>
        </div>
        {brands.map((b, i) => {
          const color = COLORS[i % COLORS.length];
          const inner = (
            <div className="xp-panel-in">
              <span className="xp-panel-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="xp-panel-ic"><ContentIcon name={b.icon} size={30} /></span>
              <span className="xp-panel-cat">{b.category}</span>
              <h3>{b.name}</h3>
              {b.url && <span className="xp-panel-go">Visit site →</span>}
            </div>
          );
          const style = { ["--c" as string]: color } as React.CSSProperties;
          return b.url ? (
            <a className="xp-panel is-link" key={b.id} style={style} href={b.url} target="_blank" rel="noopener noreferrer" data-cursor>{inner}</a>
          ) : (
            <div className="xp-panel" key={b.id} style={style}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
