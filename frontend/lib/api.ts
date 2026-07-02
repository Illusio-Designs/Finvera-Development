/* =========================================================
   Server-side API client (SSR).
   Fetches from the backend when API_URL is configured;
   falls back to mock data so the site works before deploy.
   ========================================================= */
import * as mock from "./mock";
import type { Project, Service, Testimonial, TeamMember, BlogPost, Seo, Settings } from "./mock";

const API = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

/** How often SSR pages revalidate their data (ISR). 0 = always fresh. */
const REVALIDATE = Number(process.env.API_REVALIDATE ?? 60);

async function apiGet<T>(path: string, fallback: T): Promise<T> {
  if (!API) return fallback;
  try {
    const res = await fetch(`${API}/api${path}`, {
      next: { revalidate: REVALIDATE },
      headers: { accept: "application/json" },
    });
    if (!res.ok) return fallback;
    const data = (await res.json()) as T;
    // guard against empty arrays wiping the UI
    if (Array.isArray(data) && data.length === 0 && Array.isArray(fallback) && (fallback as unknown[]).length) return fallback;
    return data;
  } catch {
    return fallback;
  }
}

export const getProjects = () => apiGet<Project[]>("/projects", mock.projects);
export const getServices = () => apiGet<Service[]>("/services", mock.services);
export const getTestimonials = () => apiGet<Testimonial[]>("/testimonials", mock.testimonials);
export const getTeam = () => apiGet<TeamMember[]>("/team", mock.team);
export const getBlog = () => apiGet<BlogPost[]>("/blog", mock.blog);

export async function getProject(slug: string): Promise<Project | undefined> {
  const fallback = mock.projects.find((x) => x.slug === slug);
  if (!API) return fallback;
  try {
    const res = await fetch(`${API}/api/projects/${slug}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return fallback;
    return (await res.json()) as Project;
  } catch { return fallback; }
}

export async function getPost(slug: string): Promise<BlogPost | undefined> {
  const fallback = mock.blog.find((x) => x.slug === slug);
  if (!API) return fallback;
  try {
    const res = await fetch(`${API}/api/blog/${slug}`, { next: { revalidate: REVALIDATE } });
    if (!res.ok) return fallback;
    return (await res.json()) as BlogPost;
  } catch { return fallback; }
}

export const getSeo = (page: string) => apiGet<Seo>(`/seo/${page}`, mock.seo[page] || { page, title: "Finvera", description: mock.settings.site_tagline });
export const getSettings = () => apiGet<Settings>("/settings", mock.settings);

export const apiBase = API;
export const contactEndpoint = API ? `${API}/api/contact` : "";
