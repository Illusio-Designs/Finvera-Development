const sequelize = require("../config/db");
const { DataTypes } = require("sequelize");

const User = sequelize.define("User", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM("admin", "editor"), defaultValue: "admin" },
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
  avatar: { type: DataTypes.STRING },
  title: { type: DataTypes.STRING },
}, { tableName: "users" });

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
  client: { type: DataTypes.STRING },
  industry: { type: DataTypes.STRING },
  year: { type: DataTypes.STRING },
  duration: { type: DataTypes.STRING },
  role: { type: DataTypes.STRING },
  challenge: { type: DataTypes.TEXT },
  approach: { type: DataTypes.TEXT },
  results: { type: DataTypes.JSON, defaultValue: [] },
  tech: { type: DataTypes.JSON, defaultValue: [] },
  gallery: { type: DataTypes.JSON, defaultValue: [] },
  testimonialQuote: { type: DataTypes.TEXT },
  testimonialName: { type: DataTypes.STRING },
  testimonialRole: { type: DataTypes.STRING },
  seoTitle: { type: DataTypes.STRING },
  seoDescription: { type: DataTypes.TEXT },
}, { tableName: "projects" });

const Service = sequelize.define("Service", {
  title: { type: DataTypes.STRING, allowNull: false },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  icon: { type: DataTypes.STRING, defaultValue: "saas" },
  description: { type: DataTypes.TEXT },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
}, { tableName: "services" });

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

const Board = sequelize.define("Board", {
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  color: { type: DataTypes.STRING, defaultValue: "#3e60ab" },
  columns: { type: DataTypes.JSON, defaultValue: [] },
  labels: { type: DataTypes.JSON, defaultValue: [] },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "boards" });

const Task = sequelize.define("Task", {
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  boardId: { type: DataTypes.INTEGER },
  column: { type: DataTypes.STRING, defaultValue: "backlog" },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  priority: { type: DataTypes.ENUM("low", "medium", "high"), defaultValue: "medium" },
  dueDate: { type: DataTypes.DATEONLY },
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  cover: { type: DataTypes.STRING },
  memberIds: { type: DataTypes.JSON, defaultValue: [] },
  labelIds: { type: DataTypes.JSON, defaultValue: [] },
  checklist: { type: DataTypes.JSON, defaultValue: [] },
  attachments: { type: DataTypes.JSON, defaultValue: [] },
  assignee: { type: DataTypes.STRING },
  label: { type: DataTypes.STRING },
}, { tableName: "tasks" });

const Comment = sequelize.define("Comment", {
  taskId: { type: DataTypes.INTEGER, allowNull: false },
  userId: { type: DataTypes.INTEGER },
  body: { type: DataTypes.TEXT, allowNull: false },
}, { tableName: "task_comments" });

const Seo = sequelize.define("Seo", {
  page: { type: DataTypes.STRING, allowNull: false, unique: true },
  title: { type: DataTypes.STRING },
  description: { type: DataTypes.TEXT },
  keywords: { type: DataTypes.STRING },
  ogImage: { type: DataTypes.STRING },
  canonical: { type: DataTypes.STRING },
  noindex: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: "seo_meta" });

const Page = sequelize.define("Page", {
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT("long") },
  status: { type: DataTypes.ENUM("draft", "published"), defaultValue: "published" },
}, { tableName: "pages" });

const Lead = sequelize.define("Lead", {
  name: { type: DataTypes.STRING, allowNull: false },
  company: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING },
  phone: { type: DataTypes.STRING },
  source: { type: DataTypes.STRING, defaultValue: "Website" },
  stage: { type: DataTypes.ENUM("new", "contacted", "qualified", "proposal", "won", "lost"), defaultValue: "new" },
  value: { type: DataTypes.INTEGER, defaultValue: 0 },
  owner: { type: DataTypes.STRING },
  priority: { type: DataTypes.ENUM("low", "medium", "high"), defaultValue: "medium" },
  nextFollowUp: { type: DataTypes.DATEONLY },
  notes: { type: DataTypes.TEXT },
  purpose: { type: DataTypes.STRING },
  progress: { type: DataTypes.INTEGER, defaultValue: 0 },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: "leads" });

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

const Setting = sequelize.define("Setting", {
  key: { type: DataTypes.STRING, allowNull: false, unique: true },
  value: { type: DataTypes.TEXT },
  group: { type: DataTypes.STRING, defaultValue: "general" },
  isPublic: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: "settings" });

BlogPost.belongsTo(User, { as: "editor", foreignKey: { name: "userId", allowNull: true } });
User.hasMany(BlogPost, { as: "posts", foreignKey: "userId" });

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
