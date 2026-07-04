"use client";
import { useEffect, useRef } from "react";
import ContentIcon from "@/components/contentIcon";
import type { Brand } from "@/lib/types";

/* Horizontal brand ecosystem — the /experience effect, but built on native
   position:sticky + scroll-progress instead of a GSAP pin. The track's x is
   derived directly from the real scroll position each frame, so the sideways
   motion is ALWAYS in lock-step with the page scroll (no ScrollTrigger drift).
   On touch / reduced-motion it falls back to a horizontal swipe strip. */
const COLORS = ["#6d5cff", "#2fa36b", "#ff8a3d", "#ff5f8f", "#3e60ab", "#0ea5e9"];

export default function BrandShowcase({ brands }: { brands: Brand[] }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current, track = trackRef.current;
    if (!outer || !track) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = matchMedia("(pointer: coarse)").matches;
    if (reduce || coarse) { outer.style.height = ""; track.style.transform = ""; return; } // CSS swipe fallback

    let dist = 0, scrollable = 0, raf = 0;
    const measure = () => {
      dist = Math.max(0, track.scrollWidth - window.innerWidth);
      // Make the section as tall as the horizontal travel so 1px of vertical
      // scroll == 1px of horizontal movement — an exact match to the page.
      outer.style.height = window.innerHeight + dist + "px";
      scrollable = Math.max(1, outer.offsetHeight - window.innerHeight);
    };
    const apply = () => {
      raf = 0;
      const top = outer.getBoundingClientRect().top;
      const p = Math.min(Math.max(-top / scrollable, 0), 1);
      track.style.transform = `translate3d(${(-p * dist).toFixed(2)}px,0,0)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    const onResize = () => { measure(); apply(); };

    measure(); apply();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize, { passive: true });
    addEventListener("load", onResize);
    const t = setTimeout(onResize, 400); // re-measure after fonts/layout settle
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onResize);
      removeEventListener("load", onResize);
      clearTimeout(t); cancelAnimationFrame(raf);
      outer.style.height = ""; track.style.transform = "";
    };
  }, [brands.length]);

  const panel = (b: Brand, i: number) => {
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
  };

  return (
    <div className="xp-sticky-outer" ref={outerRef}>
      <div className="xp-sticky">
        <div className="xp-track" ref={trackRef}>
          <div className="xp-panel xp-intro">
            <div className="xp-panel-in">
              <span className="xp-eyebrow">Our ecosystem</span>
              <h2>Five brands.<br />One studio.</h2>
              <p>Scroll sideways →</p>
            </div>
          </div>
          {brands.map(panel)}
        </div>
      </div>
    </div>
  );
}
