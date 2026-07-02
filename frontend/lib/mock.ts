/* =========================================================
   Mock data — mirrors the backend API response shapes.
   Used as a fallback when API_URL is not set / unreachable,
   so the site fully works before the backend is deployed.
   ========================================================= */

export type Project = {
  id: number; title: string; slug: string; category: string; url: string;
  tags: string[]; blurb: string; content?: string;
  desktopImage: string | null; mobileImage: string | null; coverImage: string | null;
  featured: boolean; status: string;
};
export type Service = { id: number; title: string; slug: string; icon: string; description: string };
export type Testimonial = { id: number; name: string; role: string; company: string; avatar: string; quote: string; rating: number };
export type TeamMember = { id: number; name: string; role: string; initials: string; bio: string };
export type BlogPost = {
  id: number; title: string; slug: string; excerpt: string; content: string;
  coverImage: string | null; author: string; category: string; tags: string[];
  status: string; publishedAt: string | null;
  seoTitle?: string; seoDescription?: string; seoKeywords?: string;
};
export type Seo = { page: string; title: string; description: string; keywords?: string; ogImage?: string; noindex?: boolean };
export type Settings = Record<string, string>;

const p = (id: number, title: string, slug: string, category: string, url: string, tags: string[], blurb: string, featured = false): Project =>
  ({ id, title, slug, category, url, tags, blurb, content: "", desktopImage: null, mobileImage: null, coverImage: null, featured, status: "published" });

export const projects: Project[] = [
  p(1, "Antimatter AI", "antimatter-ai", "AI · SaaS", "https://www.antimatterai.com/", ["Web Design", "Development", "AI"], "A fast, modern marketing site for an AI product studio — built for clarity, motion and conversion.", true),
  p(2, "Finvera Solutions", "finvera-solutions", "Fintech · SaaS", "https://www.finvera.solutions/", ["Fintech", "Web Design", "Development"], "The Finvera platform website — accounting and finance, presented with a clean, trustworthy interface.", true),
  p(3, "Stallion Eyewear", "stallion-eyewear", "B2B · E-commerce", "https://b2b.stallioneyewear.in/", ["E-commerce", "B2B", "Development"], "A B2B ordering portal for a fast-growing eyewear brand, streamlining wholesale purchasing.", true),
  p(4, "CrossCoin", "crosscoin", "Fintech", "https://crosscoin.in/", ["Fintech", "Web Design", "Development"], "A sleek, secure-feeling fintech platform interface designed to build instant trust."),
  p(5, "Nanak Finserv", "nanak-finserv", "Financial Services", "https://nanakfinserv.com/", ["Finance", "Web Design"], "A professional web presence for a financial services firm, focused on credibility and clarity."),
  p(6, "Velmique", "velmique", "E-commerce · Brand", "https://www.velmique.co.in/", ["E-commerce", "Branding", "Development"], "An elegant brand storefront with a refined, mobile-first shopping experience."),
  p(7, "Knitwink", "knitwink", "Brand Website", "https://www.knitwink.com/", ["Web Design", "Development"], "A polished, content-driven website crafted to bring the Knitwink brand to life online."),
  p(8, "Volterra Tiles", "volterra-tiles", "Content · Editorial", "https://volterratiles.com.au/blog", ["Content", "SEO", "Development"], "An editorial blog and content platform for a premium Australian tiles brand."),
  p(9, "Amrutkumar Govinddas LLP", "amrutkumar-govinddas-llp", "Corporate", "https://amrutkumargovinddasllp.com/", ["Corporate", "Web Design"], "A clean, professional corporate website for an established LLP."),
  p(10, "Aqalite", "aqalite", "Product Website", "https://aqalite.co.nz/", ["Web Design", "Development"], "A crisp product website for a New Zealand building-products brand."),
  p(11, "Nishree", "nishree", "Brand Website", "https://nishree.vercel.app/", ["Web Design", "Next.js"], "A fast, minimal brand site deployed on Vercel with a focus on performance."),
];

export const services: Service[] = [
  { id: 1, title: "SaaS Development", slug: "saas-development", icon: "saas", description: "Multi-tenant, subscription-ready platforms built for scale — billing, auth, dashboards and everything in between." },
  { id: 2, title: "CRM Solutions", slug: "crm-solutions", icon: "crm", description: "Custom CRM engines with smart pipelines, lead scoring, and automations tailored to how your team actually sells." },
  { id: 3, title: "Cloud & DevOps", slug: "cloud-devops", icon: "cloud", description: "Zero-downtime infrastructure, CI/CD pipelines and observability so you can ship confidently, every single day." },
  { id: 4, title: "API & Integrations", slug: "api-integrations", icon: "api", description: "Connect your stack — payments, messaging, analytics and 3rd-party tools — with resilient, well-documented APIs." },
  { id: 5, title: "UI/UX Design", slug: "ui-ux-design", icon: "design", description: "Interfaces people love — research-driven, pixel-perfect, and engineered with motion that feels effortless." },
  { id: 6, title: "AI Automation", slug: "ai-automation", icon: "ai", description: "Embed intelligence into your product — copilots, predictions and workflow automation that save real hours." },
];

export const testimonials: Testimonial[] = [
  { id: 1, name: "Aisha Khan", role: "CEO", company: "Orbital", avatar: "AK", quote: "Finvera shipped our CRM in six weeks — something two agencies quoted us six months for. Absolute pros.", rating: 5 },
  { id: 2, name: "Daniel Mercer", role: "Founder", company: "Vaultly", avatar: "DM", quote: "The animation and polish on our SaaS dashboard genuinely moved our trial-to-paid numbers. Worth every penny.", rating: 5 },
  { id: 3, name: "Sofia Rossi", role: "CPO", company: "Quanta", avatar: "SR", quote: "They think like product owners, not just developers. Best engineering partner we've worked with, hands down.", rating: 5 },
  { id: 4, name: "James Lee", role: "CTO", company: "Prismix", avatar: "JL", quote: "Reliable, fast and deeply talented. Our uptime hasn't dropped once since Finvera took over infra.", rating: 5 },
];

export const team: TeamMember[] = [
  { id: 1, name: "Arjun Rao", role: "Founder & CEO", initials: "AR", bio: "15 years building products across fintech and B2B SaaS." },
  { id: 2, name: "Maya Chen", role: "Head of Design", initials: "MC", bio: "Leads product design and motion across every engagement." },
  { id: 3, name: "Liam Kelly", role: "VP Engineering", initials: "LK", bio: "Owns architecture, DevOps and platform reliability." },
  { id: 4, name: "Nadia Patel", role: "Head of Delivery", initials: "NP", bio: "Keeps squads shipping on time, every sprint." },
];

export const blog: BlogPost[] = [
  { id: 1, title: "Welcome to the Finvera blog", slug: "welcome-to-the-finvera-blog", excerpt: "Product and engineering insights from the team building SaaS & CRM software.", content: "<p>This is your first post. Edit or delete it from the admin, and start sharing what you're building.</p><p>From SaaS architecture to CRM automation, we'll share what we learn shipping software for fast-scaling teams.</p>", coverImage: null, author: "Finvera", category: "Company", tags: ["announcement"], status: "published", publishedAt: "2026-07-01T00:00:00.000Z" },
  { id: 2, title: "5 signs your business has outgrown its CRM", slug: "outgrown-your-crm", excerpt: "Spreadsheets everywhere, no single source of truth, reps ignoring the tool — here's when to go custom.", content: "<p>When your CRM starts working against your team instead of for it, it's time to rethink. Here are five signals we see most often.</p>", coverImage: null, author: "Finvera", category: "CRM", tags: ["crm", "growth"], status: "published", publishedAt: "2026-06-20T00:00:00.000Z" },
  { id: 3, title: "Shipping a SaaS MVP in six weeks", slug: "saas-mvp-in-six-weeks", excerpt: "How we scope, design and build a production-ready MVP without cutting the corners that matter.", content: "<p>Speed and quality aren't opposites. Here's the process we use to ship a real MVP in six weeks.</p>", coverImage: null, author: "Finvera", category: "SaaS", tags: ["saas", "process"], status: "published", publishedAt: "2026-06-05T00:00:00.000Z" },
];

export const seo: Record<string, Seo> = {
  home: { page: "home", title: "Finvera — Future-Driven SaaS & CRM Development", description: "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale and innovate." },
  about: { page: "about", title: "About — Finvera", description: "A product engineering studio building SaaS and CRM products for fast-scaling companies worldwide." },
  services: { page: "services", title: "Services — Finvera", description: "SaaS development, CRM solutions, cloud & DevOps, API integrations, UI/UX design and AI automation." },
  solutions: { page: "solutions", title: "Solutions — Finvera", description: "Software for every stage of growth — SaaS, CRM, cloud and AI solutions shaped to your goals." },
  work: { page: "work", title: "Work — Finvera", description: "Real products we've designed and developed for brands around the world." },
  contact: { page: "contact", title: "Contact — Finvera", description: "Tell us about your product and goals. We'll get back to you within one business day." },
  blog: { page: "blog", title: "Blog — Finvera", description: "Product and engineering insights from the Finvera team." },
};

export const settings: Settings = {
  site_name: "Finvera",
  site_tagline: "Future-Driven SaaS & CRM Development",
  contact_email: "hello@finvera.dev",
  contact_phone: "+1 (415) 555-0132",
  social_x: "#", social_linkedin: "#", social_github: "#",
  google_analytics_id: "", google_tag_manager_id: "", facebook_pixel_id: "", google_site_verification: "",
};
