"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export default function Chrome() {
  const [cookieVisible, setCookieVisible] = useState(false);
  const path = usePathname();

  /* ---- Global chrome: bound ONCE (persistent elements) ---- */
  useEffect(() => {
    const $ = (s: string, c: Document | Element = document) => c.querySelector(s) as HTMLElement | null;
    const $$ = (s: string) => Array.from(document.querySelectorAll(s)) as HTMLElement[];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    /* Preloader */
    const pre = $("#preloader");
    const t = setTimeout(() => pre && pre.classList.add("done"), reduce ? 0 : 1300);
    cleanups.push(() => clearTimeout(t));

    /* Nav scroll + progress + back-to-top */
    const nav = $("#nav"), progress = $("#progress"), toTop = $("#toTop");
    let maxScroll = document.documentElement.scrollHeight - innerHeight;
    let ticking = false;
    const applyScroll = () => {
      ticking = false;
      const y = scrollY;
      nav && nav.classList.toggle("scrolled", y > 30);
      if (progress) progress.style.transform = `scaleX(${maxScroll > 0 ? Math.min(y / maxScroll, 1) : 0})`;
      toTop && toTop.classList.toggle("show", y > 700);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); } };
    const onResize = () => { maxScroll = document.documentElement.scrollHeight - innerHeight; };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onResize, { passive: true });
    applyScroll();
    const toTopClick = () => scrollTo({ top: 0, behavior: "smooth" });
    toTop?.addEventListener("click", toTopClick);
    cleanups.push(() => { removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); toTop?.removeEventListener("click", toTopClick); });

    /* Mobile menu (burger) */
    const burger = $("#burger");
    const toggleMenu = () => {
      const open = nav?.classList.toggle("open");
      burger?.classList.toggle("open", !!open);
    };
    burger?.addEventListener("click", toggleMenu);
    const closeMenu = (e: Event) => {
      if ((e.target as HTMLElement).closest("#navLinks a")) { nav?.classList.remove("open"); burger?.classList.remove("open"); }
    };
    document.addEventListener("click", closeMenu);
    cleanups.push(() => { burger?.removeEventListener("click", toggleMenu); document.removeEventListener("click", closeMenu); });

    /* Smooth in-page scroll (delegated) */
    const onAnchor = (e: Event) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute("href") || "";
      if (id.length > 1) { const el = $(id); if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth" }); } }
    };
    document.addEventListener("click", onAnchor);
    cleanups.push(() => document.removeEventListener("click", onAnchor));

    /* Ripple (delegated) */
    const onRipple = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest(".btn") as HTMLElement | null;
      if (!btn) return;
      const r = btn.getBoundingClientRect(), s = document.createElement("span"), size = Math.max(r.width, r.height);
      s.className = "ripple";
      s.style.width = s.style.height = size + "px";
      s.style.left = e.clientX - r.left - size / 2 + "px";
      s.style.top = e.clientY - r.top - size / 2 + "px";
      btn.appendChild(s); setTimeout(() => s.remove(), 600);
    };
    document.addEventListener("click", onRipple);
    cleanups.push(() => document.removeEventListener("click", onRipple));

    /* Custom cursor (delegated hover) */
    if (!reduce && !matchMedia("(pointer: coarse)").matches) {
      const dot = $("#cDot"), ring = $("#cRing"), spot = $("#spotlight");
      let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, raf = 0;
      const move = (e: MouseEvent) => {
        mx = e.clientX; my = e.clientY;
        if (dot) dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
        if (spot) spot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      };
      addEventListener("mousemove", move, { passive: true });
      const loop = () => { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; if (ring) ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`; raf = requestAnimationFrame(loop); };
      loop();
      const hoverSel = "[data-cursor], a, button, input, textarea, select";
      const onOver = (e: Event) => { if ((e.target as HTMLElement).closest(hoverSel)) { dot?.classList.add("hover"); ring?.classList.add("hover"); } };
      const onOut = (e: Event) => { if ((e.target as HTMLElement).closest(hoverSel)) { dot?.classList.remove("hover"); ring?.classList.remove("hover"); } };
      document.addEventListener("mouseover", onOver);
      document.addEventListener("mouseout", onOut);
      cleanups.push(() => { removeEventListener("mousemove", move); cancelAnimationFrame(raf); document.removeEventListener("mouseover", onOver); document.removeEventListener("mouseout", onOut); });
    }

    /* Cookie banner */
    if (!localStorage.getItem("fv_cookie")) {
      const ct = setTimeout(() => setCookieVisible(true), 2000);
      cleanups.push(() => clearTimeout(ct));
    }

    return () => cleanups.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Per-page interactions: re-run on navigation ---- */
  useEffect(() => {
    const $$ = (s: string, c: Document | Element = document) => Array.from(c.querySelectorAll(s)) as HTMLElement[];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    /* Scroll reveal — GSAP premium: grouped stagger + gentle parallax */
    if (reduce) {
      $$(".reveal, [data-split], .mock").forEach((el) => el.classList.add("in"));
    } else {
      const triggers = ScrollTrigger.batch(".reveal, [data-split], .mock", {
        start: "top 88%",
        once: true,
        onEnter: (els) => (els as HTMLElement[]).forEach((el, i) => { const d = setTimeout(() => el.classList.add("in"), i * 80); cleanups.push(() => clearTimeout(d)); }),
      });
      cleanups.push(() => triggers.forEach((t) => t.kill()));

      /* Parallax accents — depth on decorative media */
      $$("[data-parallax], .about-media, .hero-card, .code-window").forEach((el) => {
        const tw = gsap.to(el, { yPercent: -9, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: 0.6 } });
        cleanups.push(() => { tw.scrollTrigger?.kill(); tw.kill(); });
      });

      requestAnimationFrame(() => ScrollTrigger.refresh());
    }

    /* Split headline words */
    $$("[data-split]").forEach((el) => {
      $$(".line > span", el).forEach((span) => {
        if (span.classList.contains("brace") || span.querySelector(".word")) return;
        span.innerHTML = span.textContent!.split(" ").map((w) => `<span class="word">${w}</span>`).join(" ");
      });
      $$(".word", el).forEach((w, i) => (w.style.transitionDelay = 0.2 + i * 0.08 + "s"));
    });

    /* Count-up */
    const counter = new IntersectionObserver((es, o) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement, target = +el.dataset.count!, suffix = el.dataset.suffix || "", start = performance.now();
      const tick = (now: number) => { const p = Math.min((now - start) / 1500, 1), k = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(target * k) + suffix; if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick); o.unobserve(el);
    }), { threshold: 0.6 });
    $$("[data-count]").forEach((el) => counter.observe(el));
    cleanups.push(() => counter.disconnect());

    /* Staggered code lines */
    $$("#codeBlock .ln").forEach((ln, i) => (ln.style.animationDelay = 1.4 + i * 0.06 + "s"));

    if (!reduce && !matchMedia("(pointer: coarse)").matches) {
      /* Magnetic buttons */
      $$("[data-magnetic]").forEach((btn) => {
        const mm = (e: Event) => { const ev = e as MouseEvent, r = btn.getBoundingClientRect(); btn.style.transform = `translate(${(ev.clientX - r.left - r.width / 2) * 0.28}px, ${(ev.clientY - r.top - r.height / 2) * 0.4}px)`; };
        const ml = () => (btn.style.transform = "");
        btn.addEventListener("mousemove", mm); btn.addEventListener("mouseleave", ml);
        cleanups.push(() => { btn.removeEventListener("mousemove", mm); btn.removeEventListener("mouseleave", ml); });
      });
      /* Card tilt */
      $$(".card[data-tilt]").forEach((card) => {
        let rect: DOMRect | null = null, frame = 0, lx = 0, ly = 0;
        const enter = () => { rect = card.getBoundingClientRect(); card.style.willChange = "transform"; };
        const mm = (e: Event) => {
          const ev = e as MouseEvent; if (!rect) rect = card.getBoundingClientRect();
          lx = ev.clientX; ly = ev.clientY;
          if (!frame) frame = requestAnimationFrame(() => { frame = 0; const r = rect!; const px = (lx - r.left) / r.width, py = (ly - r.top) / r.height; card.style.setProperty("--mx", px * 100 + "%"); card.style.setProperty("--my", py * 100 + "%"); card.style.transform = `translateY(-6px) perspective(900px) rotateY(${(px - .5) * 6}deg) rotateX(${(.5 - py) * 6}deg)`; });
        };
        const leave = () => { rect = null; if (frame) { cancelAnimationFrame(frame); frame = 0; } card.style.transform = ""; card.style.willChange = ""; };
        card.addEventListener("mouseenter", enter); card.addEventListener("mousemove", mm); card.addEventListener("mouseleave", leave);
        cleanups.push(() => { card.removeEventListener("mouseenter", enter); card.removeEventListener("mousemove", mm); card.removeEventListener("mouseleave", leave); });
      });
      /* Hero code-card parallax */
      const tilt = document.querySelector("#tiltCard") as HTMLElement | null, hero = document.querySelector("#home") as HTMLElement | null;
      if (tilt && hero) {
        let hr: DOMRect | null = null, hf = 0, hx = 0, hy = 0;
        const enter = () => { hr = hero.getBoundingClientRect(); };
        const mm = (e: Event) => { const ev = e as MouseEvent; if (!hr) hr = hero.getBoundingClientRect(); hx = ev.clientX; hy = ev.clientY; if (!hf) hf = requestAnimationFrame(() => { hf = 0; const r = hr!; const x = (hx - r.left) / r.width - .5, y = (hy - r.top) / r.height - .5; tilt.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`; }); };
        const leave = () => { hr = null; if (hf) { cancelAnimationFrame(hf); hf = 0; } tilt.style.transform = ""; };
        hero.addEventListener("mouseenter", enter); hero.addEventListener("mousemove", mm); hero.addEventListener("mouseleave", leave);
        cleanups.push(() => { hero.removeEventListener("mouseenter", enter); hero.removeEventListener("mousemove", mm); hero.removeEventListener("mouseleave", leave); });
      }
    }

    /* FAQ accordion */
    $$(".qa").forEach((qa) => {
      const q = qa.querySelector(".q") as HTMLElement, a = qa.querySelector(".a") as HTMLElement;
      const click = () => { const open = qa.classList.contains("open"); $$(".qa").forEach((o) => { o.classList.remove("open"); (o.querySelector(".a") as HTMLElement).style.maxHeight = ""; }); if (!open) { qa.classList.add("open"); a.style.maxHeight = a.scrollHeight + "px"; } };
      q.addEventListener("click", click);
      cleanups.push(() => q.removeEventListener("click", click));
    });

    return () => cleanups.forEach((c) => c());
  }, [path]);

  const closeCookie = (v: string) => { localStorage.setItem("fv_cookie", v); setCookieVisible(false); };

  return (
    <>
      <div className="preloader" id="preloader">
        <svg className="pl-logo" viewBox="0 0 500 500" aria-hidden="true">
          <path d="M373.84,139.28l-21.55,34.52c-5.45,8.73-15.02,14.04-25.32,14.04h-70.66c-9.84,0-19.05,4.85-24.61,12.96l-13.88,20.24c-2.58,3.76.11,8.87,4.67,8.87h78.23c5.94,0,9.57,6.52,6.44,11.56l-24.98,40.36c-3.98,6.42-10.99,10.3-18.54,10.35-18.65.13-77.19,35.69-129.05,78.71-5.11,4.24-12.19-2-8.62-7.6l68.97-108.08c6.53-10.23-.78-23.65-12.92-23.71l-29.97-.15c-5.96-.03-9.55-6.61-6.36-11.64l34.51-54.37c14.87-23.42,40.67-37.61,68.41-37.63l118.79-.06c5.95,0,9.58,6.54,6.43,11.59Z" />
        </svg>
        <div className="pl-bar" />
      </div>

      <div className="fx" aria-hidden="true">
        <div className="grid" />
        <div className="beam-wrap"><div className="cone" /><div className="core" /><div className="streaks" /><div className="streaks s2" /></div>
        <div className="orb a" /><div className="orb b" />
      </div>

      <div className="spotlight" id="spotlight" />
      <div className="cursor-ring" id="cRing" />
      <div className="cursor-dot" id="cDot" />
      <div className="progress" id="progress" />

      <div className={"cookie" + (cookieVisible ? " show" : "")} id="cookie">
        <div className="ic">🍪</div>
        <p>We use cookies to enhance your browsing experience, analyze traffic, and improve our services.</p>
        <div className="ck-actions">
          <button className="btn btn-ghost" onClick={() => closeCookie("declined")} data-cursor>Decline</button>
          <button className="btn btn-primary" onClick={() => closeCookie("accepted")} data-cursor>Accept</button>
        </div>
      </div>

      <button className="to-top" id="toTop" aria-label="Back to top">
        <svg viewBox="0 0 24 24" width={19} fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
      </button>
    </>
  );
}
