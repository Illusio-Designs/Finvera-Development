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
export type TeamMember = { id: number; name: string; role: string; initials: string; bio: string; photo?: string | null };
export type BlogPost = {
  id: number; title: string; slug: string; excerpt: string; content: string;
  coverImage: string | null; author: string; category: string; tags: string[];
  status: string; publishedAt: string | null;
  seoTitle?: string; seoDescription?: string; seoKeywords?: string;
};
export type Page = { id: number; slug: string; title: string; content: string; status: string; updatedAt?: string };
export type Seo = { page: string; title: string; description: string; keywords?: string; ogImage?: string; noindex?: boolean };
export type Settings = Record<string, string>;

/* Editable content collections (CMS) */
export type Faq = { id: number; question: string; answer: string; position?: number; status?: string };
export type ValueItem = { id: number; title: string; description: string; icon: string; position?: number; status?: string };
export type Brand = { id: number; name: string; category: string; description: string; icon: string; position?: number; status?: string };
export type Milestone = { id: number; year: string; title: string; description: string; position?: number; status?: string };
export type ProcessStep = { id: number; step: string; title: string; description: string; icon: string; position?: number; status?: string };
export type Stat = { id: number; value: string; label: string; position?: number; status?: string };
export type Logo = { id: number; name: string; image?: string; position?: number; status?: string };
export type Feature = { id: number; title: string; description: string; position?: number; status?: string };
