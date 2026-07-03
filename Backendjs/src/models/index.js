const sequelize = require("../config/db");
const { DataTypes } = require("sequelize");

/* ── User (admin auth) ───────────────────────────────── */
const User = sequelize.define("User", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM("admin", "editor"), defaultValue: "admin" },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
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
  company: { type: DataTypes.STRING },
  projectType: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT, allowNull: false },
  ip: { type: DataTypes.STRING },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: "contact_submissions" });

/* ── Kanban task (project board) ─────────────────────── */
const Task = sequelize.define("Task", {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  column: { type: DataTypes.STRING, defaultValue: "backlog" }, // column id
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  assignee: { type: DataTypes.STRING },
  priority: { type: DataTypes.ENUM("low", "medium", "high"), defaultValue: "medium" },
  label: { type: DataTypes.STRING },
  dueDate: { type: DataTypes.DATEONLY },
}, { tableName: "tasks" });

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

module.exports = {
  sequelize,
  User, Project, Service, Testimonial, TeamMember,
  BlogPost, ContactSubmission, Seo, Setting, Task,
};
