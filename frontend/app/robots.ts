import type { MetadataRoute } from "next";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.finvera.solutions").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/widgets"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
