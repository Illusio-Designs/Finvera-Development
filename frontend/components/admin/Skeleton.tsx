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

/* Full overview skeleton — mirrors the dashboard layout while data loads. */
export function DashSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="dash-stats">
        {[0, 1, 2].map((i) => (
          <div className="dash-stat" key={i}>
            <div className="dash-stat-head">
              <span className="skel" style={{ width: 42, height: 42, borderRadius: 12, flex: "none" }} />
              <div style={{ flex: 1 }}>
                <span className="skel skel-line" style={{ width: "60%", height: 12, marginBottom: 7 }} />
                <span className="skel skel-line" style={{ width: "40%", height: 10 }} />
              </div>
            </div>
            <span className="skel skel-line" style={{ width: 72, height: 30, borderRadius: 9, marginTop: 16 }} />
            <span className="skel skel-line" style={{ width: "45%", height: 11, marginTop: 16 }} />
          </div>
        ))}
      </div>

      <div className="dash-split">
        <div className="dash-panel">
          <div className="dash-panel-head"><span className="skel skel-line" style={{ width: 150, height: 15 }} /><span className="skel skel-line" style={{ width: 60, height: 20, borderRadius: 999 }} /></div>
          <div className="dash-bars">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                <span className="skel skel-line" style={{ width: 88, height: 12, flex: "none" }} />
                <span className="skel" style={{ flex: 1, height: 10, borderRadius: 999 }} />
                <span className="skel skel-line" style={{ width: 18, height: 12, flex: "none" }} />
              </div>
            ))}
          </div>
        </div>
        <div className="dash-panel">
          <div className="dash-panel-head"><span className="skel skel-line" style={{ width: 150, height: 15 }} /><span className="skel skel-line" style={{ width: 56, height: 20, borderRadius: 999 }} /></div>
          <TableSkeleton rows={5} cols={2} />
        </div>
      </div>
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
