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

Available actions include opening the profile, viewing details, editing supported Facebook Page fields, and opening Instagram for profile edits. Page name and picture edits open the platform. Positioned profile tags are implemented for Instagram images and carousel images. Enter post-wide @usernames in Instagram profiles to tag (center placement), or use Tag profiles on an uploaded image to choose positions. Meta determines account eligibility. Video tags, Stories, dedicated Facebook Reels and edits/deletes of already-live posts are marked as not implemented. Caption handles are text; clickable mentions need a platform test.

App review, production mode, granular asset grants, token/data-access expiry and the selected Graph API version must still be appropriate for the deployed app. Adding a permission to `META_EXTRA_SCOPES` does not grant approval; update the Meta app and reconnect after approved permission changes. Never paste tokens or app secrets into a report.

## Validation and deployment

The Social workflow checks action runs on main pushes and pull requests. Backend deployment invokes the backend regression tests before FTP deployment. Vercel’s separate deployment is not blocked by GitHub checks unless its integration/settings are configured to wait for them.

Client-request fields are additive nullable columns, provisioned through the existing idempotent `ensureColumns` startup path. The database user must have the same schema-update permissions required by that existing mechanism.

Local validation includes pure regression tests, authenticated HTTP checks and a MySQL publisher/edit race check. Meta publishing was mocked; no real post or profile write was performed. Connected production accounts should be checked using the new readiness panel, then tested on dedicated accounts with explicit permission for writes.

## Focused workflow update — November 2026

Task cards show a concise deadline rather than a work-completion percentage. Production opens only Upload, regardless of whether it was opened from the card or its button. Supporting content, team/planning and history are collapsed in other stages. Use the card’s More actions → Change owner for one task, or Reassign pending for bulk transfers. Scheduled work has a focused schedule/status screen. Posted work provides live links, history and Create revised post, which copies the full saved content into a new Planned draft.

- The backend enforces allowed stage transitions and requires an owner and uploaded work before entering review. Dragging cannot skip those requirements.
- Approval checks saved usernames, media combinations, local media availability, schedule/time and supported format. The review panel shows the blockers. Story auto-publishing is blocked; explicitly deselect all channels for manual posting.
- Carousel artwork can move earlier/later without dropping its positioned tags. Upload, removal, reorder and tagging use saved version checks; concurrent edits cannot silently overwrite the artwork array.
- After Facebook publishes, Correct Instagram tags opens only post-wide and image-specific tags. It does not expose shared caption or artwork replacement. Reapproval preserves Facebook’s result and original schedule; use Publish now for the remaining missed job if needed.
- Save conflicts preserve the draft, show the saved and draft values, and require an explicit reload. Closing an editor with unsaved changes asks before discarding. Confirmation dialogs render above task drawers.
- Import first previews new/planning/protected rows. Re-import updates only Planned/Need from client work through transactional safeguards; started, reviewed and live records are skipped and reported. Row-level version checks handle changes after preview.
- Post and batch deletion lock posts before jobs, using the publisher’s lock order. Any live, publishing or uncertain result blocks deletion; no partial batch delete is performed. Published history is retained instead of being silently deleted.

### Existing backend data

Startup adds the nullable `social_post_events.postTime` column through `ensureColumns`. Before enabling the worker, it inspects existing Ready posts. Definitely unpublished invalid work is returned to Pending approval and safe pending jobs are cancelled with the reason. In partially published work, published jobs and their remote IDs/URLs are retained. Publishing/uncertain checkpoints are skipped. Captions, artwork, dates, tags and live links are not guessed, removed or rewritten. The check is idempotent, and logs only checked/paused counts.

Invalid legacy display names remain visible so the team can replace them with verified usernames or explicitly remove them. Corrected content must be approved again. No migration sends a Meta post or edits a remote profile.

Current overdue flags and KPIs use the exact go-live timestamp in IST, defaulting to 10:00 when no time was selected. New stage events snapshot the go-live time for accurate on-time completion. Historical events have only a date: their existing day-level on-time classification is preserved and exposed as `deadlinePrecision: day`; the migration does not invent historical times.

### Verification

75 automated social regression cases passed, plus TypeScript, actual component browser flows at desktop/mobile sizes, authenticated local API checks, MySQL publishing/edit races, import protection, safe deletion and idempotent repair of a partially published record. Live Meta requests were not performed. Production data repair occurs only when the deployed backend restarts successfully; a Git push alone does not prove that it ran.
