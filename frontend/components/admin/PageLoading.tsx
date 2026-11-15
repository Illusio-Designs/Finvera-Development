import "./page-loading.css";

type Variant = "cards" | "list" | "board";

/** One loading treatment, with placeholders sized for the content being fetched. */
export default function PageLoading({ label = "Loading page…", variant = "cards" }: { label?: string; variant?: Variant }) {
  return <div className={`page-loading page-loading-${variant}`} role="status" aria-label={label} aria-live="polite" aria-busy="true">
    <span className="page-loading-label">{label}</span>
    <div className="page-loading-shapes" aria-hidden="true">
      {Array.from({ length: variant === "list" ? 5 : 6 }, (_, index) => variant === "board" ? (
        <div className="page-loading-column" key={index}>
          <div className="page-loading-column-head"><span /><i /></div>
          {Array.from({ length: 2 + index % 2 }, (_, card) => <div className="page-loading-card" key={card}><i /><span /><span /><b /></div>)}
        </div>
      ) : <div className="page-loading-card" key={index}><i /><span /><span /><b /></div>)}
    </div>
  </div>;
}
