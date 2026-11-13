export type HealthAccount = { client: string; pageId?: string; igUserId?: string | null; igUsername?: string | null; status: string; lastError?: string | null; tokenExpiresAt?: string | null; lastCheckedAt?: string | null; paused?: string[] };
export type HealthCheck = { checkedAt: string; expiresAt?: string | null; actions: { id: string; label: string; state: string; detail: string }[] };
export type HealthResult = { data?: HealthCheck; error?: string };
export function channelHealth(account: HealthAccount, platform: string, result?: HealthResult, now = Date.now()) {
  const token = result?.data?.actions.find(a => a.id === "token");
  const view = result?.data?.actions.find(a => a.id === "view");
  const publish = result?.data?.actions.find(a => a.id === "publish");
  const expires = result?.data?.expiresAt || account.tokenExpiresAt;
  const expiry = expires ? Date.parse(expires) : NaN;
  if (account.status !== "connected" || expiry <= now || token?.state === "unavailable") return { state: "danger", label: "Reconnect required", detail: account.lastError || "Reconnect this brand to restore account access.", reconnect: true };
  if (result?.error) return { state: "warning", label: "Check failed", detail: result.error, reconnect: false };
  if (publish?.state === "missing_permission") return { state: "danger", label: "Missing publishing permission", detail: "Review Meta app permissions and Page access, then reconnect after access changes.", reconnect: true };
  if (account.paused?.includes(platform)) return { state: "warning", label: "Publishing paused", detail: "Resume this channel in Studio when it is ready to publish.", reconnect: false };
  if (expiry > now && expiry <= now + 7 * 86400000) return { state: "warning", label: "Access expires soon", detail: "Reconnect before the expiry date to avoid interrupted publishing.", reconnect: true };
  if (token?.state === "verified" && view?.state === "verified" && publish?.state === "permission_granted" && result?.data && now >= Date.parse(result.data.checkedAt) && now - Date.parse(result.data.checkedAt) < 15 * 60000) return { state: "good", label: "Access verified", detail: "Token and publishing scopes verified. Media eligibility and successful publishing still depend on Meta.", reconnect: false };
  return { state: "unknown", label: "Check access", detail: "A saved connection is not a current permission check. Run a read-only check with Meta.", reconnect: false };
}
