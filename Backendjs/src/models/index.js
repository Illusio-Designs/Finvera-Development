const sequelize = require("../config/db");
const { DataTypes } = require("sequelize");

/* ── User (admin auth) ───────────────────────────────── */
const User = sequelize.define("User", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM("admin", "editor"), defaultValue: "admin" },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  avatar: { type: DataTypes.STRING },   // profile image URL
  title: { type: DataTypes.STRING },    // job title / role label
}, { tableName: "users" });

/* ── Project / Work ──────────────────────────────────── */
const Project = sequelize.define("Project", {
  title: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  category: { type: DataTypes.STRING },
  url: { type: DataTypes.STRING },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  blurb: { type: DataTypes.TEXT },
  content: { type: DataTypes.TEXT("long") },
  desktopImage: { type: DataTypes.STRING },
  mobileImage: { type: DataTypes.STRING },
  coverImage: { type: DataTypes.STRING },
  featured: { type: DataTypes.BOOLEAN, defaultValue: false },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
  // ── Case-study / trust fields ──
  client: { type: DataTypes.STRING },      // client name (falls back to title)
  industry: { type: DataTypes.STRING },
  year: { type: DataTypes.STRING },
  duration: { type: DataTypes.STRING },    // e.g. "6 weeks"
  role: { type: DataTypes.STRING },        // e.g. "Design & Development"
  challenge: { type: DataTypes.TEXT },
  approach: { type: DataTypes.TEXT },
  results: { type: DataTypes.JSON, defaultValue: [] },   // [{ value, label }]
  tech: { type: DataTypes.JSON, defaultValue: [] },      // ["Next.js", "Node", ...]
  gallery: { type: DataTypes.JSON, defaultValue: [] },   // [imageUrl, ...]
  testimonialQuote: { type: DataTypes.TEXT },
  testimonialName: { type: DataTypes.STRING },
  testimonialRole: { type: DataTypes.STRING },
  seoTitle: { type: DataTypes.STRING },
  seoDescription: { type: DataTypes.TEXT },
}, { tableName: "projects" });

/* ── Service ─────────────────────────────────────────── */
const Service = sequelize.define("Service", {
  title: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  icon: { type: DataTypes.STRING, defaultValue: "saas" },
  description: { type: DataTypes.TEXT },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
}, { tableName: "services" });

/* ── Testimonial ─────────────────────────────────────── */
const Testimonial = sequelize.define("Testimonial", {
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING },
  company: { type: DataTypes.STRING },
  avatar: { type: DataTypes.STRING },
  quote: { type: DataTypes.TEXT, allowNull: false },
  rating: { type: DataTypes.INTEGER, defaultValue: 5 },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
}, { tableName: "testimonials" });

/* ── Team member ─────────────────────────────────────── */
const TeamMember = sequelize.define("TeamMember", {
  name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING },
  bio: { type: DataTypes.TEXT },
  initials: { type: DataTypes.STRING },
  photo: { type: DataTypes.STRING },
  socials: { type: DataTypes.JSON, defaultValue: {} },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
}, { tableName: "team_members" });

/* ── Blog post ───────────────────────────────────────── */
const BlogPost = sequelize.define("BlogPost", {
  title: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  excerpt: { type: DataTypes.TEXT },
  content: { type: DataTypes.TEXT("long") },
  coverImage: { type: DataTypes.STRING },
  author: { type: DataTypes.STRING, defaultValue: "Finvera" },
  category: { type: DataTypes.STRING },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "draft" },
  publishedAt: { type: DataTypes.DATE },
  seoTitle: { type: DataTypes.STRING },
  seoDescription: { type: DataTypes.TEXT },
  seoKeywords: { type: DataTypes.STRING },
}, { tableName: "blog_posts" });

/* ── Contact submission ──────────────────────────────── */
const ContactSubmission = sequelize.define("ContactSubmission", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING },
  company: { type: DataTypes.STRING },
  projectType: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT, allowNull: false },
  ip: { type: DataTypes.STRING },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: "contact_submissions" });

/* ── Kanban board (Trello-style) ─────────────────────── */
const Board = sequelize.define("Board", {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  color: { type: DataTypes.STRING, defaultValue: "#3e60ab" },
  // columns live on the board: [{ id, title }]
  columns: { type: DataTypes.JSON, defaultValue: [] },
  // reusable label palette for this board: [{ id, name, color }]
  labels: { type: DataTypes.JSON, defaultValue: [] },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "boards" });

/* ── Kanban task (card) ──────────────────────────────── */
const Task = sequelize.define("Task", {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  boardId: { type: DataTypes.INTEGER },
  column: { type: DataTypes.STRING, defaultValue: "backlog" }, // column id
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  priority: { type: DataTypes.ENUM("low", "medium", "high"), defaultValue: "medium" },
  dueDate: { type: DataTypes.DATEONLY },
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  cover: { type: DataTypes.STRING },                          // hex color or image URL
  memberIds: { type: DataTypes.JSON, defaultValue: [] },      // assigned user ids
  labelIds: { type: DataTypes.JSON, defaultValue: [] },       // board label ids on this card
  checklist: { type: DataTypes.JSON, defaultValue: [] },      // [{ id, text, done }]
  attachments: { type: DataTypes.JSON, defaultValue: [] },    // [{ id, url, name }]
  // legacy free-text fields kept for backward compatibility
  assignee: { type: DataTypes.STRING },
  label: { type: DataTypes.STRING },
}, { tableName: "tasks" });

/* ── Card comment ────────────────────────────────────── */
const Comment = sequelize.define("Comment", {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER },
  body: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "task_comments" });

/* ── Per-page SEO ────────────────────────────────────── */
const Seo = sequelize.define("Seo", {
  page: { type: DataTypes.STRING, allowNull: false, unique: true }, // home, work, about...
  title: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  keywords: { type: DataTypes.STRING },
  ogImage: { type: DataTypes.STRING },
  canonical: { type: DataTypes.STRING },
  noindex: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: "seo_meta" });

/* ── CMS-managed content pages (privacy, terms…) ─────── */
const Page = sequelize.define("Page", {
  slug: { type: DataTypes.STRING, allowNull: false, unique: true }, // privacy, terms…
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT("long") },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
}, { tableName: "pages" });

/* ── Business-development leads (private CRM pipeline) ── */
const Lead = sequelize.define("Lead", {
  name: { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  source: { type: DataTypes.STRING, defaultValue: "Website" }, // Website, Referral, LinkedIn, Cold outreach, Event
  stage: { type: DataTypes.ENUM("new", "contacted", "qualified", "proposal", "won", "lost"), defaultValue: "new" },
  value: { type: DataTypes.INTEGER, defaultValue: 0 },          // estimated deal value
  owner: { type: DataTypes.STRING },                            // BD owner / assignee
  priority: { type: DataTypes.ENUM("low", "medium", "high"), defaultValue: "medium" },
  nextFollowUp: { type: DataTypes.DATEONLY },
  notes: { type: DataTypes.TEXT },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "leads" });

/* ── Editable content collections (CMS) ──────────────── */
const contentDefaults = {
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
};
const Faq = sequelize.define("Faq", {
  question: { type: DataTypes.STRING, allowNull: false },
  answer: { type: DataTypes.TEXT },
  ...contentDefaults,
}, { tableName: "faqs" });
const Value = sequelize.define("Value", {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  icon: { type: DataTypes.STRING, defaultValue: "rocket" },
  ...contentDefaults,
}, { tableName: "values" });
const Brand = sequelize.define("Brand", {
  name: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  icon: { type: DataTypes.STRING, defaultValue: "code" },
  ...contentDefaults,
}, { tableName: "brands" });
const Milestone = sequelize.define("Milestone", {
  year: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  ...contentDefaults,
}, { tableName: "milestones" });
const ProcessStep = sequelize.define("ProcessStep", {
  step: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  icon: { type: DataTypes.STRING, defaultValue: "search" },
  ...contentDefaults,
}, { tableName: "process_steps" });
const Stat = sequelize.define("Stat", {
  value: { type: DataTypes.STRING, allowNull: false },
  label: { type: DataTypes.STRING },
  ...contentDefaults,
}, { tableName: "stats" });
const Logo = sequelize.define("Logo", {
  name: { type: DataTypes.STRING, allowNull: false },
  image: { type: DataTypes.STRING },
  ...contentDefaults,
}, { tableName: "logos" });
const Feature = sequelize.define("Feature", {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  ...contentDefaults,
}, { tableName: "features" });

/* ── Site settings (key/value: analytics, pixels, brand) ─ */
const Setting = sequelize.define("Setting", {
  key: { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.TEXT },
  group: { type: DataTypes.STRING, defaultValue: "general" }, // general | analytics | social
  isPublic: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: "settings" });

/* ── Author association (optional) ───────────────────── */
BlogPost.belongsTo(User, { as: "editor", foreignKey: { name: "userId", allowNull: true } });
User.hasMany(BlogPost, { as: "posts", foreignKey: "userId" });

/* ── Kanban associations ─────────────────────────────── */
Board.hasMany(Task, { as: "tasks", foreignKey: "boardId", onDelete: "CASCADE" });
Task.belongsTo(Board, { foreignKey: "boardId" });
Task.hasMany(Comment, { as: "comments", foreignKey: "taskId", onDelete: "CASCADE" });
Comment.belongsTo(Task, { foreignKey: "taskId" });
Comment.belongsTo(User, { as: "author", foreignKey: "userId" });

module.exports = {
  sequelize,
  User, Project, Service, Testimonial, TeamMember,
  BlogPost, ContactSubmission, Seo, Setting, Task, Board, Comment, Page, Lead,
  Faq, Value, Brand, Milestone, ProcessStep, Stat, Logo, Feature,
};
