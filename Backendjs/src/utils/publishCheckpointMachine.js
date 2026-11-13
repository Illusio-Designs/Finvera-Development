/* Checkpoint events are recorded before the remote write they protect.
   The object remains mutable because the runner observes it when a call fails. */
function stateOf(cp) {
  if (cp.publishedConfirmed) return cp.coverPending ? "cover-pending" : "published";
  if (cp.publishCalled) return "write-started";
  if (cp.uploaded) return "uploaded";
  if (cp.creationId || cp.videoId || cp.photoId) return "staged";
  return "empty";
}
function advance(cp, event, data = {}) {
  let patch;
  switch (event) {
    case "STAGE_INSTAGRAM": patch = { creationId: data.creationId }; break;
    case "STAGE_PHOTO": patch = { photoId: data.photoId }; break;
    case "ALLOCATE_VIDEO": patch = { videoId: data.videoId, uploadUrl: data.uploadUrl }; break;
    case "UPLOAD_COMPLETE": patch = { uploaded: true }; break;
    case "START_WRITE": patch = { publishCalled: true }; break;
    case "RECORD_VIDEO_RESULT": patch = { publishedId: data.publishedId }; break;
    case "CONFIRM_VIDEO": patch = { publishedUrl: data.publishedUrl, publishedConfirmed: true, coverPending: data.coverPending }; break;
    case "APPLY_COVER": patch = { coverUploaded: true, coverPending: false }; break;
    default: throw new Error(`Unknown publishing checkpoint event: ${event}`);
  }
  Object.assign(cp, patch);
  return cp;
}
module.exports = { stateOf, advance };
