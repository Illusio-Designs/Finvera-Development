"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartBreakoutSquareIcon, Layout01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import Select from "@/components/Select";
import PageLoading from "@/components/admin/PageLoading";
import { WorkspaceHero } from "@/components/admin/Workspace";
import SocialProfileEditor from "@/components/admin/SocialProfileEditor";
import { api } from "@/lib/adminApi";
import SocialReports from "../reports/SocialReports";
import StudioPanel from "./StudioPanel";
import "./social-workspace.css";

const views = [
  { id: "studio", label: "Studio", icon: Layout01Icon },
  { id: "report", label: "Monthly report", icon: ChartBreakoutSquareIcon },
  { id: "profiles", label: "Profiles", icon: UserCircleIcon },
] as const;

type View = typeof views[number]["id"];
type Section = "overview" | "channels" | "posts";
type Platform = "facebook" | "instagram";

export default function SocialWorkspace() {
  const query = useSearchParams();
  const [brands, setBrands] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [preferredBrand, setPreferredBrand] = useState("");
  const guardRef = useRef<(() => Promise<boolean>) | null>(null);
  const navigationPending = useRef(false);

  const tab = query.get("tab");
  const returningFromMeta = query.has("metaConnect") || query.has("metaError");
  const view: View = !returningFromMeta && (tab === "report" || tab === "profiles") ? tab : "studio";
  const section: Section = returningFromMeta ? "channels" : tab === "channels" || tab === "posts" ? tab : "overview";
  const requested = query.get("brand") ?? preferredBrand;
  const brand = brands?.includes(requested) ? requested : view === "studio" ? "" : brands?.[0] ?? "";
  const platform: Platform = query.get("platform") === "instagram" ? "instagram" : "facebook";

  useEffect(() => {
    try { setPreferredBrand(localStorage.getItem("fv-studio-brand") || ""); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    let active = true;
    api.list("social-clients").then((rows: { name: string }[]) => {
      if (active) setBrands(rows.map(row => row.name));
    }).catch((error: Error) => {
      if (active) setLoadError(error.message || "Could not load brands.");
    });
    return () => { active = false; };
  }, [retry]);

  function update(params: Record<string, string | null>, replace = false) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    if (url.href === window.location.href) return;
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }

  async function navigate(params: Record<string, string>) {
    if (navigationPending.current) return;
    navigationPending.current = true;
    try {
      if (guardRef.current && !await guardRef.current()) return;
      if ("brand" in params) {
        try { localStorage.setItem("fv-studio-brand", params.brand); } catch { /* storage unavailable */ }
      }
      update(params);
    } finally {
      navigationPending.current = false;
    }
  }

  function switchView(next: View) {
    if (next === view) return;
    const nextBrand = next === "studio" ? brand : brand || brands?.[0] || "";
    void navigate({ tab: next, brand: nextBrand });
  }

  return <div className="social-workspace">
    <WorkspaceHero eyebrow="Social media" title="Social workspace"
      description="Manage your channels, published content, and monthly results."
      actions={<div className="adm-field social-workspace-brand">
        <label htmlFor="social-workspace-brand">Brand</label>
        <Select id="social-workspace-brand" ariaLabel="Brand" value={brand} disabled={!brands?.length}
          placeholder={brands ? "Select a brand" : "Loading brands…"}
          options={[...(view === "studio" ? [{ value: "", label: "All brands" }] : []), ...(brands ?? [])]}
          onChange={value => { if (value !== brand) void navigate({ brand: value }); }} />
      </div>} />
    <nav className="social-workspace-tabs" aria-label="Social workspace views">
      {views.map(item => <button key={item.id} type="button" aria-pressed={view === item.id}
        className="adm-btn ghost"
        onClick={() => switchView(item.id)}><HugeiconsIcon icon={item.icon} size={16} aria-hidden="true" />{item.label}</button>)}
    </nav>
    {loadError ? <div className="social-workspace-error" role="alert">
      <p>{loadError}</p><button type="button" className="adm-btn ghost" onClick={() => { setLoadError(""); setRetry(value => value + 1); }}>Try again</button>
    </div> : !brands ? <PageLoading label="Loading brands…" variant="panel" count={3} />
      : view === "studio" ? <StudioPanel brand={brand} tab={section}
        onTabChange={value => update({ tab: value === "overview" ? "studio" : value })}
        onBrandChange={value => void navigate({ brand: value })}
        onOpenProfile={(client, channel) => void navigate({ tab: "profiles", brand: client, platform: channel })}
        onMetaReturn={value => update({ tab: "channels", metaConnect: null, metaError: null, ...(value ? { brand: value } : {}) }, true)} />
      : view === "report" ? <SocialReports key={brand} workspaceBrand={brand} workspaceMonth={query.get("month")}
        onWorkspaceMonthChange={month => update({ month }, true)} navigationGuard={guardRef} />
      : <SocialProfileEditor workspace={{ brand, platform, navigationGuard: guardRef,
        onPlatformChange: channel => update({ platform: channel }),
        onConnections: () => void navigate({ tab: "channels", brand }) }} />}
  </div>;
}
