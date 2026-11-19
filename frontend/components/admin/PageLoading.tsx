import type { ReactNode } from "react";
import "./page-loading.css";

type Variant = "cards" | "list" | "board" | "media" | "form" | "calendar" | "panel";

export function LoadingRegion({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={`page-loading ${className}`} role="status" aria-label={label} aria-live="polite" aria-busy="true">
    <span className="page-loading-label">{label}</span>
    <div className="page-loading-content" aria-hidden="true">{children}</div>
  </div>;
}

export function Shimmer({ width, height, className = "" }: { width?: string | number; height?: string | number; className?: string }) {
  return <span className={`page-shimmer ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export default function PageLoading({
  label = "Loading page…", variant = "cards", count, gridClassName, toolbar = false, rowHeight,
}: { label?: string; variant?: Variant; count?: number; gridClassName?: string; toolbar?: boolean; rowHeight?: number }) {
  const total = count ?? (variant === "calendar" ? 35 : variant === "list" ? 5 : 6);
  return <LoadingRegion label={label} className={`page-loading-${variant}`}>
    {toolbar && <div className="page-loading-toolbar"><Shimmer width="36%" height={38} /><Shimmer width="28%" height={38} /></div>}
    <div className={`page-loading-shapes${gridClassName ? " " + gridClassName : ""}`}>
      {Array.from({ length: total }, (_, index) => {
        if (variant === "board") return <div className="page-loading-column" key={index}>
          <div className="page-loading-column-head"><span /><i /></div>
          {Array.from({ length: 2 + index % 2 }, (_, card) => <div className="page-loading-card" key={card}><i /><span /><span /><b /></div>)}
        </div>;
        if (variant === "media") return <div className="page-loading-media-card" key={index}>
          <Shimmer className="page-loading-art" />
          <div className="page-loading-media-body"><Shimmer width="65%" height={19} /><Shimmer width="85%" height={12} /><Shimmer width="40%" height={33} /></div>
        </div>;
        if (variant === "form") return <div className="page-loading-field" key={index}><Shimmer width="32%" height={13} /><Shimmer height="var(--ui-field-height, 42px)" /></div>;
        if (variant === "calendar") return <div className="page-loading-day" key={index}><Shimmer width={16} height={13} />{index % 3 === 0 && <Shimmer height={24} />}</div>;
        return <div className="page-loading-card" style={rowHeight ? { minHeight: rowHeight } : undefined} key={index}><i /><span /><span /><b /></div>;
      })}
    </div>
  </LoadingRegion>;
}
