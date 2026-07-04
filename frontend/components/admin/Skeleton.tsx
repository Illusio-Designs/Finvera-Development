/* Reusable shimmer skeletons for admin loading states. */

export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skel-table" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skel-row" key={r}>
          <span className="skel skel-circle" style={{ width: 34, height: 34, flex: "none" }} />
          {Array.from({ length: cols }).map((_, c) => (
            <span
              key={c}
              className="skel skel-line"
              style={{ flex: c === 0 ? 2 : 1, maxWidth: c === 0 ? 220 : 140, opacity: 1 - c * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function BoardSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="skel-kb" aria-busy="true" aria-label="Loading board">
      {Array.from({ length: cols }).map((_, i) => (
        <div className="skel-kbcol" key={i}>
          <span className="skel skel-line" style={{ width: "55%", height: 14, marginBottom: 4 }} />
          {Array.from({ length: 3 - (i % 2) }).map((_, c) => (
            <span key={c} className="skel skel-kbcard" />
          ))}
        </div>
      ))}
    </div>
  );
}
