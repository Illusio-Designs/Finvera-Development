# Channel expansion: Pinterest → YouTube → LinkedIn

Planning only. These three channels are not connected or enabled by this release. Documentation checked on 6 November 2026; endpoint/product access must be rechecked when each adapter is implemented.

## What Finvera can offer

| Capability | Pinterest | YouTube | LinkedIn |
| --- | --- | --- | --- |
| Connect and show account identity | Authorized Pinterest account and profile picture | Authorized YouTube channel and its picture | Authorized member; company Pages where the member/app has required access |
| First publishing release | Image Pins to a selected board | Standard videos and Shorts-eligible vertical videos | Text, single image, video and link/article posts |
| Additional formats | Video Pins after media registration/processing | Channel thumbnail, title, description, tags, playlist selection where authorized | Multi-image and document/PDF posts; polls later if product/API access allows |
| Required destination/settings | Board, Pin title, description, destination link, applicable alt text | Channel, title, description, visibility, audience/made-for-kids choice, applicable content disclosures | Member/company author, post text, link/media, supported visibility and alt text |
| Schedule and approve | Finvera review and publishing queue | Finvera review/queue; private staging and native scheduled-publication settings where suitable | Finvera review and publishing queue |
| Change before publication | Edit saved Pin draft and destination | Edit upload draft and metadata, with renewed review | Edit saved platform draft and media, with renewed review |
| Manage already-published content | Endpoint-supported Pin update/delete with granted scopes | Endpoint-supported metadata/thumbnail/privacy updates or deletion with suitable scopes | Endpoint-supported post edits/deletion with suitable product and role access; media replacement may require a new post |
| Analytics | Eligible account/Pin analytics, such as impressions, saves and clicks | Channel/video views and engagement; watch-time analytics with separate Analytics API access | Organization/post metrics permitted by the app's products, roles and read scopes |
| Exclusions | No promise of a Story, Instagram-style Reel or native sticker publishing mode | No YouTube Stories or Community-post publishing through this video uploader | No LinkedIn Stories; organic multi-image/document posts are not the sponsored Carousel ad format |

Display unavailable metrics as unavailable, never zero. Do not combine a Pinterest save, a YouTube view and a LinkedIn reaction into one misleading performance number.

## Shared UI flow

**Calendar → choose channels → platform-specific draft → upload → review each destination → schedule → per-channel results.**

- Add Pinterest, YouTube and LinkedIn under Social studio's Channels area. Each channel card shows connection state, picture, account type, capabilities, last refresh and reconnect action.
- Keep the existing upload-only work panel. Show destination requirements in planning/review: Pinterest board, YouTube channel/audience/visibility, LinkedIn member or company Page.
- Allow a shared caption as a starting point, with separate title/text/link/tag/cover fields where platforms differ. Editing one platform must not silently change another platform's already-published content.
- Add review tabs for each selected channel. Show the actual final payload and its media/length/access errors. Unsupported format/channel combinations must be unavailable, not silently converted.
- Schedule one job per destination. Show mixed outcomes clearly: for example, Pinterest published, YouTube processing, LinkedIn failed. Never republish a successful destination when retrying another.
- Preserve the existing team assignment, completion deadline, approval and activity history behavior. A changed platform payload needs a new approval before its pending job runs.

## Build order and acceptance

### Phase 1 — shared channel foundation

1. Add a channel/connection abstraction with encrypted provider tokens, authorized account ID, granted scopes, expiry, refresh status and capability evidence. Keep the existing Meta connection working during migration.
2. Use a publisher registry instead of an Instagram-or-Facebook conditional. An unknown platform must fail before any outbound call; it must never fall through to Facebook.
3. Add destination-specific overrides to the saved post and approval hash. Include Pinterest board, YouTube visibility/audience and LinkedIn author, not just the caption and media.
4. Add provider-specific token refresh, revoke/disconnect and readiness checks. Use minimal scopes and preserve brand-level access restrictions.
5. Support resumable uploads for large videos, persistent remote upload IDs, polling/webhooks where documented, and uncertain-result recovery. Do not log OAuth tokens.

Acceptance: existing Meta workflows still pass; a disabled/unsupported channel cannot publish; scope boundaries and per-destination retry behavior are tested.

### Phase 2 — Pinterest

- Register/configure the Pinterest app, OAuth redirect and permitted account access.
- Fetch authorized identity and boards. Require a selected board when reviewing a Pin.
- Ship image Pins first: title, description, destination link and applicable alt text.
- Add video Pin media registration/upload/processing next, then eligible Pin/account analytics.
- Add board creation or post-publication updates only after the corresponding endpoints and grants are confirmed.

Access check: the current official API specification lists `boards:read`, `boards:write`, `pins:read` and `pins:write` for Create Pin; account identity/analytics uses `user_accounts:read`. Request and verify the scopes needed for the chosen release. App access level and business-account eligibility affect production capabilities.

Acceptance: create an image Pin on a designated test board, retain its remote ID, recover safely from upload errors, and display the actual Pin link.

### Phase 3 — YouTube

- Configure a Google Cloud project, YouTube Data API and OAuth consent/client settings, with refresh-token handling.
- Connect a channel, not just a Google account. Use resumable video uploads and persist upload sessions across retries.
- Require title, visibility and audience/made-for-kids selection, plus applicable disclosures. Review the exact settings before publication.
- Add custom thumbnail upload where the channel/API permits it. Shorts eligibility uses YouTube's current video rules; there is no separate `uploadShort` endpoint. Thumbnail display for Shorts can differ by surface.
- Add native scheduled publication where permitted, otherwise use Finvera's queue. Add playlist assignment and endpoint-supported edits as separate capabilities.
- Add Analytics API reads only after the user grants the required read access. Quota and upload/channel limits must be visible as recoverable errors.

Access check: `youtube.upload` is an upload scope. Read channel data, update/delete operations, playlist operations and Analytics API reads can need additional scopes; verify each endpoint. Current `videos.insert` documentation says uploads from unverified API projects are not inherently restricted to private mode, so do not implement an outdated blanket private-only rule. OAuth verification, API compliance/audit obligations, channel settings and quotas still need review for the actual app.

Acceptance: resumable upload on a designated test channel, confirmed processing/publication, correct audience and visibility, no duplicate video on retry, and accurate quota errors.

### Phase 4 — LinkedIn

- Configure the LinkedIn app and required products. Connect member publishing and organization publishing as separate capabilities.
- Ship text, image, video and link/article posts first, using the authorized author URN.
- For organization publishing, verify the authenticated member's Page role and app access. Do not assume member publishing grants company publishing.
- Add multi-image and document/PDF posts after the required media upload paths are implemented. The organic multi-image format differs from sponsored Carousel ads.
- Add permitted edit/delete operations and organization/post reporting later. Do not promise unrestricted member analytics or restricted social read APIs.
- Pin the supported LinkedIn API version and plan for its version retirement cycle.

Access check: `w_member_social` applies to member publishing; `w_organization_social` applies to organization publishing with an eligible Page role. Reads such as `r_organization_social` depend on product access and role requirements. The Posts API documentation describes `r_member_social` as restricted; do not make the initial release depend on universal availability.

Acceptance: test member and authorized company author separately, verify media processing and returned post URN/link, reject wrong-author/role requests and keep retries isolated from other platforms.

## Verification and release controls

- Unit/contract tests with mocked provider errors, revoked/expired tokens, incomplete processing and partial successes.
- Local API tests for destination settings, approvals, brand permissions and saved upload sessions.
- Desktop/mobile tests for channel selection, upload-only work, review previews, shimmer loading and readable errors above drawers.
- Controlled test-account publishes for each format after app access is granted. Publish to client accounts only through the normal reviewed workflow.
- Enable each channel only after its own acceptance checks. Pinterest access is not a blocker for maintaining existing Instagram/Facebook publishing.

## Official references

- [Pinterest API documentation](https://developers.pinterest.com/docs/api/v5/)
- [Pinterest official API specification](https://github.com/pinterest/api-description/blob/main/v5/openapi.yaml)
- [YouTube videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert)
- [YouTube resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)
- [YouTube thumbnail upload](https://developers.google.com/youtube/v3/docs/thumbnails/set)
- [YouTube Analytics authorization](https://developers.google.com/youtube/analytics/guides/authorization)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)
