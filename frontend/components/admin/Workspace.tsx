import type { ReactNode } from "react";
import "./workspace.css";
export function WorkspaceHero({ eyebrow, title, description, actions, children }: { eyebrow: string; title: string; description: string; actions?: ReactNode; children?: ReactNode }) {
  return <header className="fw-hero"><div className="fw-hero-copy"><span className="fw-eyebrow">FINVERA WORKSPACE <i />{eyebrow}</span><h1>{title}</h1><p>{description}</p>{children}</div>{actions && <div className="fw-actions">{actions}</div>}<span className="fw-orbit" aria-hidden="true" /></header>;
}
export function WorkspaceStats({ items }: { items: { label: string; value: ReactNode; detail: string; accent?: boolean }[] }) {
  return <div className="fw-stats">{items.map((item, i) => <article className={"fw-stat" + (item.accent ? " accent" : "")} key={item.label}><span className="fw-stat-index">0{i + 1}</span><span>{item.label}</span><b>{item.value}</b><small>{item.detail}</small></article>)}</div>;
}
