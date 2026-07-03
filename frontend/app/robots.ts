import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.finvera.solutions").replace(/\/$/, "");

// Private areas kept out of every crawler's index.
const disallow = ["/dashboard", "/login", "/widgets"];

// Major AI / LLM crawlers — explicitly welcomed so the site can be cited and
// surfaced by AI search and assistants.
const aiBots = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot",           // OpenAI
  "ClaudeBot", "anthropic-ai", "Claude-Web",           // Anthropic
  "PerplexityBot", "Perplexity-User",                  // Perplexity
  "Google-Extended",                                   // Google (Gemini/AI)
  "Applebot-Extended",                                 // Apple Intelligence
  "CCBot",                                             // Common Crawl
  "cohere-ai", "Amazonbot", "Meta-ExternalAgent", "Bytespider", "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: aiBots, allow: "/", disallow },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
