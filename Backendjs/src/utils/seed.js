const bcrypt = require("bcryptjs");
const slugify = require("slugify");
const { User, Project, Service, Testimonial, TeamMember, BlogPost, Seo, Setting } = require("../models");

const slug = (s) => slugify(String(s), { lower: true, strict: true });

const PROJECTS = [
  { title: "Antimatter AI", url: "https://www.antimatterai.com/", category: "AI · SaaS", tags: ["Web Design", "Development", "AI"], blurb: "A fast, modern marketing site for an AI product studio — built for clarity, motion and conversion.", featured: true },
  { title: "Finvera Solutions", url: "https://www.finvera.solutions/", category: "Fintech · SaaS", tags: ["Fintech", "Web Design", "Development"], blurb: "The Finvera platform website — accounting and finance, presented with a clean, trustworthy interface.", featured: true },
  { title: "Stallion Eyewear", url: "https://b2b.stallioneyewear.in/", category: "B2B · E-commerce", tags: ["E-commerce", "B2B", "Development"], blurb: "A B2B ordering portal for a fast-growing eyewear brand, streamlining wholesale purchasing." },
  { title: "CrossCoin", url: "https://crosscoin.in/", category: "Fintech", tags: ["Fintech", "Web Design", "Development"], blurb: "A sleek, secure-feeling fintech platform interface designed to build instant trust." },
  { title: "Nanak Finserv", url: "https://nanakfinserv.com/", category: "Financial Services", tags: ["Finance", "Web Design"], blurb: "A professional web presence for a financial services firm, focused on credibility and clarity." },
  { title: "Velmique", url: "https://www.velmique.co.in/", category: "E-commerce · Brand", tags: ["E-commerce", "Branding", "Development"], blurb: "An elegant brand storefront with a refined, mobile-first shopping experience." },
  { title: "Knitwink", url: "https://www.knitwink.com/", category: "Brand Website", tags: ["Web Design", "Development"], blurb: "A polished, content-driven website crafted to bring the Knitwink brand to life online." },
  { title: "Volterra Tiles", url: "https://volterratiles.com.au/blog", category: "Content · Editorial", tags: ["Content", "SEO", "Development"], blurb: "An editorial blog and content platform for a premium Australian tiles brand." },
  { title: "Amrutkumar Govinddas LLP", url: "https://amrutkumargovinddasllp.com/", category: "Corporate", tags: ["Corporate", "Web Design"], blurb: "A clean, professional corporate website for an established LLP." },
  { title: "Aqalite", url: "https://aqalite.co.nz/", category: "Product Website", tags: ["Web Design", "Development"], blurb: "A crisp product website for a New Zealand building-products brand." },
  { title: "Nishree", url: "https://nishree.vercel.app/", category: "Brand Website", tags: ["Web Design", "Next.js"], blurb: "A fast, minimal brand site deployed on Vercel with a focus on performance." },
];

const SERVICES = [
  { title: "SaaS Development", icon: "saas", description: "Multi-tenant, subscription-ready platforms built for scale — billing, auth, dashboards and everything in between." },
  { title: "CRM Solutions", icon: "crm", description: "Custom CRM engines with smart pipelines, lead scoring, and automations tailored to how your team actually sells." },
  { title: "Cloud & DevOps", icon: "cloud", description: "Zero-downtime infrastructure, CI/CD pipelines and observability so you can ship confidently, every single day." },
  { title: "API & Integrations", icon: "api", description: "Connect your stack — payments, messaging, analytics and 3rd-party tools — with resilient, well-documented APIs." },
  { title: "UI/UX Design", icon: "design", description: "Interfaces people love — research-driven, pixel-perfect, and engineered with motion that feels effortless." },
  { title: "AI Automation", icon: "ai", description: "Embed intelligence into your product — copilots, predictions and workflow automation that save real hours." },
];

const TESTIMONIALS = [
  { name: "Aisha Khan", role: "CEO", company: "Orbital", avatar: "AK", quote: "Finvera shipped our CRM in six weeks — something two agencies quoted us six months for. Absolute pros." },
  { name: "Daniel Mercer", role: "Founder", company: "Vaultly", avatar: "DM", quote: "The animation and polish on our SaaS dashboard genuinely moved our trial-to-paid numbers. Worth every penny." },
  { name: "Sofia Rossi", role: "CPO", company: "Quanta", avatar: "SR", quote: "They think like product owners, not just developers. Best engineering partner we've worked with, hands down." },
  { name: "James Lee", role: "CTO", company: "Prismix", avatar: "JL", quote: "Reliable, fast and deeply talented. Our uptime hasn't dropped once since Finvera took over infra." },
];

const TEAM = [
  { name: "Arjun Rao", role: "Founder & CEO", initials: "AR", bio: "15 years building products across fintech and B2B SaaS." },
  { name: "Maya Chen", role: "Head of Design", initials: "MC", bio: "Leads product design and motion across every engagement." },
  { name: "Liam Kelly", role: "VP Engineering", initials: "LK", bio: "Owns architecture, DevOps and platform reliability." },
  { name: "Nadia Patel", role: "Head of Delivery", initials: "NP", bio: "Keeps squads shipping on time, every sprint." },
];

const SEO_PAGES = [
  { page: "home", title: "Finvera — Future-Driven SaaS & CRM Development", description: "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale and innovate." },
  { page: "about", title: "About — Finvera", description: "A product engineering studio building SaaS and CRM products for fast-scaling companies worldwide." },
  { page: "services", title: "Services — Finvera", description: "SaaS development, CRM solutions, cloud & DevOps, API integrations, UI/UX design and AI automation." },
  { page: "solutions", title: "Solutions — Finvera", description: "Software for every stage of growth — SaaS, CRM, cloud and AI solutions shaped to your goals." },
  { page: "work", title: "Work — Finvera", description: "Real products we've designed and developed for brands around the world." },
  { page: "contact", title: "Contact — Finvera", description: "Tell us about your product and goals. We'll get back to you within one business day." },
];

const SETTINGS = [
  { key: "site_name", value: "Finvera Solutions LLP", group: "general", isPublic: true },
  { key: "site_tagline", value: "Future-Driven SaaS & CRM Development", group: "general", isPublic: true },
  { key: "contact_email", value: "finvetasolutionsllp@gmail.com", group: "general", isPublic: true },
  { key: "contact_phone", value: "+91 84900 09684", group: "general", isPublic: true },
  { key: "contact_address", value: "B-603, 6th Floor, Darshan Shrusti Apartment, Nanavati Chowk, Rajkot", group: "general", isPublic: true },
  { key: "kanban_columns", value: JSON.stringify([{ id: "backlog", title: "Backlog" }, { id: "todo", title: "To Do" }, { id: "inprogress", title: "In Progress" }, { id: "review", title: "Review" }, { id: "done", title: "Done" }]), group: "general", isPublic: false },
  { key: "social_x", value: "https://x.com/", group: "social", isPublic: true },
  { key: "social_linkedin", value: "https://linkedin.com/", group: "social", isPublic: true },
  { key: "social_github", value: "https://github.com/", group: "social", isPublic: true },
  { key: "google_analytics_id", value: "", group: "analytics", isPublic: true },   // e.g. G-XXXXXXX
  { key: "google_tag_manager_id", value: "", group: "analytics", isPublic: true }, // e.g. GTM-XXXXXX
  { key: "facebook_pixel_id", value: "", group: "analytics", isPublic: true },
  { key: "google_site_verification", value: "", group: "analytics", isPublic: true },
];

async function seed() {
  // 1) Admin user
  const email = (process.env.ADMIN_EMAIL || "finverasolutionsllp@gmail.com").toLowerCase();
  const [admin, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      name: process.env.ADMIN_NAME || "Finvera Admin",
      email,
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Rishi@1995", 10),
      role: "admin",
    },
  });
  if (created) console.log(`\x1b[32m✔ Seeded admin user: ${admin.email}\x1b[0m`);

  // Password self-heal: findOrCreate only sets the password on FIRST creation,
  // so changing ADMIN_PASSWORD later never updates an existing admin. Set
  // ADMIN_RESET_PASSWORD=true (with ADMIN_PASSWORD) to force the stored password
  // to match on boot, then remove the flag. Also reactivates the account.
  if (!created && String(process.env.ADMIN_RESET_PASSWORD).toLowerCase() === "true" && process.env.ADMIN_PASSWORD) {
    admin.password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    admin.active = true;
    if (process.env.ADMIN_NAME) admin.name = process.env.ADMIN_NAME;
    await admin.save();
    console.log(`\x1b[33m⚠ Admin password reset from ADMIN_PASSWORD for ${admin.email}. Remove ADMIN_RESET_PASSWORD from .env now.\x1b[0m`);
  }

  // 2) Content (only when tables are empty, so we never clobber edits)
  if ((await Project.count()) === 0) {
    await Project.bulkCreate(PROJECTS.map((p, i) => ({ ...p, slug: slug(p.title), position: i, status: "published" })));
    console.log(`\x1b[32m✔ Seeded ${PROJECTS.length} projects\x1b[0m`);
  }
  if ((await Service.count()) === 0) {
    await Service.bulkCreate(SERVICES.map((s, i) => ({ ...s, slug: slug(s.title), position: i, status: "published" })));
  }
  if ((await Testimonial.count()) === 0) {
    await Testimonial.bulkCreate(TESTIMONIALS.map((t, i) => ({ ...t, position: i, status: "published" })));
  }
  if ((await TeamMember.count()) === 0) {
    await TeamMember.bulkCreate(TEAM.map((t, i) => ({ ...t, position: i, status: "published" })));
  }
  if ((await BlogPost.count()) === 0) {
    await BlogPost.create({
      title: "Welcome to the Finvera blog",
      slug: "welcome-to-the-finvera-blog",
      excerpt: "Product and engineering insights from the team building SaaS & CRM software.",
      content: "<p>This is your first post. Edit or delete it from the admin, and start sharing what you're building.</p>",
      author: "Finvera", category: "Company", tags: ["announcement"],
      status: "published", publishedAt: new Date(),
      seoTitle: "Welcome to the Finvera blog",
      seoDescription: "Product and engineering insights from Finvera.",
    });
  }
  for (const s of SEO_PAGES) {
    await Seo.findOrCreate({ where: { page: s.page }, defaults: s });
  }
  for (const s of SETTINGS) {
    await Setting.findOrCreate({ where: { key: s.key }, defaults: s });
  }
}

module.exports = seed;

/* Allow running standalone: `npm run seed` */
if (require.main === module) {
  require("dotenv").config();
  const { sequelize } = require("../models");
  (async () => {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    await seed();
    console.log("\x1b[32m✔ Seed complete\x1b[0m");
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
