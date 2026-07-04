const bcrypt = require("bcryptjs");
const slugify = require("slugify");
const { User, Project, Service, Testimonial, TeamMember, BlogPost, Seo, Setting, Board, Task, Page, Lead } = require("../models");

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

const LEGAL_PAGES = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    content:
      "<p>This Privacy Policy explains how Finvera Solutions LLP (\"Finvera\", \"we\", \"us\") collects, uses and protects the information you share with us when you use our website and services.</p>" +
      "<h3>Information we collect</h3><p>We collect information you provide directly — such as your name, email address and any details submitted through our contact forms — as well as basic usage data (pages visited, device and browser type) via analytics tools.</p>" +
      "<h3>How we use your information</h3><p>We use your information to respond to enquiries, deliver and improve our services, and communicate with you about your project. We do not sell your personal data.</p>" +
      "<h3>Cookies</h3><p>We use cookies and similar technologies to understand how the site is used and to improve your experience. You can control cookies through your browser settings.</p>" +
      "<h3>Data retention & security</h3><p>We retain personal data only as long as necessary for the purposes described here, and we apply reasonable technical and organisational measures to protect it.</p>" +
      "<h3>Your rights</h3><p>You may request access to, correction of, or deletion of your personal data at any time by contacting us.</p>" +
      "<h3>Contact</h3><p>Questions about this policy? Email us at finverasolutionsllp@gmail.com.</p>",
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    content:
      "<p>These Terms & Conditions govern your use of the Finvera Solutions LLP website and services. By using our site you agree to these terms.</p>" +
      "<h3>Use of our services</h3><p>You agree to use our website and services lawfully and not to misuse, disrupt or attempt to gain unauthorised access to any part of them.</p>" +
      "<h3>Intellectual property</h3><p>All content on this site is owned by Finvera unless stated otherwise. Work delivered under a signed agreement is transferred to the client as set out in that agreement.</p>" +
      "<h3>Engagements & payment</h3><p>Project scope, timelines and fees are defined in individual proposals or contracts. Those documents take precedence over this page for the specific engagement.</p>" +
      "<h3>Limitation of liability</h3><p>Our website is provided \"as is\". To the extent permitted by law, we are not liable for indirect or consequential losses arising from its use.</p>" +
      "<h3>Changes</h3><p>We may update these terms from time to time. Continued use of the site after changes constitutes acceptance of the revised terms.</p>" +
      "<h3>Contact</h3><p>Questions about these terms? Email us at finverasolutionsllp@gmail.com.</p>",
  },
];

const LEADS = [
  { name: "Priya Sharma", company: "Nexora Retail", email: "priya@nexora.io", phone: "+91 98200 11223", source: "Website", stage: "qualified", value: 42000, owner: "Arjun Rao", priority: "high", notes: "Wants a custom CRM + storefront integration. Demo booked." },
  { name: "Daniel Brooks", company: "Vaultly", email: "dan@vaultly.com", phone: "+1 415 555 0198", source: "Referral", stage: "proposal", value: 68000, owner: "Arjun Rao", priority: "high", notes: "Proposal sent for SaaS dashboard revamp. Awaiting sign-off." },
  { name: "Meera Nair", company: "Kart&Co", email: "meera@kartandco.in", phone: "+91 90040 55667", source: "LinkedIn", stage: "contacted", value: 18000, owner: "Nadia Patel", priority: "medium", notes: "Intro call done; needs omni-channel inventory scope." },
  { name: "Tom Hughes", company: "Prismix", email: "tom@prismix.co", phone: "+44 20 7946 0102", source: "Cold outreach", stage: "new", value: 25000, owner: "Nadia Patel", priority: "medium", notes: "Replied to outreach — schedule discovery." },
  { name: "Sara Lopez", company: "Orbital", email: "sara@orbital.app", phone: "+1 646 555 0177", source: "Event", stage: "won", value: 54000, owner: "Arjun Rao", priority: "high", notes: "Closed — CRM build kicking off next sprint." },
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
  if (Page) {
    for (const p of LEGAL_PAGES) {
      // eslint-disable-next-line no-await-in-loop
      await Page.findOrCreate({ where: { slug: p.slug }, defaults: { ...p, status: "published" } });
    }
  }
  if (Lead) {
    try {
      if ((await Lead.count()) === 0) {
        await Lead.bulkCreate(LEADS.map((l, i) => ({ ...l, position: i })));
        console.log(`\x1b[32m✔ Seeded ${LEADS.length} sample leads\x1b[0m`);
      }
    } catch (e) { console.warn(`\x1b[33m⚠ Lead seed skipped: ${e.message}\x1b[0m`); }
  }
  for (const s of SEO_PAGES) {
    await Seo.findOrCreate({ where: { page: s.page }, defaults: s });
  }
  for (const s of SETTINGS) {
    await Setting.findOrCreate({ where: { key: s.key }, defaults: s });
  }

  // 3) Default Kanban board (Trello-style). Migrate existing global columns +
  //    orphan tasks onto it so nothing is lost. Wrapped so that if the boards
  //    table doesn't exist yet (deployed before DB_SYNC=true), the API still
  //    boots instead of hard-crashing on startup.
  try {
    if ((await Board.count()) === 0) {
      let columns = [
        { id: "backlog", title: "Backlog" }, { id: "todo", title: "To Do" },
        { id: "inprogress", title: "In Progress" }, { id: "review", title: "Review" },
        { id: "done", title: "Done" },
      ];
      const legacy = await Setting.findOne({ where: { key: "kanban_columns" } });
      if (legacy) { try { const c = JSON.parse(legacy.value); if (Array.isArray(c) && c.length) columns = c; } catch { /* keep defaults */ } }
      const board = await Board.create({
        name: "Main Board",
        description: "Plan and track work across the team.",
        columns,
        labels: [
          { id: "l1", name: "Design", color: "#8b5cf6" },
          { id: "l2", name: "Development", color: "#3e60ab" },
          { id: "l3", name: "QA", color: "#f59e0b" },
          { id: "l4", name: "Urgent", color: "#ef4444" },
          { id: "l5", name: "Done", color: "#22c55e" },
        ],
        position: 0,
      });
      // adopt any pre-existing tasks that have no board yet
      await Task.update({ boardId: board.id }, { where: { boardId: null } });
      console.log(`\x1b[32m✔ Seeded default Kanban board\x1b[0m`);
    }
  } catch (e) {
    console.warn(`\x1b[33m⚠ Kanban board seed skipped (run once with DB_SYNC=true to create the boards table): ${e.message}\x1b[0m`);
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
