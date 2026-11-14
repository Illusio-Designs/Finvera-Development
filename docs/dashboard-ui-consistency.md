# Dashboard UI consistency

The dashboard uses the existing `WorkspaceHero`, `WorkspaceStats`, `Select`, `PageLoading` and dashboard field/button styles. Pages retain their own data layouts and actions.

## Shared typography and controls

`frontend/components/admin/workspace-tokens.css` defines the dashboard scale and is mounted once at the dashboard layout boundary. `WorkspaceHero` also imports it so standalone/portal usage has the same scale.

| Role | Shared standard |
| --- | --- |
| Page title | Sora, 32px desktop / 26px mobile |
| Dialog title | Sora, 22px |
| Section title | Sora, 18px |
| Body, fields, controls and tabs | Inter, 14px |
| Helper labels and compact details | Inter, 12px |
| Eyebrows and small indices | Inter, 11px |
| Primary controls | 42px minimum height; automatic height for wrapping text |
| Page section spacing | 24px |

Page-specific workspace styles consume these tokens instead of defining competing small-text scales. Table text and dashboard fields use the shared scale. Authored rich-text table content keeps its own formatting.

Headers use `WorkspaceHero`; integrated analytics headers can use its plain variant, and dialog headers can request a compact level-two heading. Decorative header artwork has its own clipping wrapper so dropdowns and calendar tools remain clickable.

## Audit coverage

All 29 dashboard routes were checked in Chromium at 1440px and 375px widths using mocked API data. Checks cover a shared heading font family, 32px/26px titles, no horizontal document overflow and no unhandled page errors. Data tables/boards retain their intentional local scrolling.

| Route | Desktop / mobile page title | Result |
| --- | --- | --- |
| `/dashboard/account` | 32px / 26px | Passed |
| `/dashboard/activity` | 32px / 26px | Passed |
| `/dashboard/blog` | 32px / 26px | Passed |
| `/dashboard/brands` | 32px / 26px | Passed |
| `/dashboard/contact` | 32px / 26px | Passed |
| `/dashboard/content` | 32px / 26px | Passed |
| `/dashboard/faqs` | 32px / 26px | Passed |
| `/dashboard/features` | 32px / 26px | Passed |
| `/dashboard/leads` | 32px / 26px | Passed |
| `/dashboard/logos` | 32px / 26px | Passed |
| `/dashboard` | 32px / 26px | Passed |
| `/dashboard/pages` | 32px / 26px | Passed |
| `/dashboard/process` | 32px / 26px | Passed |
| `/dashboard/projects` | 32px / 26px | Passed |
| `/dashboard/renewals` | 32px / 26px | Passed |
| `/dashboard/reports` | 32px / 26px | Passed |
| `/dashboard/seo` | 32px / 26px | Passed |
| `/dashboard/services` | 32px / 26px | Passed |
| `/dashboard/settings` | 32px / 26px | Passed |
| `/dashboard/social` | 32px / 26px | Passed |
| `/dashboard/social-profiles` | 32px / 26px | Passed |
| `/dashboard/social-studio` | 32px / 26px | Passed |
| `/dashboard/stats` | 32px / 26px | Passed |
| `/dashboard/system` | 32px / 26px | Passed |
| `/dashboard/team` | 32px / 26px | Passed |
| `/dashboard/testimonials` | 32px / 26px | Passed |
| `/dashboard/timeline` | 32px / 26px | Passed |
| `/dashboard/users` | 32px / 26px | Passed |
| `/dashboard/values` | 32px / 26px | Passed |

Interaction checks cover Studio's brand dropdown, mobile calendar tools, profile editor save/failure/discard/member flows, shared dialog headings, a FAQ editor, and client report previews/Excel downloads. Client-only report filtering is preserved.

The dashboard UI regression test rejects new page-local `h1` markup outside the shared header and verifies that typography tokens remain mounted at the dashboard boundary. A new page should compose the shared components and reuse existing selectors/fields before adding a page-specific pattern.
