/* Client-side API helper for the admin — talks to the live backend. */
"use client";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://api.finvera.solutions").replace(/\/$/, "");
const TOKEN_KEY = "fv_admin_token";

export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const hasApi = () => Boolean(API_BASE);

async function req(path: string, options: RequestInit = {}, auth = true): Promise<any> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  // Only treat 401 as an expired session for authed requests — NOT for login,
  // where a 401 just means wrong credentials (let the real message through).
  if (res.status === 401 && auth) {
    clearToken();
    if (typeof window !== "undefined" && location.pathname !== "/login") location.href = "/login";
    throw new Error("Session expired. Please sign in again.");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw Object.assign(new Error(data?.message || `Request failed (${res.status})`), { status: res.status, field: data?.field as string | undefined, data });
  return data;
}

/* An API error carries the HTTP status, the form field it is about (when the
   backend names one, e.g. "password") and the full JSON body. */
export type ApiError = Error & { status?: number; field?: string; data?: any };
export const apiErr = (e: unknown): ApiError => (e instanceof Error ? e : new Error(String(e))) as ApiError;

/* Short-lived memo for reads several components fire on the same page load
   (the shell, the page and its widgets each asked for /auth/me). Shares the
   in-flight request and keeps the answer `ms` milliseconds; failures aren't kept. */
const memo = new Map<string, { at: number; p: Promise<any> }>();
function shared(key: string, ms: number, run: () => Promise<any>): Promise<any> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.p;
  const p = run();
  memo.set(key, { at: Date.now(), p });
  p.catch(() => { if (memo.get(key)?.p === p) memo.delete(key); });
  return p;
}
export const clearApiMemo = () => memo.clear();

/* ── Account & security types (backend: auth + users controllers) ── */
export type AuthUser = {
  id: number; name: string; email: string; role: string; roles: string[]; avatar: string | null; title: string | null;
  socialClients: number[] | null; mustChangePassword: boolean; twoFactorEnabled: boolean; lastLoginAt: string | null;
};
export type LoginResult =
  | { twoFactorRequired?: false; token: string; user: AuthUser; mustChangePassword: boolean; sessionId: number; usedBackupCode?: boolean; backupCodesLeft?: number }
  | { twoFactorRequired: true; ticket: string; message: string };
export type UserStatus = "invited" | "active" | "locked" | "deactivated";
export type AdminUser = {
  id: number; name: string; email: string; role: string; roles: string[]; active: boolean; avatar: string | null; title: string | null;
  createdAt: string; socialClients: number[]; status: UserStatus; lastLoginAt: string | null; lastSeenAt: string | null;
  twoFactorEnabled: boolean; mustChangePassword: boolean; invitedAt: string | null; lockedUntil: string | null;
};
export type Session = { id: number; device: string; userAgent: string; ip: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean };
export type SecEvent = {
  id: number; type: string; createdAt: string; ip: string | null; device: string | null; email: string | null; meta: Record<string, any>;
  user: { id: number; name: string | null; email: string | null; avatar?: string | null } | null; actor: { id: number; name: string } | null;
};
export type SecPage = { items: SecEvent[]; total: number; page: number; limit: number; pages: number; types: string[] };
export type LogQuery = { page?: number; limit?: number; type?: string; from?: string; to?: string; userId?: number | string; q?: string };
export type ShareLink = { link: string; expiresAt: string; emailed: boolean; emailError?: string | null; message: string; kind?: "reset" | "invite"; user?: AdminUser };
export type InviteBody = { name: string; email: string; roles: string[]; title?: string; avatar?: string; socialClients?: number[]; sendEmail?: boolean };

const qs = (q: Record<string, unknown>) => {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};
const post = (path: string, body?: unknown, auth = true) =>
  req(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, auth);

/* GET /api/overview and GET /api/today (dashboard home). */
export type HomeLead = { id: number; name: string; company?: string | null; stage: string; value?: number | null; owner?: string | null; nextFollowUpAt?: string | null; followUpNote?: string | null; source?: string | null; createdAt?: string };
export type Overview = {
  counts: Record<string, number>;
  contact: { total: number; unread: number; recent: { id: number; name: string; email: string; projectType?: string; message?: string; createdAt: string; isRead: boolean }[] } | null;
  leads: {
    total: number; byStage: Record<string, { count: number; value: number }>;
    due?: HomeLead[]; fresh?: HomeLead[]; followUpToday?: number; followUpOverdue?: number;
  } | null;
};
export type TodayNeed = {
  kind: "failed" | "approval" | "atRisk" | "renewal"; id: number; postId?: number; client?: string; platform?: string;
  status?: string; title: string; sub: string; link: string; goLiveAt?: string; renewalDate?: string;
};
export type Today = {
  today: string; weekFrom: string; weekTo: string;
  counts: {
    overdue: number; approvals: number; goingLiveWeek: number; scheduledWeek: number; onTimeMonthPct: number | null;
    leadsFollowUpToday: number | null; leadsFollowUpOverdue: number | null;
  };
  needsYou: TodayNeed[]; needsYouTotal: number;
  week: { day: string; total: number; ready: number }[];
  team: { id: number; name: string; avatar?: string | null; role: string; onTimePct: number | null; delivered: number; open: number; overdue: number }[];
};

export const api = {
  login: (email: string, password: string): Promise<LoginResult> => {
    memo.clear(); // a different person may be signing in
    return req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
  },
  /* Second sign-in step: 6-digit app code or a backup code (ab12-cd34).
     Public call, so a 401 ("code didn't work") doesn't sign anyone out. */
  login2fa: (ticket: string, code: string): Promise<LoginResult> => { memo.clear(); return post("/auth/login/2fa", { ticket, code }, false); },
  me: () => shared("me", 10000, () => req("/auth/me")),

  /* ── Public password links ── */
  forgotPassword: (email: string): Promise<{ message: string }> => post("/auth/forgot", { email }, false),
  resetInfo: (token: string): Promise<{ valid: true; kind: "reset" | "invite"; email: string; name: string; expiresAt: string }> =>
    req(`/auth/reset-info${qs({ token })}`, {}, false),
  resetPassword: (token: string, password: string): Promise<{ message: string; email: string }> => post("/auth/reset", { token, password }, false),

  /* ── The signed-in user's own account ── */
  updateMe: (body: { name?: string; email?: string; avatar?: string | null; currentPassword?: string }): Promise<{ user: AuthUser; message: string }> =>
    req("/auth/me", { method: "PUT", body: JSON.stringify(body) }).finally(() => memo.delete("me")),
  changePassword: (currentPassword: string, newPassword: string): Promise<{ message: string; sessionsEnded: number }> =>
    post("/auth/change-password", { currentPassword, newPassword }).finally(() => memo.delete("me")),
  mySessions: (): Promise<{ sessions: Session[]; currentSessionId: number | null }> => req("/auth/sessions"),
  revokeMySession: (id: number): Promise<{ message: string; id: number; current: boolean }> => req(`/auth/sessions/${id}`, { method: "DELETE" }),
  logout: (): Promise<{ message: string }> => post("/auth/logout"),
  logoutAll: (includeCurrent = false): Promise<{ message: string; count: number }> => post("/auth/logout-all", { includeCurrent }),
  myActivity: (q: LogQuery = {}): Promise<SecPage> => req(`/auth/activity${qs(q)}`),
  twoFactorSetup: (): Promise<{ secret: string; otpauthUrl: string; issuer: string; account: string }> => post("/auth/2fa/setup"),
  twoFactorEnable: (code: string): Promise<{ message: string; backupCodes: string[] }> => post("/auth/2fa/enable", { code }).finally(() => memo.delete("me")),
  twoFactorDisable: (password: string, code: string): Promise<{ message: string }> => post("/auth/2fa/disable", { password, code }).finally(() => memo.delete("me")),
  newBackupCodes: (code: string): Promise<{ message: string; backupCodes: string[] }> => post("/auth/2fa/backup-codes", { code }),

  /* ── Team members' accounts (admin only) ── */
  listAdminUsers: (): Promise<AdminUser[]> => req("/users"),
  createUser: (body: Record<string, unknown>): Promise<AdminUser> => post("/users", body),
  updateUser: (id: number, body: Record<string, unknown>): Promise<AdminUser> => req(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteUser: (id: number): Promise<{ message: string; id: number }> => req(`/users/${id}`, { method: "DELETE" }),
  inviteUser: (body: InviteBody): Promise<ShareLink & { user: AdminUser }> => post("/users/invite", body),
  resendInvite: (id: number, sendEmail = true): Promise<ShareLink & { user: AdminUser }> => post(`/users/${id}/resend-invite`, { sendEmail }),
  userResetLink: (id: number, sendEmail = true): Promise<ShareLink> => post(`/users/${id}/reset-link`, { sendEmail }),
  requirePasswordChange: (id: number, required = true): Promise<{ message: string; user: AdminUser }> => post(`/users/${id}/require-password-change`, { required }),
  unlockUser: (id: number): Promise<{ message: string; user: AdminUser }> => post(`/users/${id}/unlock`),
  resetUser2fa: (id: number): Promise<{ message: string; user: AdminUser }> => post(`/users/${id}/2fa/reset`),
  userSessions: (id: number): Promise<{ sessions: Session[] }> => req(`/users/${id}/sessions`),
  revokeUserSession: (id: number, sid: number): Promise<{ message: string; id: number }> => req(`/users/${id}/sessions/${sid}`, { method: "DELETE" }),
  logoutUserAll: (id: number): Promise<{ message: string; count: number }> => post(`/users/${id}/logout-all`),
  userActivity: (id: number, q: LogQuery = {}): Promise<SecPage> => req(`/users/${id}/activity${qs(q)}`),
  securityLog: (q: LogQuery = {}): Promise<SecPage> => req(`/security/log${qs(q)}`),

  list: (resource: string) => req(`/${resource}`),
  get: (resource: string, id: string | number) => req(`/${resource}/${id}`),
  create: (resource: string, body: any) => req(`/${resource}`, { method: "POST", body: JSON.stringify(body) }),
  update: (resource: string, id: string | number, body: any) => req(`/${resource}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (resource: string, id: string | number) => req(`/${resource}/${id}`, { method: "DELETE" }),

  getSettings: () => req(`/settings/all`),
  saveSettings: (body: any) => req(`/settings`, { method: "PUT", body: JSON.stringify(body) }),
  listSeo: () => req(`/seo`),
  saveSeo: (page: string, body: any) => req(`/seo/${page}`, { method: "PUT", body: JSON.stringify(body) }),

  listContact: () => req(`/contact`),
  markContact: (id: number, isRead: boolean) => req(`/contact/${id}/read`, { method: "PATCH", body: JSON.stringify({ isRead }) }),
  removeContact: (id: number) => req(`/contact/${id}`, { method: "DELETE" }),

  upload: async (file: File): Promise<{ url: string }> => {
    const fd = new FormData(); fd.append("file", file);
    return req(`/uploads`, { method: "POST", body: fd });
  },

  /* Minimal user directory for assigning members (kanban etc.) — any role. */
  listUsers: () => shared("assignable", 30000, () => req(`/users/assignable`)),

  /* Notifications */
  listNotifications: () => req(`/notifications`),
  markNotifRead: (id: number) => req(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllNotifRead: () => req(`/notifications/read-all`, { method: "POST" }),
  clearNotifs: () => req(`/notifications/clear`, { method: "POST" }),
  /* Web Push (phone / desktop notifications) */
  pushKey: () => req(`/push/key`),
  pushSubscribe: (subscription: any) => req(`/push/subscribe`, { method: "POST", body: JSON.stringify({ subscription }) }),
  pushUnsubscribe: (endpoint: string) => req(`/push/unsubscribe`, { method: "POST", body: JSON.stringify({ endpoint }) }),
  pushTest: () => req(`/push/test`, { method: "POST" }),
  socialKpis: (period: string, brand = "") => req(`/social-kpis?period=${encodeURIComponent(period)}${brand ? `&brand=${encodeURIComponent(brand)}` : ""}`),

  /* Sidebar counts in one small call (scoped to the signed-in user). */
  badges: (): Promise<{ socialOverdue: number; approvals: number; inboxUnread: number; leadsFollowUpToday?: number; leadsFollowUpOverdue?: number }> => req(`/badges`),
  /* Dashboard home in one call (counts, recent messages, lead stages and follow-ups). */
  overview: (): Promise<Overview> => req(`/overview`),
  /* Dashboard home, social part ("Today"): counts, needs-you list, this week, team on-time. */
  today: (): Promise<Today> => req(`/today`),

  /* Social media calendar — `fields: "card"` drops the heavy text fields
     (caption, requirements…); `from`/`to` (YYYY-MM-DD) limit dated posts to a
     go-live range (open and undated posts always come back). Older backends
     ignore these and return everything. getSocialPost returns the full post. */
  listSocialPosts: (q: { fields?: "card"; from?: string; to?: string; mine?: "1" } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return req(`/social-posts${qs ? `?${qs}` : ""}`);
  },
  checkSocialMedia: (id: number) => req(`/social-posts/${id}/media-check`),
  getSocialPost: (id: number) => req(`/social-posts/${id}`),

  /* Social media calendar — bulk import rows parsed from a client's sheet */
  importSocialPosts: (posts: any[]) => req(`/social-posts/bulk`, { method: "POST", body: JSON.stringify({ posts }) }),
  /* Auto-publishing (Instagram / Facebook) */
  metaStatus: () => req(`/social-connect/meta/status`),
  metaStart: (brand: string) => req(`/social-connect/meta/start?brand=${encodeURIComponent(brand)}`),
  metaPages: (sel: string) => req(`/social-connect/meta/pages?sel=${encodeURIComponent(sel)}`),
  metaChoose: (sel: string, pageId: string) => req(`/social-connect/meta/choose`, { method: "POST", body: JSON.stringify({ sel, pageId }) }),
  socialAccounts: () => req(`/social-accounts`),
  socialStudio: () => req(`/social-studio`),
  channelCapabilities: (client: string, platform: string) => req(`/social-accounts/${encodeURIComponent(client)}/capabilities?platform=${platform}`),
  channelProfile: (client: string, platform: string) => req(`/social-accounts/${encodeURIComponent(client)}/profile?platform=${platform}`),
  updatePageProfile: (client: string, body: Record<string, string>) => req(`/social-accounts/${encodeURIComponent(client)}/profile`, { method: "PUT", body: JSON.stringify(body) }),
  pauseChannel: (client: string, platform: string, paused: boolean) => req(`/social-accounts/${encodeURIComponent(client)}/pause`, { method: "POST", body: JSON.stringify({ platform, paused }) }),
  disconnectSocial: (client: string) => req(`/social-accounts/${encodeURIComponent(client)}`, { method: "DELETE" }),
  publishJobs: (postId?: number) => req(`/social-publish-jobs${postId ? `?postId=${postId}` : ""}`),
  retryJob: (id: number, confirmedAbsent = false) => req(`/social-publish-jobs/${id}/retry`, { method: "POST", body: JSON.stringify({ confirmedAbsent }) }),
  renewRenewal: (id: number, remark: string) => req(`/renewals/${id}/renew`, { method: "POST", body: JSON.stringify({ remark }) }),
  terminateRenewal: (id: number, remark: string) => req(`/renewals/${id}/terminate`, { method: "POST", body: JSON.stringify({ remark }) }),
  markJobPosted: (id: number, url: string) => req(`/social-publish-jobs/${id}/mark-posted`, { method: "POST", body: JSON.stringify({ url }) }),
  publishNow: (postId: number) => req(`/social-posts/${postId}/publish-now`, { method: "POST" }),
  uploadSocialMedia: (files: File[]) => { const fd = new FormData(); files.forEach((f) => fd.append("files", f)); return req(`/social-media/upload`, { method: "POST", body: fd }); },
  listSocialUploads: () => req(`/social-posts/uploads`),
  deleteSocialUpload: (batch: string) => req(`/social-posts/uploads/${encodeURIComponent(batch)}`, { method: "DELETE" }),
  deleteBrandPosts: (client: string) => req(`/social-posts/delete-brand`, { method: "POST", body: JSON.stringify({ client }) }),
};

/* ═══ Ops: backups, system status, email setup & preferences, Meta
   connection check, contact spam. Kept as one block (merged separately). ═══ */
export type BackupItem = { name: string; size: number; createdAt: string; tables: number | null; rows: number | null; kind: "auto" | "manual"; durationMs: number | null };
export type BackupResult = ({ ok: true } & BackupItem) | { ok: false; error: string; at: string; kind: string };
export type BackupList = { items: BackupItem[]; keep: number; running: boolean; lastResult: BackupResult | null };
export type BackupCheck = {
  ok: boolean; name: string; complete?: boolean; statements?: number; createTables?: number; inserts?: number; rows?: number; tables?: number;
  expected?: { tables: number; rows: number } | null; matches?: boolean; bytesUncompressed?: number; durationMs?: number; error?: string;
};
export type EmailPrefKind = "contact" | "renewals" | "calendar" | "publishing" | "security" | "system";
export type EmailPrefs = { prefs: Record<EmailPrefKind, boolean>; kinds: EmailPrefKind[]; email: string; mailConfigured: boolean };
export type MetaCheck = {
  metaConfigured: boolean; checked: number; at: string;
  results: { client: string; pageName: string; before: string; status: string; ok: boolean | null; expiresAt: string | null; warning: string | null; error: string | null }[];
};

export const opsApi = {
  listBackups: (): Promise<BackupList> => req(`/backups`),
  createBackup: (): Promise<BackupItem> => req(`/backups`, { method: "POST" }),
  verifyBackup: (name: string): Promise<BackupCheck> => req(`/backups/${encodeURIComponent(name)}/verify`, { method: "POST" }),
  deleteBackup: (name: string) => req(`/backups/${encodeURIComponent(name)}`, { method: "DELETE" }),
  /* The download needs the Authorization header, so it's fetched as a blob
     and saved through a temporary link (a plain <a href> would be refused). */
  downloadBackup: async (name: string) => {
    const res = await fetch(`${API_BASE}/api/backups/${encodeURIComponent(name)}/download`, { headers: { Authorization: `Bearer ${getToken() || ""}` } });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      throw new Error(j?.message || `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return blob.size;
  },
  systemStatus: () => req(`/system/status`),
  emailStatus: (): Promise<{ configured: boolean; from: string | null; host: string | null; port: number | null; user: string | null }> => req(`/settings/email-status`),
  testEmailConnection: (): Promise<{ ok: boolean; message: string }> => req(`/settings/test-email-connection`, { method: "POST", body: "{}" }),
  testEmail: (to?: string): Promise<{ ok: boolean; message: string }> => req(`/settings/test-email`, { method: "POST", body: JSON.stringify(to ? { to } : {}) }),
  getEmailPrefs: (): Promise<EmailPrefs> => req(`/auth/me/email-prefs`),
  saveEmailPrefs: (prefs: Partial<Record<EmailPrefKind, boolean>>): Promise<EmailPrefs> => req(`/auth/me/email-prefs`, { method: "PUT", body: JSON.stringify({ prefs }) }),
  checkSocialAccounts: (): Promise<MetaCheck> => req(`/social-accounts/check`, { method: "POST" }),
  listSpam: () => req(`/contact?spam=1`),
  spamCount: async (): Promise<number> => Number((await req(`/contact?spam=1&page=1&limit=1`))?.total) || 0,
  setSpam: (id: number, isSpam: boolean) => req(`/contact/${id}/spam`, { method: "PATCH", body: JSON.stringify({ isSpam }) }),
};
/* ═══ end Ops block ═══ */
/* ════════════════════════════════════════════════════════════════════
   Activity history · lead follow-ups · exports · image clean-up
   (kept together in one block at the end of the file)
   ════════════════════════════════════════════════════════════════════ */
export type ActivityRow = {
  id: number; userId: number | null; userName: string | null; action: "create" | "update" | "delete" | "other";
  entity: string; entityId: string | null; entityLabel: string | null; summary: string | null;
  changes: Record<string, [unknown, unknown]> | null; ip?: string | null; createdAt: string;
};
export type Paged<T> = { items: T[]; total: number; page: number; limit: number };
export type LeadTouch = { id: number; leadId: number; type: "call" | "email" | "whatsapp" | "meeting" | "note"; note: string | null; nextFollowUpAt: string | null; userId: number | null; userName: string | null; createdAt: string };
export type FollowUpLead = { id: number; name: string; company?: string | null; phone?: string | null; stage: string; value?: number; owner?: string | null; nextFollowUpAt: string | null; followUpNote?: string | null; meetingAt?: string | null; meetingUrl?: string | null; lastContactedAt?: string | null };
export type ExportData = { entity: string; columns: string[]; rows: Record<string, string | number | null>[]; total: number; truncated: boolean; generatedAt: string };
export type KpiReport = {
  month: string; label: string; period?: unknown;
  team: { delivered: number; deliveredPrev: number; onTime: number | null; onTimePrev: number | null; avgStageDays: number | null; hours: number; estHours: number | null; open: number; overdue: number; people?: number; stages: { stage: string; avgDays: number | null; moves: number }[] } | null;
  columns: string[]; rows: Record<string, string | number>[]; brandColumns: string[]; brandRows: Record<string, string | number>[]; generatedAt: string;
};
type Q = Record<string, string | number | boolean | null | undefined>;
/* Query string from an object, skipping empty values. */
const qsT = (q: Q = {}) => {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== "" && v != null && v !== false).map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};

export const trackApi = {
  /* Activity history */
  activity: (q: Q = {}): Promise<Paged<ActivityRow>> => req(`/activity${qsT(q)}`),
  history: (entity: string, id: string | number): Promise<ActivityRow[]> => req(`/activity/${encodeURIComponent(entity)}/${encodeURIComponent(String(id))}`),

  /* Lead follow-ups */
  logTouch: (leadId: number, body: { type: LeadTouch["type"]; note?: string; nextFollowUpAt?: string | null; followUpNote?: string; meetingAt?: string }): Promise<{ touch: LeadTouch; lead: Record<string, unknown> }> =>
    req(`/leads/${leadId}/touch`, { method: "POST", body: JSON.stringify(body) }),
  touches: (leadId: number): Promise<LeadTouch[]> => req(`/leads/${leadId}/touches`),
  followUps: (mine = false): Promise<{ today: string; counts: { today: number; overdue: number; week: number }; overdue: FollowUpLead[]; week: FollowUpLead[] }> =>
    req(`/leads/follow-ups${mine ? "?mine=1" : ""}`),

  /* Export (rows as JSON; lib/xlsxWrite builds the file) */
  exportRows: (entity: string, q: Q = {}): Promise<ExportData> => req(`/export/${encodeURIComponent(entity)}${qsT({ ...q, format: "json" })}`),
  kpiReport: (month: string): Promise<KpiReport> => req(`/export/kpi-report${qsT({ month })}`),

  /* Re-compress images uploaded before compression existed (admin). */
  optimizeImages: (limit = 20): Promise<{ processed: number; savedBytes: number; remaining: number; errors: { name: string; error: string }[] }> =>
    req(`/uploads/optimize-existing?limit=${limit}`, { method: "POST" }),
};
/* ═════════════════ end of activity / follow-ups / export block ═════════ */

/* ═══ Contact inbox block: paged list, counts, one message, email replies,
   convert to lead. Kept as one block (merged separately). ═══ */
export type ContactMsg = {
  id: number; name: string; email: string; phone?: string | null; company?: string | null; projectType?: string | null;
  message: string; isRead: boolean | null; isSpam?: boolean; spamReason?: string | null; leadId?: number | null; createdAt: string;
};
export type ContactReply = { id: number; contactId: number; userId?: number | null; userName?: string | null; subject?: string | null; message: string; sent: boolean; error?: string | null; createdAt: string };
export type InboxCounts = { all: number; unread: number; spam: number };
export const inboxApi = {
  list: (q: { page?: number; limit?: number; q?: string; unread?: boolean; spam?: boolean } = {}): Promise<Paged<ContactMsg>> =>
    req(`/contact${qsT({ page: q.page || 1, limit: q.limit || 50, q: q.q?.trim(), unread: q.unread ? 1 : "", spam: q.spam ? 1 : "" })}`),
  counts: (): Promise<InboxCounts> => req(`/contact/counts`),
  get: (id: number): Promise<ContactMsg> => req(`/contact/${id}`),
  setRead: (id: number, isRead: boolean): Promise<ContactMsg> => req(`/contact/${id}/read`, { method: "PATCH", body: JSON.stringify({ isRead }) }),
  remove: (id: number) => req(`/contact/${id}`, { method: "DELETE" }),
  replies: (id: number): Promise<ContactReply[]> => req(`/contact/${id}/replies`),
  reply: (id: number, body: { subject?: string; message: string }): Promise<{ reply: ContactReply; emailed: boolean }> =>
    req(`/contact/${id}/reply`, { method: "POST", body: JSON.stringify(body) }),
  toLead: (id: number): Promise<{ lead: { id: number; name: string }; created: boolean; contact: ContactMsg }> =>
    req(`/contact/${id}/to-lead`, { method: "POST" }),
};
/* ═════════════════ end of Contact inbox block ═════════ */
/* ═════════════════ Leads page (pipeline board, list, drawer) ═══════════ */
export type LeadStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";
export type LeadRow = {
  id: number; name: string; company?: string | null; purpose?: string | null; email?: string | null; phone?: string | null;
  source?: string | null; stage: LeadStage; value?: number | null; owner?: string | null; ownerId?: number | null;
  priority?: "low" | "medium" | "high" | null; notes?: string | null; position?: number | null;
  nextFollowUp?: string | null; nextFollowUpAt?: string | null; followUpNote?: string | null;
  meetingUrl?: string | null; meetingAt?: string | null; lastContactedAt?: string | null; lostReason?: string | null;
  progress?: number | null; wonAt?: string | null; createdAt?: string; updatedAt?: string;
};
export const leadsApi = {
  list: (): Promise<LeadRow[]> => req(`/leads`),
  create: (body: Partial<LeadRow>): Promise<LeadRow> => req(`/leads`, { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<LeadRow>): Promise<LeadRow> => req(`/leads/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number): Promise<{ id: number }> => req(`/leads/${id}`, { method: "DELETE" }),
  /* One board column's card order after a drag (404 on older backends). */
  reorder: (stage: LeadStage, ids: number[]): Promise<{ ok: boolean }> => req(`/leads/reorder`, { method: "POST", body: JSON.stringify({ stage, ids }) }),
};
/* ═════════════════ end of leads page block ═════════════════════════════ */
/* ═════════════════ Renewals page (timeline, table, drawer) ═════════════ */
export type RenewalCycle = "monthly" | "quarterly" | "half-yearly" | "yearly";
export type RenewalStatus = "active" | "paused" | "cancelled";
export type RenewalRow = {
  id: number; client: string; project?: string | null; amount?: number | null; cycle: RenewalCycle;
  renewalDate?: string | null; lastInvoiced?: string | null; status: RenewalStatus; owner?: string | null;
  email?: string | null; phone?: string | null; notes?: string | null; position?: number | null;
  createdAt?: string; updatedAt?: string;
};
export const renewalsApi = {
  list: (): Promise<RenewalRow[]> => req(`/renewals`),
  get: (id: number | string): Promise<RenewalRow> => req(`/renewals/${id}`),
  create: (body: Partial<RenewalRow>): Promise<RenewalRow> => req(`/renewals`, { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: Partial<RenewalRow>): Promise<RenewalRow> => req(`/renewals/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: number): Promise<unknown> => req(`/renewals/${id}`, { method: "DELETE" }),
  /* Renewed: the server moves the date on one cycle (or to `renewalDate` when given)
     and puts a dated line on top of the remarks; `invoiced: false` keeps "last renewed on". */
  renew: (id: number, body: { remark?: string; renewalDate?: string; invoiced?: boolean }): Promise<RenewalRow> =>
    req(`/renewals/${id}/renew`, { method: "POST", body: JSON.stringify(body) }),
  terminate: (id: number, remark: string): Promise<RenewalRow> => req(`/renewals/${id}/terminate`, { method: "POST", body: JSON.stringify({ remark }) }),
};
/* ═════════════════ end of renewals page block ══════════════════════════ */
/* ═════════════════ Settings & pixels page ══════════════════════════════ */
export type SettingRow = { id?: number; key: string; value: string | null; group: string | null; isPublic?: boolean; updatedAt?: string };
export const settingsApi = {
  /* Every non-internal setting with its group (needs the settings area). */
  list: (): Promise<SettingRow[]> => req(`/settings/all`),
  /* Saves only the keys sent; a 400 names the bad key in `field`. */
  save: (changes: Record<string, string>): Promise<SettingRow[]> => req(`/settings`, { method: "PUT", body: JSON.stringify(changes) }),
};
/* ═════════════════ end of settings & pixels block ══════════════════════ */
