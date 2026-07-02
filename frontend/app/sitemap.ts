import type { MetadataRoute } from "next";
import { getBlog } from "@/lib/api";

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

  return [...staticRoutes, ...posts];
}
