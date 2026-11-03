/* Settings & pixels — what each setting key is, how it is shown and checked.
   Only the keys listed here are edited on the page; internal keys (seed
   version, board columns, migration markers) are never shown or sent back.
   The server repeats the safety checks (Backendjs settings controller). */
import type { IconSvgElement } from "@hugeicons/react";
import {
  ChartLineData01Icon, Building06Icon, Link04Icon, Facebook01Icon, GoogleIcon, Tag01Icon,
  NewTwitterIcon, Linkedin01Icon, Github01Icon,
} from "@hugeicons/core-free-icons";

export type Kind = "id" | "text" | "email" | "phone" | "textarea" | "url";
export type Issue = { level: "err" | "warn"; text: string };

export type Field = {
  key: string;
  label: string;
  hint?: string;
  kind: Kind;
  placeholder?: string;
  /* tracking IDs: the exact format, what to say when it's off, where to find it */
  re?: RegExp;
  bad?: string;
  tip?: string;
  tipLink?: { label: string; href: string };
  logo?: { icon?: IconSvgElement; text?: string; tone: string };
  /* social links: the site the link should point at */
  host?: RegExp;
  site?: string;
  example?: string;
};

export type Section = { id: string; title: string; sub: string; icon: IconSvgElement; fields: Field[] };

export const SECTIONS: Section[] = [
  {
    id: "analytics", title: "Analytics & pixels", icon: ChartLineData01Icon,
    sub: "Connect Google Analytics, Tag Manager and the Facebook Pixel. Leave a box empty to turn that one off.",
    fields: [
      {
        key: "google_analytics_id", label: "Google Analytics 4 ID", hint: "Looks like G-XXXXXXXXXX", kind: "id", placeholder: "G-XXXXXXXXXX",
        re: /^G-[A-Z0-9]{6,12}$/i, bad: "Starts with G- followed by letters and numbers, like G-7QK2M4X9TL.",
        tip: "In Google Analytics open Admin → Data streams → your website. Copy the Measurement ID at the top right.",
        tipLink: { label: "Open Google Analytics", href: "https://analytics.google.com/" },
        logo: { text: "GA4", tone: "amber" },
      },
      {
        key: "google_tag_manager_id", label: "Google Tag Manager ID", hint: "Looks like GTM-XXXXXXX", kind: "id", placeholder: "GTM-XXXXXXX",
        re: /^GTM-[A-Z0-9]{4,10}$/i, bad: "Starts with GTM- followed by letters and numbers, like GTM-5FJ8K2L.",
        tip: "In Tag Manager open your container. The ID is shown at the top, next to the workspace name.",
        tipLink: { label: "Open Tag Manager", href: "https://tagmanager.google.com/" },
        logo: { icon: Tag01Icon, tone: "blue" },
      },
      {
        key: "facebook_pixel_id", label: "Facebook Pixel ID", hint: "15–16 digits from Events Manager", kind: "id", placeholder: "15–16 digits",
        re: /^\d{15,16}$/, bad: "A Meta Pixel ID is 15 or 16 digits — numbers only.",
        tip: "In Meta Events Manager open Data sources and pick your pixel. The ID is the number under its name.",
        tipLink: { label: "Open Events Manager", href: "https://business.facebook.com/events_manager2" },
        logo: { icon: Facebook01Icon, tone: "fb" },
      },
      {
        key: "google_site_verification", label: "Google site verification", hint: "The content value from Search Console", kind: "id", placeholder: "Paste the code or the whole tag",
        re: /^[A-Za-z0-9_\-+=/.]{20,100}$/, bad: "Paste only the code from the content=\"…\" part of the tag.",
        tip: "In Search Console add the property, choose the HTML tag method and copy the tag. You can paste the whole tag — only the code is kept.",
        tipLink: { label: "Open Search Console", href: "https://search.google.com/search-console" },
        logo: { icon: GoogleIcon, tone: "green" },
      },
    ],
  },
  {
    id: "general", title: "General", icon: Building06Icon,
    sub: "Brand and contact details. The contact page shows the email, phone and address.",
    fields: [
      { key: "site_name", label: "Site name", kind: "text", placeholder: "Finvera Solutions LLP" },
      { key: "site_tagline", label: "Tagline", kind: "text", placeholder: "One short line about the business" },
      { key: "contact_email", label: "Contact email", kind: "email", placeholder: "hello@example.com" },
      { key: "contact_phone", label: "Contact phone", hint: "With the country code, e.g. +91", kind: "phone", placeholder: "+91 98765 43210" },
      { key: "contact_address", label: "Address", kind: "textarea" },
    ],
  },
  {
    id: "social", title: "Social links", icon: Link04Icon,
    sub: "Links to the company's profiles. Use the full address of the profile page.",
    fields: [
      { key: "social_x", label: "X (Twitter)", kind: "url", host: /(^|\.)(x|twitter)\.com$/i, site: "x.com", example: "https://x.com/yourcompany", logo: { icon: NewTwitterIcon, tone: "ink" } },
      { key: "social_linkedin", label: "LinkedIn", kind: "url", host: /(^|\.)linkedin\.com$/i, site: "linkedin.com", example: "https://www.linkedin.com/company/yourcompany", logo: { icon: Linkedin01Icon, tone: "li" } },
      { key: "social_github", label: "GitHub", kind: "url", host: /(^|\.)github\.com$/i, site: "github.com", example: "https://github.com/yourcompany", logo: { icon: Github01Icon, tone: "ink" } },
    ],
  },
];

export const FIELDS = SECTIONS.flatMap((s) => s.fields);
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<string, Field>;
export const sectionOf = (key: string) => SECTIONS.find((s) => s.fields.some((f) => f.key === key))?.id;

/* What is saved for a typed value: trimmed; tracking IDs in capitals; a
   pasted Search Console tag reduced to its code. */
export function clean(key: string, raw: string): string {
  let v = (raw ?? "").trim();
  const f = FIELD[key];
  if (!f) return v;
  if (key === "google_site_verification") {
    const m = v.match(/content\s*=\s*["']([^"']+)["']/i);
    if (m) v = m[1].trim();
  } else if (key === "google_analytics_id" || key === "google_tag_manager_id") {
    v = v.toUpperCase();
  } else if (key === "facebook_pixel_id") {
    v = v.replace(/\s+/g, "");
  }
  return v;
}

/* Tracking ID status pill. */
export type IdStatus = "none" | "ok" | "bad";
export const idStatus = (f: Field, v: string): IdStatus => (!v ? "none" : f.re && !f.re.test(v) ? "bad" : "ok");

const parseUrl = (v: string) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u : null; } catch { return null; } };
export const linkOk = (v: string) => !!v && !!parseUrl(v);

/* Problems with a (cleaned) value. "err" blocks saving; "warn" is a hint. */
export function issueOf(f: Field, v: string): Issue | null {
  if (!v) return null;
  switch (f.kind) {
    case "id":
      return f.re && !f.re.test(v) ? { level: "err", text: f.bad || "Check the format." } : null;
    case "email":
      return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(v) ? null : { level: "err", text: "That doesn't look like an email address." };
    case "phone":
      return /^\+?[\d\s()\-.]{7,20}$/.test(v) && (v.match(/\d/g) || []).length >= 7 ? null : { level: "err", text: "Use digits, spaces and an optional + — like +91 98765 43210." };
    case "url": {
      const u = parseUrl(v);
      if (!u || /[\s<>"']/.test(v)) return { level: "err", text: `Use a full link that starts with https://, like ${f.example}` };
      if (f.host && !f.host.test(u.hostname)) return { level: "warn", text: `This isn't a ${f.site} link — check it's the right profile.` };
      if (u.pathname === "/" || u.pathname === "") return { level: "warn", text: `This is the ${f.label} home page. Add the profile, like ${f.example}` };
      return null;
    }
    default:
      return null;
  }
}
