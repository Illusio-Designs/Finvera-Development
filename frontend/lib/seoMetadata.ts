import type { Metadata } from "next";
export const SEO_PAGES = ["home", "about", "services", "solutions", "work", "blog", "contact"];
export const seoLabel = (page: string) => page === "home" ? "Home" : page.charAt(0).toUpperCase() + page.slice(1);
export type SeoValues = { page: string; title?: string | null; description?: string | null; keywords?: string | null; canonical?: string | null; ogImage?: string | null; noindex?: boolean };
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.finvera.solutions").replace(/\/$/, "");
const httpUrl = (value: string | null | undefined, local = false) => {
  if (!value) return undefined;
  try { const url = new URL(value, local ? siteUrl : undefined); return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined; } catch { return undefined; }
};
export function seoPresentation(row: SeoValues) {
  const path = row.page === "home" ? "/" : `/${row.page}`;
  const title = row.title?.trim() || (row.page === "home" ? "Finvera — Future-Driven SaaS & CRM Development" : `${seoLabel(row.page)} — Finvera`);
  const description = row.description?.trim() || "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale and innovate.";
  return { title, description, url: httpUrl(row.canonical?.trim()) || `${siteUrl}${path}` };
}
export function seoMetadata(row: SeoValues): Metadata {
  const { title, description, url } = seoPresentation(row);
  const image = httpUrl(row.ogImage, true);
  return { title: { absolute: title }, description, keywords: row.keywords || undefined,
    alternates: { canonical: url }, robots: { index: !row.noindex, follow: true },
    openGraph: { title, description, url, type: "website", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) } };
}
