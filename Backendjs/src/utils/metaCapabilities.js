const meta = require("./meta");

// Read-only evidence. A granted permission is not proof of a successful write.
async function checkCapabilities(acc, platform, adapter = meta) {
  const instagram = platform === "instagram";
  const profileUrl = instagram
    ? (acc.igUsername ? `https://www.instagram.com/${encodeURIComponent(acc.igUsername)}/` : null)
    : (acc.pageId ? `https://www.facebook.com/${encodeURIComponent(acc.pageId)}` : null);
  const actions = [];
  const add = (id, label, state, detail, url) => actions.push({ id, label, state, detail, ...(url ? { url } : {}) });
  add("open", "Open profile", profileUrl ? "available" : "unavailable", "Opens the public account on the platform; no API write is made.", profileUrl);
  let tokenState = "unknown", scopes = null, tokenError = null, expiresAt = null, profileReadable = false;
  if (!adapter.configured()) tokenError = "Meta app credentials are not configured on the server.";
  else if (acc.status !== "connected") { tokenState = "unavailable"; tokenError = "Reconnect this brand before checking API access."; }
  else {
    try {
      const token = adapter.decrypt(acc.pageToken);
      const debug = await adapter.graph("GET", "/debug_token", { input_token: token, access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` });
      const data = debug.data || {};
      const rightApp = !data.app_id || String(data.app_id) === String(process.env.META_APP_ID);
      const expiries = [data.expires_at, data.data_access_expires_at].filter((n) => Number(n) > 0).map(Number);
      const expiry = expiries.length ? Math.min(...expiries) : null;
      tokenState = data.is_valid && rightApp && (!expiry || expiry * 1000 > Date.now()) ? "verified" : "unavailable";
      scopes = Array.isArray(data.scopes) ? data.scopes : null;
      if (expiry) expiresAt = new Date(expiry * 1000).toISOString();
      // Granular asset grants must include the connected Page/account when supplied.
      for (const grant of data.granular_scopes || []) {
        if (Array.isArray(grant.target_ids) && grant.target_ids.length && !grant.target_ids.some((id) => [String(acc.pageId), String(acc.igUserId)].includes(String(id)))) scopes = scopes?.filter((s) => s !== grant.scope) || null;
      }
      if (tokenState === "verified" && (!instagram || acc.igUserId)) {
        try { await adapter.graph("GET", `/${instagram ? acc.igUserId : acc.pageId}`, { fields: instagram ? "id,username" : "id,name", access_token: token }); profileReadable = true; } catch { /* a valid token does not imply access to this asset */ }
      }
    } catch { tokenState = "unknown"; scopes = null; tokenError = "Meta could not verify this token. Check network access, app configuration and account permissions."; }
  }
  add("token", "Token and app access", tokenState, tokenError || (tokenState === "verified" ? "Meta confirmed a valid token for this app." : "The stored token is invalid or belongs to another app."));
  add("view", "Read profile details", profileReadable ? "verified" : "unknown", profileReadable ? "A read-only request to this account succeeded." : "Profile access has not been verified.");
  const permission = (needed) => tokenState !== "verified" || !scopes ? "unknown" : needed.every((s) => scopes.includes(s)) ? "permission_granted" : "missing_permission";
  const publishing = permission(instagram ? ["instagram_basic", "instagram_content_publish"] : ["pages_manage_posts"]);
  add("publish", "Publish supported posts", instagram && !acc.igUserId ? "unavailable" : publishing,
    publishing === "permission_granted" ? "Required scopes are present. Verify each supported media format with an authorized test post; no publishing test was performed here." : "Check app review, granted permissions, asset access and the supported media formats.");
  if (instagram) {
    add("edit", "Edit profile", "external", "Finvera does not implement Instagram profile writes. Open Instagram to edit this account.", "https://www.instagram.com/accounts/edit/");
  } else {
    const editing = permission(["pages_manage_metadata"]);
    add("edit", "Edit supported Page details", editing, "Finvera implements About, description, website, phone and email. Scope presence alone does not verify field-specific write access. Name and picture edits open Facebook.");
  }
  add("identity", instagram ? "Edit name and profile picture" : "Edit Page name and profile picture", "external", "Finvera does not implement these identity changes. Open the account on the platform.", instagram ? "https://www.instagram.com/accounts/edit/" : profileUrl);
  add("stories", "Publish Stories", "not_implemented", "Finvera’s publisher does not send a Story-specific publishing payload.");
  if (!instagram) add("reels", "Publish Facebook Reels", "not_implemented", "The current Facebook publisher sends video posts, not a dedicated Reels workflow.");
  add("liveEdits", "Edit or delete already-live posts", "not_implemented", "Scheduled edits are supported before publishing; changes to live platform posts are a separate workflow.");
  add("mediaTags", "Tag people on media", "not_implemented", "The current publisher does not send media-tag payloads. Do not treat the calendar’s People to tag field as a published tag.");
  add("mentions", "Caption mentions", "needs_test", "Caption handles are sent as text. Clickable mentions depend on platform behavior and must be checked separately.");
  add("review", "App review and production access", "needs_test", "Verify the app’s mode, approved access level, business requirements and production assets in the Meta dashboard. This token check does not certify app review.");
  add("schedule", "Schedule and edit before publishing", "available", "Scheduling is managed by Finvera. Content changes require review again; editing locks when publishing starts.");
  return { platform, client: acc.client, checkedAt: new Date().toISOString(), expiresAt, scopes, actions, writeTestsPerformed: false };
}

module.exports = { checkCapabilities };
