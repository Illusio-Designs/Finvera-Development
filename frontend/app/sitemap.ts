import { validPageSlug } from "@/lib/websitePages";
import type { MetadataRoute } from "next";
import { getBlog, getProjects, getPages } from "@/lib/api";

export const dynamic = "force-static";
export const revalidate = 60;

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.finvera.solutions").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/about", "/services", "/solutions", "/work", "/blog", "/contact"].map((r) => ({
    url: `${base}${r}`,
    changeFrequency: "weekly" as const,
    priority: r === "" ? 1 : 0.7,
  }));

  let posts: MetadataRoute.Sitemap = [];
  try {
    posts = (await getBlog())
      .filter((p) => p.status === "published")
      .map((p) => ({ url: `${base}/blog/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.6, lastModified: p.publishedAt || undefined }));
  } catch { /* ignore */ }

  let projects: MetadataRoute.Sitemap = [];
  try {
    projects = (await getProjects())
      .filter((p) => p.status === "published")
      .map((p) => ({ url: `${base}/work/${p.slug}`, changeFrequency: "monthly" as const, priority: 0.6 }));
  } catch { /* ignore */ }

  const pages = (await getPages()).filter(page => page.status === "published" && validPageSlug(page.slug)).map(page => ({ url: `${base}/${page.slug}`, changeFrequency: "monthly" as const, priority: 0.4, lastModified: page.updatedAt || undefined }));
  return [...staticRoutes, ...posts, ...projects, ...pages];
}
