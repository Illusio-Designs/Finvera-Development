import "./page-loading.css";

export default function PageLoading({ label = "Loading page…", variant = "cards" }: { label?: string; variant?: "cards" | "list" | "board" }) {
  return <div className={`page-loading page-loading-${variant}`} role="status" aria-label={label} aria-live="polite" aria-busy="true">
    <div className="page-loading-shapes" aria-hidden="true">{Array.from({ length: variant === "list" ? 5 : 6 }, (_, index) => <div className="page-loading-card" key={index}><i /><span /><span /><b /></div>)}</div>
    <div className="page-loading-center"><span className="page-loading-spinner" aria-hidden="true" /><span>{label}</span></div>
  </div>;
}
