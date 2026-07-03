/* =========================================================
   Server-side API client (SSR) — live data only.
   Fetches from the backend; on failure returns empty data
   (or minimal metadata defaults) so the build never breaks.
   ========================================================= */
import type { Project, Service, Testimonial, TeamMember, BlogPost, Seo, Settings } from "./types";

const API = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "https://api.finvera.solutions").replace(/\/$/, "");

/** ISR revalidation seconds for API data. 0 = always fresh. */
const REVALIDATE = Number(process.env.API_REVALIDATE ?? 60);

async function apiGet<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}/api${path}`, {
      next: { revalidate: REVALIDATE },
      headers: { accept: "application/json" },
    });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const getProjects = () => apiGet<Project[]>("/projects", []);
export const getServices = () => apiGet<Service[]>("/services", []);
export const getTestimonials = () => apiGet<Testimonial[]>("/testimonials", []);
export const getTeam = () => apiGet<TeamMember[]>("/team", []);
export const getBlog = () => apiGet<BlogPost[]>("/blog", []);

export async function getProject(slug: string): Promise<Project | undefined> {
  try {
    const res = await fetch(`${API}/api/projects/${slug}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return undefined;
    return (await res.json()) as Project;
  } catch { return undefined; }
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  try {
    const res = await fetch(`${API}/api/blog/${slug}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return undefined;
    return (await res.json()) as BlogPost;
  } catch { return undefined; }
}

const DEFAULT_SEO: Seo = {
  page: "home",
  title: "Finvera — Future-Driven SaaS & CRM Development",
  description: "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale and innovate.",
};

export const getSeo = (page: string) => apiGet<Seo>(`/seo/${page}`, { ...DEFAULT_SEO, page });
export const getSettings = () => apiGet<Settings>("/settings", {});

export const apiBase = API;
export const contactEndpoint = `${API}/api/contact`;
