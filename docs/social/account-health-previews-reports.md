# Account health, previews and monthly brand reports

## Account health

The content calendar and Social studio show the same Account health panel, filtered by the current brand. Saved connection status, token expiry and channel pause status provide immediate warnings. Check all accounts (or Check access on one channel) runs the existing read-only Meta capabilities endpoint, with at most three concurrent checks and independent failure handling.

Access verified requires a current token, a successful asset read and publishing permission evidence. Results become stale after 15 minutes. This does not certify app review, account eligibility or a successful media publish. Expired access, missing publishing permissions and paused publishing are separate states. Administrators can reconnect the brand; scoped members see an administrator action request.

## Platform previews

The post composer, saved-post details and review drawer use the same preview. Switch between Facebook and Instagram without saving or publishing. Previewed content follows caption/hashtag composition and the saved media order. Carousels allow media selection; Stories and Reels use a vertical frame, and videos use their saved cover. Story caption notes are excluded from the visible published artwork.

Preview-only channels are explicitly identified, including disconnected or deselected channels. Text expansion, media failures and empty artwork are handled. Platform rendering/cropping is approximate. Preview actions do not change the outgoing targets, approval status or schedule.

## Monthly brand reports

Use Monthly brand report from the calendar or Studio. Authorized brand and reporting month deep links preselect the existing Reports filters. Current months are month-to-date; all period boundaries use India time.

The client report is the default Reports view and uses the shared WorkspaceHero, WorkspaceStats, Select, dashboard buttons and fields. It shows unique confirmed posts, per-channel publications, available likes/comments/shares, follower snapshots/change, content mix and top content ranked by available interactions. Only published content in the selected month and brand is included.

Internal workflow activity, creations, reassignments, planned/unpublished content, manual calendar markings, overdue work, staff identities and time records are excluded from client report data, previews and exports. Team performance remains explicitly marked Internal. Backend serializers also apply this client projection to older saved snapshots; stored historical snapshots are not rewritten.
These Meta totals apply to posts published in the selected month; they are not interactions earned only during that month. Coverage and last metrics retrieval time remain visible. Reach, impressions, watch time and Story insights are not collected and are not fabricated. Missing provider metrics remain unavailable in reports. Existing older snapshots remain readable through the same client-only projection.

Snapshots preserve data and include separate reviewed commentary. Excel, PDF and CSV contain published client content and available results. Their data projection excludes internal fields even when exporting an older snapshot.

Deployment requires frontend main and the reporting/account-response changes on the backend deployment branch. No new schema or Meta permissions are required. Local checks use mocked Meta responses and do not publish content or alter live profiles.
