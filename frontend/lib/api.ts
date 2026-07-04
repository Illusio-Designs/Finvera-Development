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

export const getProjects = async () => (await apiGet<Project[]>("/projects", [])).map(normProject);
export const getServices = () => apiGet<Service[]>("/services", []);
export const getTestimonials = () => apiGet<Testimonial[]>("/testimonials", []);
export const getTeam = () => apiGet<TeamMember[]>("/team", []);
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

export async function getPage(slug: string): Promise<Page | undefined> {
  try {
    const res = await fetch(`${API}/api/pages/${slug}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return undefined;
    return (await res.json()) as Page;
  } catch { return undefined; }
}

const DEFAULT_SEO: Seo = {
  page: "home",
  title: "Finvera — Future-Driven SaaS & CRM Development",
  description: "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale and innovate.",
};

export const getSeo = (page: string) => apiGet<Seo>(`/seo/${page}`, { ...DEFAULT_SEO, page });
export const getSettings = () => apiGet<Settings>("/settings", {});

/* Editable content collections */
export const getFaqs = () => apiGet<Faq[]>("/faqs", []);
export const getValues = () => apiGet<ValueItem[]>("/values", []);
export const getBrands = () => apiGet<Brand[]>("/brands", []);
export const getMilestones = () => apiGet<Milestone[]>("/milestones", []);
export const getProcessSteps = () => apiGet<ProcessStep[]>("/process-steps", []);
export const getStats = () => apiGet<Stat[]>("/stats", []);
export const getLogos = () => apiGet<Logo[]>("/logos", []);
export const getFeatures = () => apiGet<Feature[]>("/features", []);

export const apiBase = API;
export const contactEndpoint = `${API}/api/contact`;
