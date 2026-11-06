# Stories, Reel covers and profile pictures

Implementation specification for Instagram and Facebook, based on the current Finvera code and Meta documentation checked on 6 November 2026. The Story publishers, separate Reel-cover upload and review preview, profile-photo refresh/fallback, and readiness checks are implemented. Mocked Graph, local database and browser checks cover these paths; live account eligibility and write permissions still need verification in the Meta app. No production test posts were sent.

## Original audit before implementation

| Feature | Current implementation | Change needed |
| --- | --- | --- |
| Stories | Calendar offers Story, but `socialPreflight.js` blocks automatic publishing. Manual posting remains available. | Add real, separate Story publishers for both platforms before removing the validation block. |
| Instagram Reel cover | Reels are created without `cover_url` or `thumb_offset`. | Store an optional cover upload or selected video frame and pass it to Instagram. |
| Facebook Reel cover | Videos currently use the Page `/videos` publishing endpoint; there is no separate Reel publishing implementation or cover upload. | Use the Page Reels publishing flow, then the documented video-thumbnail workflow. If the Reel publishes but its cover fails, the job retains the confirmed live video ID and Retry updates only the cover. |
| Profile pictures | Meta reads already request Facebook `picture` and Instagram `profile_picture_url`. Instagram's connection image is stored; Facebook's connection image is fetched but discarded. Cards use CSS background images without load-error fallback. | Retain both platform pictures, refresh them, and show a reliable fallback when a URL fails. |

The code findings identify possible causes of missing pictures. They do not establish which error affected a specific connected production account.

## Implemented UI flow

1. **Calendar:** Choose Post, Carousel, Reel or Story and select Instagram, Facebook or both. Show a Story destination badge so a Story cannot be mistaken for a feed post.
2. **Upload:** Keep the existing upload-only drawer. A Story accepts one photo or video per publishing item. A Reel accepts one video and shows a separate **Cover image — optional** upload below it. A cover must never be added to the carousel/media array as another post asset.
3. **Review:** Show a vertical Story preview or a Reel preview with its selected cover. Show platform-specific media and permission errors here. Keep the existing approval workflow.
4. **Schedule / publish:** Keep the same go-live date, queue and retry controls. Save remote upload/container identifiers at each stage so retries resume safely. An uncertain final publish result must go to the existing check flow instead of publishing again.
5. **Editing:** A change to the Story asset or Reel cover before publication must invalidate content approval and refresh the queued payload. Cover changes belong in the content hash and expected-version checks. Retain the current platform-by-platform handling for partly published posts.
6. **Social studio:** Add **Refresh photo** to the profile panel. Display a fresh platform picture, a last saved picture or a separately uploaded brand avatar/initials, in that order. A local fallback avatar does not change the actual Instagram/Facebook profile picture. Keep **Open profile** for changing the picture on Meta.

Stories should not offer feed-only caption, carousel or positioned image-tag controls. Interactive stickers, music, polls and mention stickers require separate platform support; they must not be implied by the first release.

## Publishing implementation

### Instagram

Create a container using `media_type=STORIES` with `image_url` or `video_url`, wait for processing and publish with `media_publish`. Verify Story eligibility for the connected account and app's login/API version.

For a Reel, Finvera sends the optional public image URL as `cover_url`. A future frame-selector control could use `thumb_offset` in milliseconds instead. The current release implements uploaded covers, not a frame selector. Meta gives `cover_url` precedence when both are provided. Check cover availability over public HTTPS before creating the container, as with the existing artwork health checks.

### Facebook

For a photo Story, upload an unpublished photo and publish its ID through `/{page-id}/photo_stories`. Video Stories use `/{page-id}/video_stories` with start, upload and finish phases.

For a Reel, implement `/{page-id}/video_reels` start, upload and finish phases. The current ordinary video route should remain available for Video posts. Meta's Reels guide links the `/{video-id}/thumbnails` endpoint for custom covers. That endpoint uploads an image file as `source` with `is_preferred=true`; merely passing a cover URL to the existing `/videos` call is insufficient. Finvera waits for publishing confirmation, saves the live video checkpoint, then uploads the cover. A cover-only retry never sends another Reel publishing request. Check processing status and permissions against Finvera's configured Graph version before enabling the UI.

The repository currently defaults to Graph v26.0; current documentation examples use v27.0. Do not upgrade the app's API version silently as part of this feature.

## Permissions and readiness

- The existing connection requests `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic` and `instagram_content_publish`, among any other existing scopes. Verify actual granted permissions rather than relying on the requested list.
- Facebook Story/Reel publishing requires an appropriate Page access token and the user's `CREATE_CONTENT` Page task. A business system-user flow has additional requirements.
- The current Video Thumbnails creation reference lists `pages_read_user_content`, `pages_manage_engagement` and `pages_show_list`. Check these against the pinned API version and app review access; the Story publishing scopes alone are not proof that custom Reel thumbnails can be written.
- Keep separate readiness results for Story publishing, Reel publishing, custom cover upload and profile-picture reads, on each platform. A successful ordinary post is not proof that all four capabilities work.
- For accounts outside app roles, verify the app's review/advanced-access requirements and live mode. Reconnect only when newly approved scopes need to be granted or a token is invalid.

## Profile-picture diagnosis and fix

1. Inspect the scoped profile-read result and whether it includes a picture URL. Report the Meta error without exposing the access token.
2. Separate identity/picture reads from follower-count reads where possible. `fetchProfile` currently groups these fields and suppresses failures, so a failed metrics request can also remove the picture result.
3. Merge successful profile refreshes into cached stats rather than replacing previously successful platform data when another platform fails. Preserve existing follower values unless a new value was actually returned.
4. Retain Facebook's connection-time picture in existing account metadata or a dedicated field and refresh Instagram's saved image too. Opening/refreshing profile details should update the picture used in channel cards.
5. Replace background-only avatars with image elements that handle load failures. Expired CDN URLs, blocked requests or unreadable images should show initials/a local brand image, with a Refresh action.
6. Avoid arbitrary server-side image proxying. If pictures are mirrored locally, restrict remote hosts, block private addresses and cap downloads.

## Verification before release

- Mock Graph tests for both photo/video Story flows and both Reel-cover flows, including processing delays, permission errors, and retries after each checkpoint.
- Local API integration tests for review invalidation, cover persistence, expected-version conflicts, scheduling and partially published posts.
- Browser checks for upload-only work, review previews, desktop/mobile layout, image-error fallback and profile refresh.
- Verify both platforms' permissions and perform controlled publishing tests on designated test accounts. No production test posts were published during this investigation.

## Official references

- [Instagram content publishing](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/content-publishing/)
- [Instagram media creation — Story, cover_url and thumb_offset](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/)
- [Facebook Stories API](https://developers.facebook.com/docs/page-stories-api/)
- [Facebook Reels publishing](https://developers.facebook.com/docs/video-api/guides/reels-publishing/)
- [Facebook video thumbnails](https://developers.facebook.com/docs/graph-api/reference/video/thumbnails/)

## Deployment and Meta app setup

No database migration is needed: covers are stored as `coverUrl` on the existing video media item, and profile images use the existing account stats and Instagram-avatar fields. The profile refresh endpoint updates cached photos without changing the actual Meta profile picture.

For Facebook covers, review the thumbnail permissions for the configured Graph API version. If your app needs `pages_read_user_content` and `pages_manage_engagement`, add them to the app review configuration, obtain the required access, and append them to `META_EXTRA_SCOPES` while preserving existing extra scopes. Reconnect the brand to grant newly approved scopes, then check Readiness & actions. These settings are not changed automatically by deployment.

Instagram/Facebook Stories publish artwork without the caption notes or keyword hashtags. Story stickers and Story profile tagging are not implemented. Choose Video Story for the video-editor production track. Shared content and covers remain protected once any platform has published.
