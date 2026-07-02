"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Chrome() {
  const [cookieVisible, setCookieVisible] = useState(false);
  const path = usePathname();

  useEffect(() => {
    const $ = (s: string, c: Document | Element = document) => c.querySelector(s);
    const $$ = (s: string, c: Document | Element = document) =>
      Array.from(c.querySelectorAll(s)) as HTMLElement[];
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cleanups: (() => void)[] = [];

    /* Preloader */
    const pre = $("#preloader");
    const hide = () => pre && pre.classList.add("done");
    const t = setTimeout(hide, reduce ? 0 : 1300);
    cleanups.push(() => clearTimeout(t));

    /* Nav scroll + progress + back-to-top (rAF-throttled, cached height) */
    const nav = $("#nav"), progress = $("#progress") as HTMLElement, toTop = $("#toTop");
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
    cleanups.push(() => { removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); });
    const toTopClick = () => scrollTo({ top: 0, behavior: "smooth" });
    toTop && toTop.addEventListener("click", toTopClick);

    /* Mobile menu */
    const burger = $("#burger");
    const burgerClick = () => {
      const open = nav!.classList.toggle("open");
      burger!.classList.toggle("open", open);
    };
    burger && burger.addEventListener("click", burgerClick);
    $$("#navLinks a").forEach((a) =>
      a.addEventListener("click", () => {
        nav && nav.classList.remove("open");
        burger && burger.classList.remove("open");
      })
    );

    /* Scroll reveal */
    const revealer = new IntersectionObserver(
      (es, o) => es.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); o.unobserve(e.target); }
      }),
      { threshold: 0.14 }
    );
    $$(".reveal, [data-split], .mock").forEach((el) => revealer.observe(el));
    cleanups.push(() => revealer.disconnect());

    /* Split headline words */
    $$("[data-split]").forEach((el) => {
      $$(".line > span", el).forEach((span) => {
        if (span.classList.contains("brace")) return;
        span.innerHTML = span.textContent!.split(" ").map((w) => `<span class="word">${w}</span>`).join(" ");
      });
      $$(".word", el).forEach((w, i) => (w.style.transitionDelay = 0.2 + i * 0.08 + "s"));
    });

    /* Count-up */
    const countUp = (el: HTMLElement) => {
      const target = +el.dataset.count!, suffix = el.dataset.suffix || "", dur = 1500, start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const counter = new IntersectionObserver(
      (es, o) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target as HTMLElement); o.unobserve(e.target); } }),
      { threshold: 0.6 }
    );
    $$("[data-count]").forEach((el) => counter.observe(el));
    cleanups.push(() => counter.disconnect());

    /* Mock bars */
    const mockObs = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
      { threshold: 0.3 }
    );
    $$(".mock").forEach((m) => mockObs.observe(m));
    cleanups.push(() => mockObs.disconnect());

    /* Staggered code lines */
    $$("#codeBlock .ln").forEach((ln, i) => (ln.style.animationDelay = 1.4 + i * 0.06 + "s"));

    if (!reduce) {
      /* Custom cursor */
      const dot = $("#cDot") as HTMLElement, ring = $("#cRing") as HTMLElement, spot = $("#spotlight") as HTMLElement;
      let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, raf = 0;
      const move = (e: MouseEvent) => {
        mx = e.clientX; my = e.clientY;
        if (dot) dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
        if (spot) spot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
      };
      addEventListener("mousemove", move, { passive: true });
      const loop = () => {
        rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
        if (ring) ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
        raf = requestAnimationFrame(loop);
      };
      loop();
      cleanups.push(() => { removeEventListener("mousemove", move); cancelAnimationFrame(raf); });
      $$("[data-cursor], a, button").forEach((el) => {
        el.addEventListener("mouseenter", () => { dot?.classList.add("hover"); ring?.classList.add("hover"); });
        el.addEventListener("mouseleave", () => { dot?.classList.remove("hover"); ring?.classList.remove("hover"); });
      });

      /* Magnetic buttons */
      $$("[data-magnetic]").forEach((btn) => {
        btn.addEventListener("mousemove", (e) => {
          const ev = e as MouseEvent, r = btn.getBoundingClientRect();
          btn.style.transform = `translate(${(ev.clientX - r.left - r.width / 2) * 0.28}px, ${(ev.clientY - r.top - r.height / 2) * 0.4}px)`;
        });
        btn.addEventListener("mouseleave", () => (btn.style.transform = ""));
      });

      /* Card tilt + spotlight (rect cached on enter, writes batched in rAF) */
      $$(".card[data-tilt]").forEach((card) => {
        let rect: DOMRect | null = null, frame = 0, lx = 0, ly = 0;
        card.addEventListener("mouseenter", () => { rect = card.getBoundingClientRect(); card.style.willChange = "transform"; });
        card.addEventListener("mousemove", (e) => {
          const ev = e as MouseEvent; if (!rect) rect = card.getBoundingClientRect();
          lx = ev.clientX; ly = ev.clientY;
          if (!frame) frame = requestAnimationFrame(() => {
            frame = 0; const r = rect!;
            const px = (lx - r.left) / r.width, py = (ly - r.top) / r.height;
            card.style.setProperty("--mx", px * 100 + "%");
            card.style.setProperty("--my", py * 100 + "%");
            card.style.transform = `translateY(-6px) perspective(900px) rotateY(${(px - 0.5) * 6}deg) rotateX(${(0.5 - py) * 6}deg)`;
          });
        });
        card.addEventListener("mouseleave", () => {
          rect = null; if (frame) { cancelAnimationFrame(frame); frame = 0; }
          card.style.transform = ""; card.style.willChange = "";
        });
      });

      /* Hero code-card parallax (rect cached, rAF-batched) */
      const tilt = $("#tiltCard") as HTMLElement, hero = $("#home");
      if (tilt && hero) {
        let hr: DOMRect | null = null, hf = 0, hx = 0, hy = 0;
        hero.addEventListener("mouseenter", () => { hr = hero.getBoundingClientRect(); });
        hero.addEventListener("mousemove", (e) => {
          const ev = e as MouseEvent; if (!hr) hr = hero.getBoundingClientRect();
          hx = ev.clientX; hy = ev.clientY;
          if (!hf) hf = requestAnimationFrame(() => {
            hf = 0; const r = hr!;
            const x = (hx - r.left) / r.width - 0.5, y = (hy - r.top) / r.height - 0.5;
            tilt.style.transform = `perspective(1000px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
          });
        });
        hero.addEventListener("mouseleave", () => { hr = null; if (hf) { cancelAnimationFrame(hf); hf = 0; } tilt.style.transform = ""; });
      }
    }

    /* Ripple */
    $$(".btn").forEach((btn) =>
      btn.addEventListener("click", function (this: HTMLElement, e) {
        const ev = e as MouseEvent, r = this.getBoundingClientRect();
        const s = document.createElement("span"), size = Math.max(r.width, r.height);
        s.className = "ripple";
        s.style.width = s.style.height = size + "px";
        s.style.left = ev.clientX - r.left - size / 2 + "px";
        s.style.top = ev.clientY - r.top - size / 2 + "px";
        this.appendChild(s);
        setTimeout(() => s.remove(), 600);
      })
    );

    /* FAQ accordion */
    $$(".qa").forEach((qa) => {
      const q = $(".q", qa)!, a = $(".a", qa) as HTMLElement;
      q.addEventListener("click", () => {
        const open = qa.classList.contains("open");
        $$(".qa").forEach((o) => { o.classList.remove("open"); ($(".a", o) as HTMLElement).style.maxHeight = ""; });
        if (!open) { qa.classList.add("open"); a.style.maxHeight = a.scrollHeight + "px"; }
      });
    });

    /* Contact form */
    const cf = $("#contactForm") as HTMLFormElement | null;
    if (cf) cf.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = $("#formOk") as HTMLElement | null;
      if (ok) { ok.style.display = "flex"; cf.reset(); }
    });

    /* Cookie banner */
    if (!localStorage.getItem("fv_cookie")) {
      const ct = setTimeout(() => setCookieVisible(true), 2000);
      cleanups.push(() => clearTimeout(ct));
    }

    return () => cleanups.forEach((c) => c());
  }, [path]);

  const closeCookie = (v: string) => {
    localStorage.setItem("fv_cookie", v);
    setCookieVisible(false);
  };

  return (
    <>
      {/* Preloader */}
      <div className="preloader" id="preloader">
        <svg className="pl-logo" viewBox="0 0 500 500" aria-hidden="true">
          <path d="M373.84,139.28l-21.55,34.52c-5.45,8.73-15.02,14.04-25.32,14.04h-70.66c-9.84,0-19.05,4.85-24.61,12.96l-13.88,20.24c-2.58,3.76.11,8.87,4.67,8.87h78.23c5.94,0,9.57,6.52,6.44,11.56l-24.98,40.36c-3.98,6.42-10.99,10.3-18.54,10.35-18.65.13-77.19,35.69-129.05,78.71-5.11,4.24-12.19-2-8.62-7.6l68.97-108.08c6.53-10.23-.78-23.65-12.92-23.71l-29.97-.15c-5.96-.03-9.55-6.61-6.36-11.64l34.51-54.37c14.87-23.42,40.67-37.61,68.41-37.63l118.79-.06c5.95,0,9.58,6.54,6.43,11.59Z" />
        </svg>
        <div className="pl-bar" />
      </div>

      {/* Backdrop FX with waterfall beam */}
      <div className="fx" aria-hidden="true">
        <div className="grid" />
        <div className="beam-wrap">
          <div className="cone" />
          <div className="core" />
          <div className="streaks" />
          <div className="streaks s2" />
        </div>
        <div className="orb a" />
        <div className="orb b" />
      </div>

      <div className="spotlight" id="spotlight" />
      <div className="cursor-ring" id="cRing" />
      <div className="cursor-dot" id="cDot" />
      <div className="progress" id="progress" />

      {/* Cookie banner */}
      <div className={"cookie" + (cookieVisible ? " show" : "")} id="cookie">
        <div className="ic">🍪</div>
        <p>We use cookies to enhance your browsing experience, analyze traffic, and improve our services.</p>
        <div className="ck-actions">
          <button className="btn btn-ghost" onClick={() => closeCookie("declined")} data-cursor>Decline</button>
          <button className="btn btn-primary" onClick={() => closeCookie("accepted")} data-cursor>Accept</button>
        </div>
      </div>

      <button className="to-top" id="toTop" aria-label="Back to top">
        <svg viewBox="0 0 24 24" width={19} fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </>
  );
}
