# Finvera — SaaS & CRM Development Agency

A modern, animation-rich marketing website for **Finvera**, a SaaS & CRM development
company. Built with **Next.js (App Router) + TypeScript**, using the Finvera brand kit
(logo, blue gradient `#3e60ab → #243a75`, Poppins + Anton typography).

This is a monorepo:

- [`frontend/`](frontend) — the Next.js website (App Router + TypeScript).
- [`Backendjs/`](Backendjs) — a Node/Express + **MySQL** REST API that manages all
  content (projects, services, testimonials, team, blog, contact submissions,
  per‑page SEO and analytics/pixel settings) with admin auth and image uploads.
  See [`Backendjs/README.md`](Backendjs/README.md).

## Deployment

- **Frontend** → **Vercel** (auto-deploys on push to `main`, Root Directory `frontend`).
- **Backend** → **GitHub Actions → FTP** (`.github/workflows/backend-deploy.yml`, deploys `Backendjs/` on push to the `backend` branch).

See [`DEPLOY.md`](DEPLOY.md) for the exact secrets / env vars to add (with example values).

## ✨ Highlights

- **Dark, premium, agency-grade design** inspired by top-tier SaaS landing pages.
- **On-brand** — official Finvera logo mark, colours and self-hosted fonts (`next/font`).
- **Multi-page site**: Home, About, Services, Solutions, Work, Contact.
- **Blue "waterfall" light beam** backdrop with animated falling streaks.
- **Rich animations & micro-interactions** (vanilla, no animation library):
  - Logo-draw preloader, aurora/grid/orb backdrop
  - Custom cursor (dot + trailing ring) + spotlight
  - Scroll progress bar, animated back-to-top
  - Scroll reveals, word-by-word headline animation
  - Animated count-up stats, magnetic buttons, click ripples
  - 3D tilt + spotlight cards, parallax hero code-card
  - Staggered code typing, infinite marquees
  - FAQ accordion, glass navbar with active route, mobile menu
  - Cookie consent (remembered via `localStorage`)
- Fully responsive and respects `prefers-reduced-motion`.

## 🧱 Tech stack

- [Next.js 15](https://nextjs.org) (App Router)
- React 18 + TypeScript
- `next/font` (self-hosted Poppins, Anton, Fira Code)
- Plain CSS design system (`app/globals.css`) — no CSS framework

## 📁 Structure

```
frontend/
  app/
    layout.tsx        # root layout: fonts, Nav, Footer, Chrome
    globals.css       # design system + components + animations
    page.tsx          # Home
    about/page.tsx
    services/page.tsx
    solutions/page.tsx
    work/page.tsx
    contact/page.tsx
    favicon.ico
  components/
    Nav.tsx  Footer.tsx  Chrome.tsx   # chrome + all client interactions
    LogoDefs.tsx  icons.tsx
  public/               # brand assets (logo, favicon)
```

## 🚀 Getting started

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

---

Brand: **Finvera** · Colours `#3e60ab` / `#243a75` · Fonts Poppins + Anton.
