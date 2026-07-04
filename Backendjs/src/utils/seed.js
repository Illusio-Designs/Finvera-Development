const bcrypt = require("bcryptjs");
const slugify = require("slugify");
const { User, Project, Service, Testimonial, TeamMember, BlogPost, Seo, Setting, Board, Task, Page, Lead,
  Faq, Value, Brand, Milestone, ProcessStep, Stat, Logo, Feature } = require("../models");

const slug = (s) => slugify(String(s), { lower: true, strict: true });

const PROJECTS = [
  { title: "Antimatter AI", url: "https://www.antimatterai.com/", category: "AI · SaaS", tags: ["Web Design", "Development", "AI"], blurb: "A fast, modern marketing site for an AI product studio.", featured: true },
  { title: "Finvera Solutions", url: "https://www.finvera.solutions/", category: "Fintech · SaaS", tags: ["Fintech", "Web Design"], blurb: "The Finvera platform website.", featured: true },
  { title: "Stallion Eyewear", url: "https://b2b.stallioneyewear.in/", category: "B2B · E-commerce", tags: ["E-commerce", "B2B"], blurb: "A B2B ordering portal for a fast-growing eyewear brand." },
  { title: "CrossCoin", url: "https://crosscoin.in/", category: "Fintech", tags: ["Fintech", "Development"], blurb: "A sleek, secure-feeling fintech platform interface." },
  { title: "Nanak Finserv", url: "https://nanakfinserv.com/", category: "Financial Services", tags: ["Finance"], blurb: "A professional web presence for a financial services firm." },
  { title: "Velmique", url: "https://www.velmique.co.in/", category: "E-commerce · Brand", tags: ["E-commerce", "Branding"], blurb: "An elegant brand storefront with a mobile-first experience." },
  { title: "Knitwink", url: "https://www.knitwink.com/", category: "Brand Website", tags: ["Web Design"], blurb: "A polished, content-driven website for the Knitwink brand." },
  { title: "Volterra Tiles", url: "https://volterratiles.com.au/blog", category: "Content · Editorial", tags: ["Content", "SEO"], blurb: "An editorial blog and content platform for a premium tiles brand." },
  { title: "Amrutkumar Govinddas LLP", url: "https://amrutkumargovinddasllp.com/", category: "Corporate", tags: ["Corporate"], blurb: "A clean, professional corporate website for an established LLP." },
  { title: "Aqalite", url: "https://aqalite.co.nz/", category: "Product Website", tags: ["Web Design"], blurb: "A crisp product website for a New Zealand building-products brand." },
  { title: "Nishree", url: "https://nishree.vercel.app/", category: "Brand Website", tags: ["Next.js"], blurb: "A fast, minimal brand site deployed on Vercel." },
];

const SERVICES = [
  { title: "SaaS Development", icon: "saas", description: "Multi-tenant, subscription-ready platforms built for scale." },
  { title: "CRM Solutions", icon: "crm", description: "Custom CRM engines with smart pipelines, lead scoring and automations." },
  { title: "Cloud & DevOps", icon: "cloud", description: "Zero-downtime infrastructure, CI/CD pipelines and observability." },
  { title: "API & Integrations", icon: "api", description: "Connect your stack with resilient, well-documented APIs." },
  { title: "UI/UX Design", icon: "design", description: "Interfaces people love, engineered with motion that feels effortless." },
  { title: "AI Automation", icon: "ai", description: "Embed intelligence into your product with copilots and automation." },
];

const TESTIMONIALS = [
  { name: "Aisha Khan", role: "CEO", company: "Orbital", avatar: "AK", quote: "Finvera shipped our CRM in six weeks. Absolute pros." },
  { name: "Daniel Mercer", role: "Founder", company: "Vaultly", avatar: "DM", quote: "The animation and polish on our SaaS dashboard moved our trial-to-paid numbers." },
  { name: "Sofia Rossi", role: "CPO", company: "Quanta", avatar: "SR", quote: "They think like product owners. Best engineering partner we've worked with." },
  { name: "James Lee", role: "CTO", company: "Prismix", avatar: "JL", quote: "Reliable, fast and deeply talented. Our uptime hasn't dropped once." },
];

const TEAM = [
  { name: "Arjun Rao", role: "Founder & CEO", initials: "AR", bio: "15 years building products across fintech and B2B SaaS." },
  { name: "Maya Chen", role: "Head of Design", initials: "MC", bio: "Leads product design and motion across every engagement." },
  { name: "Liam Kelly", role: "VP Engineering", initials: "LK", bio: "Owns architecture, DevOps and platform reliability." },
  { name: "Nadia Patel", role: "Head of Delivery", initials: "NP", bio: "Keeps squads shipping on time, every sprint." },
];

const SEO_PAGES = [
  { page: "home", title: "Finvera — Future-Driven SaaS & CRM Development", description: "Finvera builds high-quality SaaS platforms and CRM systems." },
  { page: "about", title: "About — Finvera", description: "A product engineering studio building SaaS and CRM products." },
  { page: "services", title: "Services — Finvera", description: "SaaS development, CRM solutions, cloud & DevOps and more." },
  { page: "solutions", title: "Solutions — Finvera", description: "Software for every stage of growth." },
  { page: "work", title: "Work — Finvera", description: "Real products we've designed and developed." },
  { page: "contact", title: "Contact — Finvera", description: "Tell us about your product and goals." },
];

const LEGAL_PAGES = [
  { slug: "privacy", title: "Privacy Policy", content: "<p>This Privacy Policy explains how Finvera Solutions LLP collects, uses and protects your information.</p><h3>Information we collect</h3><p>Information you provide directly and basic usage data via analytics.</p><h3>How we use it</h3><p>To respond to enquiries, deliver services and communicate about your project. We do not sell your data.</p><h3>Contact</h3><p>Email us at finverasolutionsllp@gmail.com.</p>" },
  { slug: "terms", title: "Terms & Conditions", content: "<p>These Terms & Conditions govern your use of the Finvera Solutions LLP website and services.</p><h3>Use of our services</h3><p>Use our website lawfully and do not misuse it.</p><h3>Intellectual property</h3><p>Work delivered under a signed agreement is transferred to the client.</p><h3>Contact</h3><p>Email us at finverasolutionsllp@gmail.com.</p>" },
];

const LEADS = [
  { name: "Priya Sharma", company: "Nexora Retail", email: "priya@nexora.io", phone: "+91 98200 11223", source: "Website", stage: "qualified", value: 42000, owner: "Arjun Rao", priority: "high", purpose: "CRM Build", progress: 70, notes: "Wants a custom CRM + storefront integration. Demo booked." },
  { name: "Daniel Brooks", company: "Vaultly", email: "dan@vaultly.com", phone: "+1 415 555 0198", source: "Referral", stage: "proposal", value: 68000, owner: "Arjun Rao", priority: "high", purpose: "SaaS Revamp", progress: 55, notes: "Proposal sent. Awaiting sign-off." },
  { name: "Meera Nair", company: "Kart&Co", email: "meera@kartandco.in", phone: "+91 90040 55667", source: "LinkedIn", stage: "contacted", value: 18000, owner: "Nadia Patel", priority: "medium", purpose: "Omni-channel", progress: 30, notes: "Intro call done; needs inventory scope." },
  { name: "Tom Hughes", company: "Prismix", email: "tom@prismix.co", phone: "+44 20 7946 0102", source: "Cold outreach", stage: "new", value: 25000, owner: "Nadia Patel", priority: "medium", purpose: "Discovery", progress: 12, notes: "Replied to outreach." },
  { name: "Sara Lopez", company: "Orbital", email: "sara@orbital.app", phone: "+1 646 555 0177", source: "Event", stage: "won", value: 54000, owner: "Arjun Rao", priority: "high", purpose: "CRM Build", progress: 100, notes: "Closed." },
];

const FAQS = [
  { question: "How fast can you start on my project?", answer: "Most engagements kick off within one week. After a short discovery call we assemble a squad and schedule your first sprint immediately." },
  { question: "Do you build both SaaS and CRM products?", answer: "Yes, it's our core focus. We build multi-tenant SaaS platforms and fully custom CRM systems, including migrations from tools like Salesforce and HubSpot." },
  { question: "Who owns the code and IP?", answer: "You do, 100%. All source code, designs and infrastructure are transferred to your organization with full documentation." },
  { question: "Can you take over an existing codebase?", answer: "Absolutely. We regularly audit, stabilize and scale existing products, starting with a technical review before any changes ship." },
];
const VALUES = [
  { title: "Ship fast", description: "Momentum compounds. We deliver working software every single week.", icon: "rocket" },
  { title: "Own the outcome", description: "We measure success by your metrics, not billed hours.", icon: "target" },
  { title: "Craft matters", description: "Details are the product. We sweat the pixels and the milliseconds.", icon: "award" },
  { title: "Partner, not vendor", description: "We work as an extension of your team, transparent and hands-on.", icon: "agreement" },
];
const BRANDS = [
  { name: "Illusio Designs", category: "Design & Marketing", icon: "paint", url: "https://illusiodesigns.agency", description: "Our founding studio. Brand identity, web design and growth marketing." },
  { name: "Fintranzact", category: "Accounting SaaS", icon: "calculator", url: "https://fintranzact.com", description: "Cloud accounting built for modern businesses." },
  { name: "Kartriq", category: "Omni-Channel SaaS", icon: "store", url: "https://kartriq.com", description: "One platform to run every sales channel." },
  { name: "Collabhype", category: "Influencer Collaboration", icon: "megaphone", url: "https://collabhype.in", description: "Where brands and creators meet." },
  { name: "Finvera", category: "CRM & SaaS Development", icon: "code", url: "https://finvera.solutions", description: "Our flagship, custom CRM systems and SaaS platforms." },
];
const MILESTONES = [
  { year: "2017", title: "Illusio Designs is born", description: "We start as a small design & marketing studio." },
  { year: "2019", title: "Into web & product", description: "We expand into websites, product UI and front-end engineering." },
  { year: "2021", title: "Our first SaaS", description: "We ship our first SaaS products." },
  { year: "2023", title: "The brand family grows", description: "Fintranzact, Kartriq and Collabhype take shape." },
  { year: "2024", title: "Finvera Solutions LLP", description: "We formally incorporate." },
  { year: "Today", title: "A multi-product group", description: "Five brands, one team." },
];
const PROCESS_STEPS = [
  { step: "01", title: "Discover", description: "We map your goals, users and constraints into a sharp product blueprint.", icon: "search" },
  { step: "02", title: "Design", description: "Wireframes to polished UI with motion, validated against real users.", icon: "paint" },
  { step: "03", title: "Build", description: "Agile sprints, weekly demos and production-grade, tested code.", icon: "code" },
  { step: "04", title: "Scale", description: "Launch, monitor and iterate, we grow with you long after go-live.", icon: "rocket" },
];
const STATS = [
  { value: "250+", label: "Projects delivered" }, { value: "99%", label: "Uptime guaranteed" },
  { value: "18+", label: "Countries served" }, { value: "4min", label: "Avg. deploy time" },
];
const LOGOS = [{ name: "Nexora" }, { name: "Orbital" }, { name: "Vaultly" }, { name: "Prismix" }, { name: "Loopwork" }, { name: "Quanta" }];
const FEATURES = [
  { title: "Smart pipelines", description: "Drag-and-drop deal stages with automated hand-offs." },
  { title: "AI lead scoring", description: "Know which leads to call first, ranked in real time." },
  { title: "Live analytics", description: "Boardroom-ready dashboards updated to the second." },
];

const SETTINGS = [
  { key: "site_name", value: "Finvera Solutions LLP", group: "general", isPublic: true },
  { key: "site_tagline", value: "Future-Driven SaaS & CRM Development", group: "general", isPublic: true },
  { key: "contact_email", value: "finvetasolutionsllp@gmail.com", group: "general", isPublic: true },
  { key: "contact_phone", value: "+91 84900 09684", group: "general", isPublic: true },
  { key: "contact_address", value: "B-603, 6th Floor, Darshan Shrusti Apartment, Nanavati Chowk, Rajkot", group: "general", isPublic: true },
  { key: "social_x", value: "https://x.com/", group: "social", isPublic: true },
  { key: "social_linkedin", value: "https://linkedin.com/", group: "social", isPublic: true },
  { key: "social_github", value: "https://github.com/", group: "social", isPublic: true },
  { key: "google_analytics_id", value: "", group: "analytics", isPublic: true },
  { key: "google_tag_manager_id", value: "", group: "analytics", isPublic: true },
  { key: "facebook_pixel_id", value: "", group: "analytics", isPublic: true },
  { key: "google_site_verification", value: "", group: "analytics", isPublic: true },
];

const SEED_VERSION = 2;
const MIGRATIONS = {
  2: async () => {
    const urls = {
      "Illusio Designs": "https://illusiodesigns.agency",
      "Fintranzact": "https://fintranzact.com",
      "Kartriq": "https://kartriq.com",
      "Collabhype": "https://collabhype.in",
      "Finvera": "https://finvera.solutions",
    };
    await Brand.update({ name: "Kartriq" }, { where: { name: "Kartuq" } });
    for (const [name, url] of Object.entries(urls)) {
      await Brand.update({ url }, { where: { name } });
    }
    const m = await Milestone.findOne({ where: { title: "The brand family grows" } });
    if (m && /Kartuq/.test(m.description || "")) { m.description = m.description.replace(/Kartuq/g, "Kartriq"); await m.save(); }
  },
};

async function runVersionedSeed() {
  let stored = 0;
  const [vs] = await Setting.findOrCreate({ where: { key: "seed_version" }, defaults: { value: "0", group: "system", isPublic: false } });
  stored = Number(vs.value) || 0;
  if (stored >= SEED_VERSION) { console.log(`\x1b[36mSeed up to date (v${stored})\x1b[0m`); return; }
  for (let v = stored + 1; v <= SEED_VERSION; v++) {
    if (typeof MIGRATIONS[v] === "function") {
      try { await MIGRATIONS[v](); console.log(`\x1b[32mApplied seed migration v${v}\x1b[0m`); }
      catch (e) { console.warn(`\x1b[33mSeed migration v${v} failed: ${e.message}\x1b[0m`); }
    }
  }
  vs.value = String(SEED_VERSION);
  await vs.save();
  console.log(`\x1b[32mSeed version updated ${stored} to ${SEED_VERSION}\x1b[0m`);
}

async function seed() {
  const email = (process.env.ADMIN_EMAIL || "finverasolutionsllp@gmail.com").toLowerCase();
  const [admin, created] = await User.findOrCreate({
    where: { email },
    defaults: { name: process.env.ADMIN_NAME || "Finvera Admin", email, password: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Rishi@1995", 10), role: "admin" },
  });
  if (created) console.log(`\x1b[32mSeeded admin user: ${admin.email}\x1b[0m`);

  if (!created && String(process.env.ADMIN_RESET_PASSWORD).toLowerCase() === "true" && process.env.ADMIN_PASSWORD) {
    admin.password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    admin.active = true;
    if (process.env.ADMIN_NAME) admin.name = process.env.ADMIN_NAME;
    await admin.save();
    console.log(`\x1b[33mAdmin password reset for ${admin.email}.\x1b[0m`);
  }

  if ((await Project.count()) === 0) await Project.bulkCreate(PROJECTS.map((p, i) => ({ ...p, slug: slug(p.title), position: i, status: "published" })));
  if ((await Service.count()) === 0) await Service.bulkCreate(SERVICES.map((s, i) => ({ ...s, slug: slug(s.title), position: i, status: "published" })));
  if ((await Testimonial.count()) === 0) await Testimonial.bulkCreate(TESTIMONIALS.map((t, i) => ({ ...t, position: i, status: "published" })));
  if ((await TeamMember.count()) === 0) await TeamMember.bulkCreate(TEAM.map((t, i) => ({ ...t, position: i, status: "published" })));
  if ((await BlogPost.count()) === 0) await BlogPost.create({ title: "Welcome to the Finvera blog", slug: "welcome-to-the-finvera-blog", excerpt: "Product and engineering insights.", content: "<p>This is your first post. Edit or delete it from the admin.</p>", author: "Finvera", category: "Company", tags: ["announcement"], status: "published", publishedAt: new Date(), seoTitle: "Welcome to the Finvera blog", seoDescription: "Insights from Finvera." });
  if (Page) for (const p of LEGAL_PAGES) await Page.findOrCreate({ where: { slug: p.slug }, defaults: { ...p, status: "published" } });
  if (Lead) { try { if ((await Lead.count()) === 0) await Lead.bulkCreate(LEADS.map((l, i) => ({ ...l, position: i }))); } catch (e) { console.warn(`\x1b[33mLead seed skipped: ${e.message}\x1b[0m`); } }

  const CONTENT = [[Faq, FAQS], [Value, VALUES], [Brand, BRANDS], [Milestone, MILESTONES], [ProcessStep, PROCESS_STEPS], [Stat, STATS], [Logo, LOGOS], [Feature, FEATURES]];
  for (const [Model, rows] of CONTENT) {
    try { if (Model && (await Model.count()) === 0) await Model.bulkCreate(rows.map((r, i) => ({ ...r, position: i, status: "published" }))); }
    catch (e) { console.warn(`\x1b[33m${Model && Model.name} seed skipped: ${e.message}\x1b[0m`); }
  }

  for (const s of SEO_PAGES) await Seo.findOrCreate({ where: { page: s.page }, defaults: s });
  for (const s of SETTINGS) await Setting.findOrCreate({ where: { key: s.key }, defaults: s });

  try {
    if ((await Board.count()) === 0) {
      const columns = [{ id: "backlog", title: "Backlog" }, { id: "todo", title: "To Do" }, { id: "inprogress", title: "In Progress" }, { id: "review", title: "Review" }, { id: "done", title: "Done" }];
      const board = await Board.create({ name: "Main Board", description: "Plan and track work across the team.", columns, labels: [{ id: "l1", name: "Design", color: "#8b5cf6" }, { id: "l2", name: "Development", color: "#3e60ab" }, { id: "l3", name: "QA", color: "#f59e0b" }, { id: "l4", name: "Urgent", color: "#ef4444" }, { id: "l5", name: "Done", color: "#22c55e" }], position: 0 });
      await Task.update({ boardId: board.id }, { where: { boardId: null } });
    }
  } catch (e) { console.warn(`\x1b[33mKanban board seed skipped: ${e.message}\x1b[0m`); }

  try { await runVersionedSeed(); } catch (e) { console.warn(`\x1b[33mVersioned seed skipped: ${e.message}\x1b[0m`); }
}

module.exports = seed;

if (require.main === module) {
  require("dotenv").config();
  const { sequelize } = require("../models");
  (async () => {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });
    await seed();
    console.log("\x1b[32mSeed complete\x1b[0m");
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
