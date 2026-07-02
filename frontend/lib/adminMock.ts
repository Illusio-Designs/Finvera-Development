/* =========================================================
   Local (mock) admin backend — persists to localStorage.
   Used when NEXT_PUBLIC_API_URL is not set, so the whole
   admin (CRUD, users, contact, kanban, settings, SEO) works
   without a live backend.
   ========================================================= */
"use client";
import * as mock from "./mock";

const KEY = "fv_admin_db_v1";

type Row = Record<string, any>;
type Column = { id: string; title: string };
type DB = {
  projects: Row[]; services: Row[]; testimonials: Row[]; team: Row[]; blog: Row[];
  users: Row[]; contact: Row[]; tasks: Row[]; columns: Column[];
  settings: Row[]; seo: Row[]; _seq: number;
};

const groupOf = (key: string) =>
  key.startsWith("social") ? "social"
  : (key.includes("analytics") || key.includes("pixel") || key.includes("tag_manager") || key.includes("verification")) ? "analytics"
  : "general";

function seedDb(): DB {
  return {
    projects: mock.projects.map((p) => ({ ...p, position: p.id })),
    services: mock.services.map((s) => ({ ...s, position: s.id })),
    testimonials: mock.testimonials.map((t) => ({ ...t, position: t.id })),
    team: mock.team.map((t) => ({ ...t, position: t.id })),
    blog: mock.blog.map((b) => ({ ...b })),
    users: [
      { id: 1, name: "Admin", email: "finvetasolutionsllp@gmail.com", role: "admin", active: true, createdAt: new Date().toISOString() },
      { id: 2, name: "Maya Chen", email: "maya@finvera.solutions", role: "editor", active: true, createdAt: new Date().toISOString() },
    ],
    contact: [
      { id: 1, name: "Ravi Shah", email: "ravi@acmeindia.com", company: "Acme India", projectType: "SaaS platform", message: "We're looking to build a multi-tenant SaaS MVP in about 8 weeks. Can we set up a call this week?", isRead: false, createdAt: new Date(Date.now() - 3600e3).toISOString() },
      { id: 2, name: "Priya Nair", email: "priya@nairco.in", company: "Nair & Co", projectType: "CRM system", message: "Need a custom CRM with lead scoring and a migration from HubSpot.", isRead: true, createdAt: new Date(Date.now() - 86400e3).toISOString() },
    ],
    columns: [
      { id: "backlog", title: "Backlog" }, { id: "todo", title: "To Do" },
      { id: "inprogress", title: "In Progress" }, { id: "review", title: "Review" }, { id: "done", title: "Done" },
    ],
    tasks: [
      { id: 1, title: "Antimatter AI — homepage revamp", description: "Redesign hero + services section.", column: "inprogress", position: 0, assignee: "Maya", priority: "high", label: "Design" },
      { id: 2, title: "Stallion Eyewear — B2B checkout", description: "Bulk order flow + tiered pricing.", column: "todo", position: 0, assignee: "Liam", priority: "high", label: "Dev" },
      { id: 3, title: "CrossCoin — KYC integration", description: "Integrate KYC provider API.", column: "backlog", position: 0, assignee: "Arjun", priority: "medium", label: "Backend" },
      { id: 4, title: "Velmique — PDP polish", description: "Product detail page animations.", column: "review", position: 0, assignee: "Maya", priority: "low", label: "Design" },
      { id: 5, title: "Nanak Finserv — launch", description: "Final QA and go-live.", column: "done", position: 0, assignee: "Nadia", priority: "medium", label: "QA" },
      { id: 6, title: "Finvera site — blog CMS", description: "Wire blog to backend.", column: "todo", position: 1, assignee: "Liam", priority: "medium", label: "Dev" },
    ],
    settings: Object.entries(mock.settings).map(([key, value]) => ({ key, value, group: groupOf(key), isPublic: !key.startsWith("kanban") })),
    seo: Object.values(mock.seo).map((s) => ({ ...s })),
    _seq: 1000,
  };
}

function load(): DB {
  if (typeof window === "undefined") return seedDb();
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch { /* */ }
  const db = seedDb();
  save(db);
  return db;
}
function save(db: DB) { if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(db)); }
function nextId(db: DB) { db._seq += 1; return db._seq; }
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const wait = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(clone(v)), 90));

const slugify = (s: string) => String(s || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

export const mockApi = {
  login: async (email: string) =>
    wait({ token: "mock-token", user: { id: 1, name: "Admin", email: email || "admin@finvera.solutions", role: "admin" } }),
  me: async () => wait({ user: { id: 1, name: "Admin", role: "admin" } }),

  list: async (resource: string) => {
    const db = load();
    return wait((db as any)[resource] || []);
  },
  create: async (resource: string, body: Row) => {
    const db = load();
    const arr = (db as any)[resource] as Row[];
    const row: Row = { ...body, id: nextId(db) };
    if ("slug" in (arr[0] || body) || ["projects", "services", "blog"].includes(resource)) {
      row.slug = slugify(body.slug || body.title);
    }
    arr.push(row); save(db);
    return wait(row);
  },
  update: async (resource: string, id: number, body: Row) => {
    const db = load();
    const arr = (db as any)[resource] as Row[];
    const idx = arr.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Not found");
    arr[idx] = { ...arr[idx], ...body, id };
    save(db);
    return wait(arr[idx]);
  },
  remove: async (resource: string, id: number) => {
    const db = load();
    (db as any)[resource] = ((db as any)[resource] as Row[]).filter((r) => r.id !== id);
    save(db);
    return wait({ message: "Deleted", id });
  },

  getSettings: async () => { const db = load(); return wait(db.settings); },
  saveSettings: async (values: Record<string, string>) => {
    const db = load();
    Object.entries(values).forEach(([key, value]) => {
      const row = db.settings.find((s) => s.key === key);
      if (row) row.value = value;
      else db.settings.push({ key, value, group: groupOf(key), isPublic: true });
    });
    save(db);
    return wait(db.settings);
  },

  listSeo: async () => { const db = load(); return wait(db.seo); },
  saveSeo: async (page: string, body: Row) => {
    const db = load();
    const idx = db.seo.findIndex((s) => s.page === page);
    if (idx === -1) db.seo.push({ ...body, page });
    else db.seo[idx] = { ...db.seo[idx], ...body, page };
    save(db);
    return wait(body);
  },

  listContact: async () => { const db = load(); return wait(db.contact); },
  markContact: async (id: number, isRead: boolean) => {
    const db = load(); const m = db.contact.find((c) => c.id === id); if (m) m.isRead = isRead; save(db); return wait(m);
  },
  removeContact: async (id: number) => {
    const db = load(); db.contact = db.contact.filter((c) => c.id !== id); save(db); return wait({ id });
  },

  upload: async (file: File): Promise<{ url: string }> => {
    const url: string = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    return { url };
  },

  /* Kanban */
  getColumns: async () => { const db = load(); return wait(db.columns); },
  saveColumns: async (columns: Column[]) => { const db = load(); db.columns = columns; save(db); return wait(columns); },
  listTasks: async () => { const db = load(); return wait(db.tasks); },
  createTask: async (body: Row) => {
    const db = load(); const row = { ...body, id: nextId(db) }; db.tasks.push(row); save(db); return wait(row);
  },
  updateTask: async (id: number, body: Row) => {
    const db = load(); const t = db.tasks.find((x) => x.id === id); if (t) Object.assign(t, body); save(db); return wait(t);
  },
  deleteTask: async (id: number) => {
    const db = load(); db.tasks = db.tasks.filter((x) => x.id !== id); save(db); return wait({ id });
  },

  reset: () => { if (typeof window !== "undefined") { localStorage.removeItem(KEY); save(seedDb()); } },
};
