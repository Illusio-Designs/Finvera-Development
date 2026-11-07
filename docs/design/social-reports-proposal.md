# Social reports — design proposal

Reports are now implemented at `/dashboard/reports`, with live scoped data, immutable saved snapshots, commentary/review revisions, CSV/Excel export and browser Print / save PDF. The standalone HTML remains the original sample-data design artifact. Public client links and scheduled report delivery are not enabled. Open `social-report-prototype.html` locally; it has no network dependencies. Every figure, name and result in the prototype is labelled sample data. The two reports are separate views under a proposed Social media → Reports entry.

## Team / user social report

Admins/team leads see authorized people and brands; ordinary team members see their own work. Filters: reporting period, person, role and authorized client/brand when implemented. Show assigned work, completed handoffs, on-time percentage, current open/overdue assignments, logged hours and a per-person post ledger. Completion counts must reuse `socialPerformance.completedAssignments` and the existing KPI rules, not count each status change or reassignment as work completed.

Use the saved go-live date/time in India time as the deadline. Legacy events without time retain the existing day-level precision and must be labelled accordingly. Undated completions are excluded from the on-time denominator and shown separately in drilldowns. Count a person's completion once per post. Reassignment transfers pending ownership, while completion credit stays with the person who completed the work. Maker work uses the appropriate designer/video role for the format. Starting work, scheduling and moving a task between people are not completions.

Assigned-in-period requires recorded assignment events; do not infer historical counts from the current owner or add them to completions. Completion-period counts and current queue counts have different time bases and must be labelled. Open now does not necessarily equal assigned-in-period minus completed-in-period. A historical report needs an explicit generated-at/as-of snapshot if current queue figures are included.

Existing foundations: `Backendjs/src/controllers/kpi.controller.js`, `Backendjs/src/utils/socialPerformance.js`, `Backendjs/src/utils/socialDeadline.js` and `/api/export/kpi-report`. Reuse the current Excel export and metric definitions where appropriate; audit event coverage before adding an assignment count or custom historical window.

## Client social report

One client/brand per report. Include period, content planned/delivered, unique published posts, per-channel publication counts, content formats, supported channel metrics, top published content, an editable narrative and next actions. Keep a client-safe view that excludes employee ratings, time logs, workload, personal assignment history, internal errors and tokens.

A post published to Instagram and Facebook is one unique post and two successful channel publications. Failed/retried jobs must not create duplicate successes. Available likes/comments/shares may be summed only with coverage labels; describe the total as **reported interactions**, not a complete engagement measure. Current provider totals are lifetime/latest observations unless genuine time-series data supports a period-specific claim. Do not describe them as interactions earned during the report period. Reach and distinct people must not be summed across channels. Combined follower counts are account totals and can include the same person on more than one channel.

Current Social studio data contains saved account follower snapshots, publication jobs and the metrics actually returned by the Meta adapter. Reach, impressions, Story metrics, clicks and watch time must be capability-checked and added only when the provider integration returns them. Missing values show **Not available**, never zero; permission failure must not be assumed from missing data. Show freshness, available-metric coverage and the report generation time. Use completed historical periods when daily cutoffs matter, and call out partial current periods.

## Delivered workflow

1. Open Social media → Social reports. Choose Team performance or Client report, month and authorized brand; admins can also choose a role/person. Ordinary members receive only their own team work.
2. Review the live data, underlying work ledger, missing metrics and coverage dates. Historical assignment counts remain unavailable if recorded history does not cover the entire period. Inactive contributors retain past completion credit.
3. Add commentary and save a fixed snapshot. A preview fingerprint prevents silently saving changed figures. Report data cannot be edited after capture; create a new snapshot to refresh it.
4. Review the commentary and mark the snapshot Reviewed. Commentary edits reset review to Draft; optimistic revisions protect simultaneous editors. A demoted admin cannot retain access to an old team-wide report; brand revocation also applies to old reports and exports.
5. Open the client-safe preview and export CSV, an Excel workbook or Print / save PDF. Every export rechecks current access. PDFs are produced through the browser print flow; no headless PDF service is required on the hosting account. Workbook sheets retain report metadata and coverage context. Client responses/exports omit staff, time logs, assignment history, provider errors and credentials.
6. No sending/email/public-link workflow runs automatically. Existing KPI export remains compatible.

Backend: `/api/social-reports/options`, `/preview`, `/snapshots`, `/snapshots/:id`, and `/snapshots/:id/csv`. Snapshot storage is an additive `social_report_snapshots` table; the normal create-missing schema sync and report table guard create it without altering existing records.

## Prototype interactions

Switch Team/Client tabs; choose the month, role/person or client; inspect a person's work; edit the client narrative; open Client view; export sample CSV or print/save a preview PDF. Navigation items outside Reports are intentionally inert in the standalone artifact. The small trend/workload charts are illustrative design examples; production charts must come from the same scoped report snapshot as their totals.
