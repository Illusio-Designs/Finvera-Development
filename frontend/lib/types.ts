/* Shared data types (mirror the backend API responses). */

export type Project = {
  id: number; title: string; slug: string; category: string; url: string;
  tags: string[]; blurb: string; content?: string;
  desktopImage: string | null; mobileImage: string | null; coverImage: string | null;
  featured: boolean; status: string;
  // case-study / trust fields
  client?: string; industry?: string; year?: string; duration?: string; role?: string;
  challenge?: string; approach?: string;
  results?: string[]; tech?: string[]; gallery?: string[];   // results: "value — label" strings
  testimonialQuote?: string; testimonialName?: string; testimonialRole?: string;
};
export type Service = { id: number; title: string; slug: string; icon: string; description: string };
export type Testimonial = { id: number; name: string; role: string; company: string; avatar: string; quote: string; rating: number };
export type TeamMember = { id: number; name: string; role: string; initials: string; bio: string };
export type BlogPost = {
  id: number; title: string; slug: string; excerpt: string; content: string;
  coverImage: string | null; author: string; category: string; tags: string[];
  status: string; publishedAt: string | null;
  seoTitle?: string; seoDescription?: string; seoKeywords?: string;
};
export type Seo = { page: string; title: string; description: string; keywords?: string; ogImage?: string; noindex?: boolean };
export type Settings = Record<string, string>;
