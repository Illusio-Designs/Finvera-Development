"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * SmoothScroll
 *
 * Initializes Lenis smooth/inertia scrolling and syncs it with GSAP
 * ScrollTrigger. Native scroll is preserved for touch devices and when the
 * user prefers reduced motion. The whole setup is guarded so a Lenis
 * import/runtime failure can never crash the app.
 */
export default function SmoothScroll(): null {
  useEffect(() => {
    // Respect reduced-motion and keep native scroll on touch devices.
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }

    let lenis: Lenis | null = null;
    let raf: ((time: number) => void) | null = null;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      gsap.registerPlugin(ScrollTrigger);

      lenis = new Lenis({ duration: 1.1, smoothWheel: true });

      lenis.on("scroll", ScrollTrigger.update);

      raf = (time: number) => {
        lenis?.raf(time * 1000);
      };

      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);

      refreshTimeout = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 300);
    } catch (err) {
      // Never let a Lenis/GSAP failure take down the app.
      // eslint-disable-next-line no-console
      console.error("SmoothScroll initialization failed:", err);
    }

    return () => {
      try {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        if (raf) gsap.ticker.remove(raf);
        lenis?.destroy();
        gsap.ticker.lagSmoothing(500, 33);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("SmoothScroll cleanup failed:", err);
      }
    };
  }, []);

  return null;
}
