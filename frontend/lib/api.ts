/* =========================================================
   Server-side API client (SSR) — live data only.
   Fetches from the backend; on failure returns empty data
   (or minimal metadata defaults) so the build never breaks.
   ========================================================= */
import type { Project, Service, Testimonial, TeamMember, BlogPost, Seo, Settings, Page,
  Faq, ValueItem, Brand, Milestone, ProcessStep, Stat, Logo, Feature } from "./types";

const API = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "https://api.finvera.solutions").replace(/\/$/, "");

/** ISR revalidation seconds for API data. 0 = always fresh. */
const REVALIDATE = Number(process.env.API_REVALIDATE ?? 60);

/* Coerce a tags value (array | JSON string | comma string | null) to a string[]. */
function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith("[")) { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { /* fall through */ } }
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}
const normProject = (p: Project): Project => ({
  ...p,
  tags: toArray(p.tags),
  tech: toArray(p.tech),
  gallery: toArray(p.gallery),
  results: toArray(p.results),
});
const normPost = (p: BlogPost): BlogPost => ({ ...p, tags: toArray(p.tags) });

async function apiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}/api${path}`, {
      next: { revalidate: REVALIDATE },
      headers: { accept: "application/json" },
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    // If we expected a list but got something else, fall back so .map never throws.
    if (Array.isArray(fallback) && !Array.isArray(data)) return fallback;
    return data as T;
  } catch {
    return fallback;
  }
}

/* ── One request for the whole public site ──────────────
   GET /api/public/bootstrap returns settings, SEO for every page and all the
   published content lists in one response. Every page and the layout read
   from it, so a render (and each ISR refresh) costs one API round trip
   instead of one per list; Next's fetch cache dedupes it across the build.
   If the API doesn't have the endpoint yet (older backend), each getter
   falls back to its own endpoint, exactly as before. */
type Bootstrap = {
  settings?: Settings; seo?: Record<string, Seo>;
  projects?: Project[]; services?: Service[]; testimonials?: Testimonial[]; team?: TeamMember[];
  faqs?: Faq[]; values?: ValueItem[]; brands?: Brand[]; milestones?: Milestone[];
  processSteps?: ProcessStep[]; stats?: Stat[]; logos?: Logo[]; features?: Feature[];
};
const getBootstrap = () => apiGet<Bootstrap | null>("/public/bootstrap", null);

async function fromBootstrap<T>(key: keyof Bootstrap, path: string, fallback: T): Promise<T> {
  const b = await getBootstrap();
  const v = b && typeof b === "object" ? (b[key] as unknown) : undefined;
  if (v !== undefined && (!Array.isArray(fallback) || Array.isArray(v))) return v as T;
  return apiGet<T>(path, fallback);
}

export const getProjects = async () => (await fromBootstrap<Project[]>("projects", "/projects", [])).map(normProject);
export const getServices = () => fromBootstrap<Service[]>("services", "/services", []);
export const getTestimonials = () => fromBootstrap<Testimonial[]>("testimonials", "/testimonials", []);
export const getTeam = () => fromBootstrap<TeamMember[]>("team", "/team", []);
export const getBlog = async () => (await apiGet<BlogPost[]>("/blog", [])).map(normPost);

export async function getProject(slug: string): Promise<Project | undefined> {
  try {
    const res = await fetch(`${API}/api/projects/${slug}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return undefined;
    return normProject((await res.json()) as Project);
  } catch { return undefined; }
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  try {
    const res = await fetch(`${API}/api/blog/${slug}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return undefined;
    return normPost((await res.json()) as BlogPost);
  } catch { return undefined; }
}

export const getPages = async () => apiGet<Page[]>("/pages", []);

export async function getPage(slug: string): Promise<Page | undefined> {
  try {
    const res = await fetch(`${API}/api/pages/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!res.ok) return undefined;
    return (await res.json()) as Page;
  } catch { return undefined; }
}

const DEFAULT_SEO: Seo = {
  page: "home",
  title: "Finvera — Future-Driven SaaS & CRM Development",
  description: "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale and innovate.",
};

export async function getSeo(page: string): Promise<Seo> {
  const b = await getBootstrap();
  if (b && b.seo && typeof b.seo === "object") return b.seo[page] || { ...DEFAULT_SEO, page }; // no row → defaults (as a 404 did)
  return apiGet<Seo>(`/seo/${page}`, { ...DEFAULT_SEO, page });
}
export const getSettings = () => fromBootstrap<Settings>("settings", "/settings", {});

/* Editable content collections */
export const getFaqs = () => fromBootstrap<Faq[]>("faqs", "/faqs", []);
export const getValues = () => fromBootstrap<ValueItem[]>("values", "/values", []);
export const getBrands = () => fromBootstrap<Brand[]>("brands", "/brands", []);
export const getMilestones = () => fromBootstrap<Milestone[]>("milestones", "/milestones", []);
export const getProcessSteps = () => fromBootstrap<ProcessStep[]>("processSteps", "/process-steps", []);
export const getStats = () => fromBootstrap<Stat[]>("stats", "/stats", []);
export const getLogos = () => fromBootstrap<Logo[]>("logos", "/logos", []);
export const getFeatures = () => fromBootstrap<Feature[]>("features", "/features", []);

export const apiBase = API;
export const contactEndpoint = `${API}/api/contact`;
