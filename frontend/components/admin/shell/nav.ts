/* Admin navigation: sidebar groups, command-palette actions and the
   helpers the shell uses to match the current page. Role gating comes from
   lib/permissions (area null = any signed-in user). */
import {
  DashboardSquare01Icon, Briefcase01Icon, Layers01Icon, QuoteDownIcon, UserGroupIcon, News01Icon, Note01Icon,
  TextFontIcon, Target02Icon, Mail01Icon, KanbanIcon, RepeatIcon, Calendar03Icon, AnalyticsUpIcon, Search01Icon,
  Settings02Icon, UserMultipleIcon, Activity01Icon, ServerStack01Icon, UserIcon, Upload01Icon, UserAdd01Icon,
  Add01Icon, DatabaseBackupIcon, Shield01Icon,
} from "@hugeicons/core-free-icons";
import type { Area } from "@/lib/permissions";

export type Icon = typeof DashboardSquare01Icon;
export type NavItem = { href: string; label: string; icon: Icon; area: Area | null };
export type NavGroup = { key: string; label: string | null; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  { key: "home", label: null, items: [
    { href: "/dashboard", label: "Dashboard", icon: DashboardSquare01Icon, area: null },
  ] },
  { key: "content", label: "Content", items: [
    { href: "/dashboard/projects", label: "Projects", icon: Briefcase01Icon, area: "content" },
    { href: "/dashboard/services", label: "Services", icon: Layers01Icon, area: "content" },
    { href: "/dashboard/testimonials", label: "Testimonials", icon: QuoteDownIcon, area: "content" },
    { href: "/dashboard/team", label: "Team", icon: UserGroupIcon, area: "content" },
    { href: "/dashboard/blog", label: "Blog", icon: News01Icon, area: "content" },
    { href: "/dashboard/pages", label: "Pages", icon: Note01Icon, area: "content" },
    { href: "/dashboard/content", label: "Site content", icon: TextFontIcon, area: "content" },
  ] },
  { key: "sales", label: "Sales", items: [
    { href: "/dashboard/leads", label: "Leads", icon: Target02Icon, area: "leads" },
    { href: "/dashboard/contact", label: "Contact inbox", icon: Mail01Icon, area: "contact" },
  ] },
  { key: "projects", label: "Projects", items: [
    { href: "/dashboard/kanban", label: "Project board", icon: KanbanIcon, area: "board" },
    { href: "/dashboard/renewals", label: "Renewals", icon: RepeatIcon, area: "renewals" },
  ] },
  { key: "social", label: "Social media", items: [
    { href: "/dashboard/social", label: "Content calendar", icon: Calendar03Icon, area: "social" },
    { href: "/dashboard/social-studio", label: "Social studio", icon: AnalyticsUpIcon, area: "social" },
  ] },
  { key: "admin", label: "Admin", items: [
    { href: "/dashboard/seo", label: "SEO", icon: Search01Icon, area: "seo" },
    { href: "/dashboard/settings", label: "Settings & pixels", icon: Settings02Icon, area: "settings" },
    { href: "/dashboard/users", label: "Users", icon: UserMultipleIcon, area: "users" },
    { href: "/dashboard/activity", label: "Activity", icon: Activity01Icon, area: "users" }, // admins only (same gate as Users)
    { href: "/dashboard/system", label: "System", icon: ServerStack01Icon, area: "users" },   // admins only
  ] },
];

/* Pages that are not in the sidebar but still have a title in the top bar. */
export const EXTRA_PAGES: NavItem[] = [
  { href: "/dashboard/account", label: "My account", icon: UserIcon, area: null },
];

/* Site-content sub-pages (reached from Site content): breadcrumb only,
   no route guard — the same as before. */
export const SUB_PAGES: { href: string; label: string; parent: string }[] = [
  ["faqs", "FAQ"], ["values", "Values"], ["brands", "Brands"], ["timeline", "Timeline"], ["process", "Process steps"],
  ["stats", "Stats"], ["logos", "Trusted-by logos"], ["features", "Solution features"],
].map(([k, label]) => ({ href: `/dashboard/${k}`, label, parent: "/dashboard/content" }));

/* Quick actions in the command palette: each opens the page that does it. */
export type QuickAction = { label: string; sub: string; href: string; icon: Icon; area: Area | null };
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add a lead", sub: "Leads", href: "/dashboard/leads", icon: Add01Icon, area: "leads" },
  { label: "Import a sheet", sub: "Content calendar", href: "/dashboard/social", icon: Upload01Icon, area: "social" },
  { label: "New project", sub: "Projects", href: "/dashboard/projects", icon: Add01Icon, area: "content" },
  { label: "Write a blog post", sub: "Blog", href: "/dashboard/blog", icon: Add01Icon, area: "content" },
  { label: "Add a renewal", sub: "Renewals", href: "/dashboard/renewals", icon: Add01Icon, area: "renewals" },
  { label: "Invite member", sub: "Users", href: "/dashboard/users", icon: UserAdd01Icon, area: "users" },
  { label: "Security log", sub: "Users", href: "/dashboard/users?tab=log", icon: Shield01Icon, area: "users" },
  { label: "Back up now", sub: "System", href: "/dashboard/system#backups", icon: DatabaseBackupIcon, area: "users" },
  { label: "My account", sub: "Profile, password, sign-ins", href: "/dashboard/account", icon: UserIcon, area: null },
];

const ALL: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), ...EXTRA_PAGES];

/** Longest-prefix match for the current path (the home only matches itself). */
export function matchItem(pathname: string): NavItem | undefined {
  return ALL
    .filter((n) => (n.href === "/dashboard" ? pathname === "/dashboard" : pathname === n.href || pathname.startsWith(n.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

export const groupOf = (it: NavItem | undefined) => (it ? NAV_GROUPS.find((g) => g.items.includes(it))?.label ?? null : null);

export const initials = (name?: string | null) =>
  (name || "").trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase();
