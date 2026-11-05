"use client";
import PageLoading from "@/components/admin/PageLoading";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Search01Icon, Refresh01Icon, Cancel01Icon, Layers01Icon } from "@hugeicons/core-free-icons";
import { api, type WebsiteOverview } from "@/lib/adminApi";
import { NAV_GROUPS } from "@/components/admin/shell/nav";
import "./website-workspace.css";

const COLLECTIONS = [
  { resource: "projects", route: "projects", group: "main", description: "Show the work you want clients to discover.", placement: "Work & case studies", tone: "blue" },
  { resource: "services", route: "services", group: "main", description: "Keep your service offering clear and current.", placement: "Services", tone: "violet" },
  { resource: "blog", route: "blog", group: "main", description: "Write, review and publish your ideas.", placement: "Journal & articles", tone: "amber" },
  { resource: "pages", route: "pages", group: "main", description: "Manage the pages behind your public website.", placement: "Standalone pages", tone: "mint" },
  { resource: "team", route: "team", group: "main", description: "Introduce the people behind the work.", placement: "About · team profiles", tone: "rose" },
  { resource: "testimonials", route: "testimonials", group: "main", description: "Share the words your clients leave with you.", placement: "Client stories", tone: "blue" },
  { resource: "faqs", route: "faqs", group: "sections", description: "Answer the questions clients ask most.", placement: "Home · questions", tone: "blue" },
  { resource: "values", route: "values", group: "sections", description: "The principles behind how you work.", placement: "About · values", tone: "mint" },
  { resource: "brands", route: "brands", group: "sections", description: "The brands within your ecosystem.", placement: "About · brand ecosystem", tone: "violet" },
  { resource: "milestones", route: "timeline", group: "sections", description: "Tell your company’s story, one milestone at a time.", placement: "About · company journey", tone: "amber" },
  { resource: "process-steps", route: "process", group: "sections", description: "Make your approach easy to understand.", placement: "Home & Services · process", tone: "rose" },
  { resource: "stats", route: "stats", group: "sections", description: "Keep the numbers shown on your website current.", placement: "Home · stats band", tone: "blue" },
  { resource: "logos", route: "logos", group: "sections", description: "Give the brands you work with a place to shine.", placement: "Home · client logo marquee", tone: "mint" },
  { resource: "features", route: "features", group: "sections", description: "Explain the benefits of your solutions.", placement: "Home · solution features", tone: "violet" },
];
const navigation = NAV_GROUPS.find(group => group.key === "website")!.items;

export default function ContentHub() {
  const [data, setData] = useState<WebsiteOverview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  async function load() {
    setBusy(true); setError("");
    try { setData(await api.websiteOverview()); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t load the content counts."); }
    finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);
  const sections = useMemo(() => COLLECTIONS.map(collection => ({ ...collection, navigation: navigation.find(item => item.href === `/dashboard/${collection.route}`)! })), []);
  const counts = new Map(data?.collections.map(collection => [collection.resource, collection]));
  const needle = query.trim().toLowerCase();
  const filtered = sections.filter(section => !needle || `${section.navigation.label} ${section.description} ${section.placement}`.toLowerCase().includes(needle));
  const published = data?.collections.reduce((sum, collection) => sum + collection.published, 0);
  const drafts = data?.collections.reduce((sum, collection) => sum + collection.draft, 0);
  return (
    <div className="website-workspace">
      <header className="wh-header">
        <div><span className="wh-eyebrow">MAKE EVERY DETAIL CONSIDERED</span><h1>Website overview</h1><p>Everything that appears on your public website, in one place.</p></div>
        <a className="sh-btn" href="/" target="_blank" rel="noopener noreferrer">Open website <HugeiconsIcon icon={ArrowUpRight01Icon} size={16} /></a>
      </header>
      {!data && busy && !error ? <PageLoading label="Loading website content…" /> : <>
      <section className="wh-intro" aria-label="Website content summary">
        <span className="wh-intro-icon"><HugeiconsIcon icon={Layers01Icon} size={25} /></span>
        <div><h2>A place for every part of your website.</h2><p>Open a collection to edit its content. Drafts stay private until you publish them.</p></div>
        <div className="wh-summary" aria-live="polite">{data ? <><b>{published} published</b><span>{drafts} draft{drafts === 1 ? "" : "s"} across {data.collections.length} collections</span></> : <span>{busy ? "Fetching content counts…" : "Content counts unavailable"}</span>}</div>
      </section>
      {error && <div className="wh-error" role="alert"><span>{data ? "Couldn’t refresh the saved counts. " : "Couldn’t load content counts. "}{error}</span><button type="button" className="sh-btn sm" disabled={busy} onClick={load}>Try again</button></div>}
      <div className="wh-toolbar">
        <label className="wh-search"><HugeiconsIcon icon={Search01Icon} size={17} /><span className="sh-sr">Find a website section</span><input type="search" aria-label="Find a website section" placeholder="Find a page, collection or site section…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><HugeiconsIcon icon={Cancel01Icon} size={15} /></button>}</label>
        <span className="wh-found" aria-live="polite">{filtered.length} of {sections.length} collections</span>
        <button type="button" className="sh-icb" aria-label="Refresh content counts" disabled={busy} onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={17} /></button>
      </div>
      {(["main", "sections"] as const).map(group => {
        const items = filtered.filter(section => section.group === group);
        return items.length ? <section className={`wh-group ${group}`} key={group} aria-labelledby={`wh-${group}`}>
          <div className="wh-group-title"><div><span className="wh-eyebrow">{group === "main" ? "THE BIG PICTURE" : "THE DETAILS THAT MAKE IT YOURS"}</span><h2 id={`wh-${group}`}>{group === "main" ? "Main content" : "Site sections"}</h2></div><span>{items.length} collections</span></div>
          <div className="wh-grid">{items.map(section => {
            const saved = counts.get(section.resource);
            return <Link href={section.navigation.href} className={`wh-card ${section.tone}`} key={section.resource}>
              <div className="wh-card-top"><span className="wh-icon"><HugeiconsIcon icon={section.navigation.icon} size={22} strokeWidth={1.7} /></span><HugeiconsIcon icon={ArrowUpRight01Icon} size={17} className="wh-arrow" /></div>
              <h3>{section.navigation.label}</h3><p>{section.description}</p><span className="wh-placement">{section.placement}</span>
              <div className="wh-card-foot">{saved ? <><span>{saved.published} published</span><span className={saved.draft ? "wh-draft" : ""}>{saved.draft} draft{saved.draft === 1 ? "" : "s"}</span></> : <span>{busy ? "Loading counts…" : "Counts unavailable"}</span>}</div>
            </Link>;
          })}</div>
        </section> : null;
      })}
      {!filtered.length && <div className="wh-empty"><HugeiconsIcon icon={Search01Icon} size={24} /><h2>No sections match</h2><p>Try a page name or where the content appears.</p><button type="button" className="sh-btn" onClick={() => setQuery("")}>Clear search</button></div>}
      <p className="wh-note">Website team profiles are public content. Sign-in accounts and permissions are managed in Users &amp; access.</p>
      </>}
    </div>
  );
}
