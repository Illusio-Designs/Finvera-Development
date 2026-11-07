/* Real dashboard routes, grouped by the work they support. The backend remains
   authoritative for access; these areas also drive the shell route guard. */
import {
  DashboardSquare01Icon, Briefcase01Icon, Layers01Icon, QuoteDownIcon, UserGroupIcon, News01Icon, Note01Icon,
  TextFontIcon, Target02Icon, Mail01Icon, RepeatIcon, Calendar03Icon, AnalyticsUpIcon, Search01Icon,
  Settings02Icon, UserMultipleIcon, Activity01Icon, ServerStack01Icon, UserIcon, Upload01Icon, UserAdd01Icon,
  Add01Icon, DatabaseBackupIcon, Shield01Icon,
} from "@hugeicons/core-free-icons";
import type { Area } from "@/lib/permissions";

export type Icon = typeof DashboardSquare01Icon;
export type NavItem = { href: string; label: string; icon: Icon; area: Area | null; description?: string; collection?: boolean };
export type NavGroup = { key: string; label: string; shortLabel: string; icon: Icon; eyebrow: string; description: string; items: NavItem[] };

const sections: NavItem[] = [
  ["faqs", "FAQs"], ["values", "Values"], ["brands", "Brand ecosystem"], ["timeline", "Company timeline"],
  ["process", "Process steps"], ["stats", "Website stats"], ["logos", "Client logos"], ["features", "Solution features"],
].map(([id, label]) => ({ href: `/dashboard/${id}`, label, icon: Layers01Icon, area: "content" as const, collection: true }));

export const NAV_GROUPS: NavGroup[] = [
  { key: "home", label: "Workspace", shortLabel: "Today", icon: DashboardSquare01Icon, eyebrow: "Your daily perspective", description: "A little clarity. Better work.", items: [
    { href: "/dashboard", label: "Overview", icon: DashboardSquare01Icon, area: null, description: "What needs you today" },
  ] },
  { key: "social", label: "Social media", shortLabel: "Social", icon: Calendar03Icon, eyebrow: "Make & publish", description: "From first idea to live post.", items: [
    { href: "/dashboard/social", label: "Content calendar", icon: Calendar03Icon, area: "social", description: "Plan, produce & publish" },
    { href: "/dashboard/social-studio", label: "Social studio", icon: AnalyticsUpIcon, area: "social", description: "Accounts & performance" },
    { href: "/dashboard/reports", label: "Social reports", icon: AnalyticsUpIcon, area: "social", description: "Team work & client results" },
  ] },
  { key: "sales", label: "Sales", shortLabel: "Sales", icon: Target02Icon, eyebrow: "Conversations that count", description: "Give every opportunity a next step.", items: [
    { href: "/dashboard/leads", label: "Leads", icon: Target02Icon, area: "leads", description: "Conversations to opportunities" },
    { href: "/dashboard/contact", label: "Contact inbox", icon: Mail01Icon, area: "contact", description: "Enquiries, in one place" },
  ] },
  { key: "clients", label: "Client operations", shortLabel: "Clients", icon: RepeatIcon, eyebrow: "Keep things moving", description: "The services clients rely on.", items: [
    { href: "/dashboard/renewals", label: "Renewals", icon: RepeatIcon, area: "renewals", description: "Keep client services running" },
  ] },
  { key: "website", label: "Website", shortLabel: "Website", icon: Layers01Icon, eyebrow: "Your public presence", description: "Keep every detail considered.", items: [
    { href: "/dashboard/content", label: "Website overview", icon: TextFontIcon, area: "content", description: "Your public website" },
    { href: "/dashboard/projects", label: "Portfolio", icon: Briefcase01Icon, area: "content", description: "Case studies & good work" },
    { href: "/dashboard/services", label: "Services", icon: Layers01Icon, area: "content" },
    { href: "/dashboard/blog", label: "Blog", icon: News01Icon, area: "content" },
    { href: "/dashboard/pages", label: "Website pages", icon: Note01Icon, area: "content" },
    { href: "/dashboard/team", label: "Website team", icon: UserGroupIcon, area: "content", description: "Public profiles" },
    { href: "/dashboard/testimonials", label: "Testimonials", icon: QuoteDownIcon, area: "content" },
    { href: "/dashboard/seo", label: "SEO & sharing", icon: Search01Icon, area: "seo" },
    ...sections,
  ] },
  { key: "admin", label: "Administration", shortLabel: "Admin", icon: Settings02Icon, eyebrow: "Behind the work", description: "People, settings and a healthy system.", items: [
    { href: "/dashboard/users", label: "Users & access", icon: UserMultipleIcon, area: "users", description: "People, roles & security" },
    { href: "/dashboard/activity", label: "Activity log", icon: Activity01Icon, area: "users" },
    { href: "/dashboard/settings", label: "Settings & tracking", icon: Settings02Icon, area: "settings" },
    { href: "/dashboard/system", label: "System health", icon: ServerStack01Icon, area: "users" },
  ] },
];

export const EXTRA_PAGES: NavItem[] = [
  { href: "/dashboard/account", label: "My account", icon: UserIcon, area: null, description: "Your profile & sign-in security" },
];
export const SUB_PAGES = sections.map((item) => ({ href: item.href, label: item.label, parent: "/dashboard/content" }));

/* Actions open the existing real page; labels never imply a write occurred. */
export type QuickAction = { label: string; sub: string; href: string; icon: Icon; area: Area | null };
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add a lead", sub: "Leads", href: "/dashboard/leads", icon: Add01Icon, area: "leads" },
  { label: "Import a sheet", sub: "Content calendar", href: "/dashboard/social", icon: Upload01Icon, area: "social" },
  { label: "New case study", sub: "Portfolio", href: "/dashboard/projects", icon: Add01Icon, area: "content" },
  { label: "Write a blog post", sub: "Blog", href: "/dashboard/blog", icon: Add01Icon, area: "content" },
  { label: "Add a renewal", sub: "Renewals", href: "/dashboard/renewals", icon: Add01Icon, area: "renewals" },
  { label: "Invite member", sub: "Users & access", href: "/dashboard/users", icon: UserAdd01Icon, area: "users" },
  { label: "Security log", sub: "Users & access", href: "/dashboard/users?tab=log", icon: Shield01Icon, area: "users" },
  { label: "Backups", sub: "System health", href: "/dashboard/system#backups", icon: DatabaseBackupIcon, area: "users" },
  { label: "My account", sub: "Profile, password, sign-ins", href: "/dashboard/account", icon: UserIcon, area: null },
];

export const ALL_PAGES: NavItem[] = [...NAV_GROUPS.flatMap((group) => group.items), ...EXTRA_PAGES];
export function matchItem(pathname: string): NavItem | undefined {
  return ALL_PAGES.filter((item) => item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
export const groupFor = (item: NavItem | undefined) => item ? NAV_GROUPS.find((group) => group.items.includes(item)) : undefined;
export const groupOf = (item: NavItem | undefined) => groupFor(item)?.label ?? (item?.href === "/dashboard/account" ? "Personal" : null);
export const initials = (name?: string | null) => (name || "").trim().split(/\s+/).map((word) => word[0] || "").slice(0, 2).join("").toUpperCase();
