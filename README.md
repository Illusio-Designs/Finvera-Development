# Finvera — SaaS & CRM Development Agency

A modern, animation-rich marketing website for **Finvera**, a SaaS & CRM development company.
Built as a fast, dependency-free static site using the Finvera brand kit (logo, blue gradient
`#3e60ab → #243a75`, Poppins + Anton typography).

![Finvera hero](assets/logo-white.png)

## ✨ Highlights

- **Dark, premium, agency-grade design** inspired by top-tier SaaS landing pages.
- **On-brand** — uses the official Finvera logo mark, colours and fonts.
- **Rich animations & micro-interactions**, all hand-built with vanilla JS + CSS:
  - Logo-draw preloader with progress bar
  - Aurora light beam, animated grid, glowing orbs backdrop
  - Custom cursor (dot + trailing ring) with hover states + spotlight
  - Scroll progress bar and animated back-to-top
  - Scroll-reveal with staggered word-by-word headline animation
  - Animated count-up statistics
  - Magnetic buttons + click ripples
  - 3D tilt + spotlight on cards, parallax hero code-card
  - Typed/staggered code snippet
  - Infinite logo & testimonial marquees
  - Monthly/Yearly pricing toggle
  - FAQ accordion, glass navbar with scrollspy, mobile menu
  - Cookie consent banner (with `localStorage` memory)
- **Fully responsive** and respects `prefers-reduced-motion`.

## 📁 Structure

```
index.html            # single-page site (all sections)
assets/
  css/style.css       # design system + components + animations
  js/main.js          # all interactions & micro-animations
  favicon.svg / .png  # Finvera mark
  logo-full.svg       # full Finvera lockup
```

## 🚀 Run locally

No build step required — it's a static site.

```bash
# any static server, e.g.
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## 🌐 Deploy

Works out of the box on **GitHub Pages**, Netlify, Vercel or any static host —
just serve the repository root.

---

Brand: **Finvera** · Colours `#3e60ab` / `#243a75` · Fonts Poppins + Anton (Agency).
