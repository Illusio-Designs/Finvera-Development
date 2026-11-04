# Social workflow and Meta readiness

Calendar cards retain their existing content. **Start work** moves a card into In production; **Upload** opens a media-only panel and sends saved artwork for review. Static posts/carousels use a graphic designer; reels/videos use a video editor. The social manager reviews and approves.

**Need** opens a request form: missing client input, follow-up date and contact owner. The card moves into Need from client and shows its follow-up date. The follow-up date is separate from the go-live deadline used by performance KPIs. This does not automatically email the client.

Admins can use **Reassign pending** to preview and transfer eligible pending posts together. Other teammates, content, media, stages and dates remain attached to the posts.

## Approval and publishing

- Scheduled content changes return the saved post to Pending approval and cancel its pending jobs. Approve the saved version again before publishing.
- The server checks approval even when requests bypass the UI. Publish now changes the publishing time; it cannot bypass review.
- The worker claims the post and job under database locks. Editing is blocked after publishing starts. Saved versions are fingerprinted in publishing checkpoints.
- A result marked Check may already be live. Confirm its live permalink, or have an admin inspect the platform and explicitly confirm the post is absent before retrying. Ordinary retries preserve safe pre-publish checkpoints.
- A post partly published on one channel cannot silently change shared content for the remaining channels. Resolve that result before making a revised post.
- Manual confirmation requires a platform-specific live link. This is operator evidence, not an independent Meta verification request.
- Published artwork is retained. History includes assignment, content, approval and client-request changes, with links to recorded artwork versions. Retention does not recover assets deleted before this change.

## Social studio → Channels → Readiness & actions

This check is read-only. It distinguishes:

- **Verified:** a token or profile read was actually confirmed by Meta.
- **Permission granted:** a required scope is present; field- and format-specific writes still need testing.
- **Unknown / missing permission / unavailable:** access is unverified or blocked; connection alone is not proof.
- **External:** open the platform to perform the action.
- **Not implemented:** Finvera has no publishing/editing payload for that feature.

Available actions include opening the profile, viewing details, editing supported Facebook Page fields, and opening Instagram for profile edits. Page name and picture edits open the platform. Stories, dedicated Facebook Reels, media tags and edits/deletes of already-live posts are explicitly marked as not implemented. Caption handles are text; clickable mentions need a platform test.

App review, production mode, granular asset grants, token/data-access expiry and the selected Graph API version must still be appropriate for the deployed app. Adding a permission to `META_EXTRA_SCOPES` does not grant approval; update the Meta app and reconnect after approved permission changes. Never paste tokens or app secrets into a report.

## Validation and deployment

The Social workflow checks action runs on main pushes and pull requests. Backend deployment invokes the backend regression tests before FTP deployment. Vercel’s separate deployment is not blocked by GitHub checks unless its integration/settings are configured to wait for them.

Client-request fields are additive nullable columns, provisioned through the existing idempotent `ensureColumns` startup path. The database user must have the same schema-update permissions required by that existing mechanism.

Local validation includes pure regression tests, authenticated HTTP checks and a MySQL publisher/edit race check. Meta publishing was mocked; no real post or profile write was performed. Connected production accounts should be checked using the new readiness panel, then tested on dedicated accounts with explicit permission for writes.
