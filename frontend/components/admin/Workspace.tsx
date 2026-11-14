import type { ReactNode } from "react";
import "./workspace.css";
import "./workspace-tokens.css";
export function WorkspaceHero({ eyebrow, title, description, actions, children, variant = "panel", headingLevel = 1, compact = false }: {
  eyebrow: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode;
  variant?: "panel" | "plain"; headingLevel?: 1 | 2; compact?: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h1";
  return <header className={`fw-hero${variant === "plain" ? " fw-hero-plain" : ""}${compact ? " fw-hero-compact" : ""}`}>
    <div className="fw-hero-copy"><span className="fw-eyebrow">FINVERA WORKSPACE <i />{eyebrow}</span><Heading>{title}</Heading>{description && <p>{description}</p>}{children}</div>
    {actions && <div className="fw-actions">{actions}</div>}
    {variant === "panel" && <span className="fw-decoration" aria-hidden="true"><span className="fw-orbit" /></span>}
  </header>;
}
export function WorkspaceStats({ items }: { items: { label: string; value: ReactNode; detail: string; accent?: boolean }[] }) {
  return <div className="fw-stats">{items.map((item, i) => <article className={"fw-stat" + (item.accent ? " accent" : "")} key={item.label}><span className="fw-stat-index">{String(i + 1).padStart(2, "0")}</span><span>{item.label}</span><b>{item.value}</b><small>{item.detail}</small></article>)}</div>;
}
