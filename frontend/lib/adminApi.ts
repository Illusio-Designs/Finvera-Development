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
export type ShareLink = { link: string; expiresAt: string; emailed: boolean; message: string; kind?: "reset" | "invite"; user?: AdminUser };
export type InviteBody = { name: string; email: string; roles: string[]; title?: string; avatar?: string; socialClients?: number[]; sendEmail?: boolean };

const qs = (q: Record<string, unknown>) => {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};
const post = (path: string, body?: unknown, auth = true) =>
  req(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, auth);

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

  /* Kanban — boards (Trello-style) */
  listBoards: () => req(`/boards`),
  createBoard: (body: any) => req(`/boards`, { method: "POST", body: JSON.stringify(body) }),
  updateBoard: (id: number, body: any) => req(`/boards/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBoard: (id: number) => req(`/boards/${id}`, { method: "DELETE" }),

  /* Kanban — cards */
  listTasks: (boardId?: number) => req(`/tasks${boardId ? `?boardId=${boardId}` : ""}`),
  /* Boards overview: only { id, boardId, column, completed, memberIds } per card
     (older backends ignore the param and send full cards — still works). */
  listTaskSummary: () => req(`/tasks?fields=summary`),
  /* One column's card order after a drag, in one request (404 on older backends). */
  reorderTasks: (column: string, ids: number[]) => req(`/tasks/reorder`, { method: "POST", body: JSON.stringify({ column, ids }) }),
  createTask: (body: any) => req(`/tasks`, { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: number, body: any) => req(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (id: number) => req(`/tasks/${id}`, { method: "DELETE" }),

  /* Kanban — comments */
  listComments: (taskId: number) => req(`/tasks/${taskId}/comments`),
  addComment: (taskId: number, body: string) => req(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  deleteComment: (id: number) => req(`/comments/${id}`, { method: "DELETE" }),

  /* Sidebar counts in one small call (scoped to the signed-in user). */
  badges: (): Promise<{ socialOverdue: number; approvals: number; inboxUnread: number }> => req(`/badges`),
  /* Admin Overview page in one call (counts, recent messages, lead stages). */
  overview: (): Promise<{
    counts: Record<string, number>;
    contact: { total: number; unread: number; recent: { id: number; name: string; email: string; projectType?: string; createdAt: string; isRead: boolean }[] } | null;
    leads: { total: number; byStage: Record<string, { count: number; value: number }> } | null;
  }> => req(`/overview`),

  /* Social media calendar — `fields: "card"` drops the heavy text fields
     (caption, requirements…); `from`/`to` (YYYY-MM-DD) limit dated posts to a
     go-live range (open and undated posts always come back). Older backends
     ignore these and return everything. getSocialPost returns the full post. */
  listSocialPosts: (q: { fields?: "card"; from?: string; to?: string; mine?: "1" } = {}) => {
    const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][]).toString();
    return req(`/social-posts${qs ? `?${qs}` : ""}`);
  },
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
  channelProfile: (client: string, platform: string) => req(`/social-accounts/${encodeURIComponent(client)}/profile?platform=${platform}`),
  updatePageProfile: (client: string, body: Record<string, string>) => req(`/social-accounts/${encodeURIComponent(client)}/profile`, { method: "PUT", body: JSON.stringify(body) }),
  pauseChannel: (client: string, platform: string, paused: boolean) => req(`/social-accounts/${encodeURIComponent(client)}/pause`, { method: "POST", body: JSON.stringify({ platform, paused }) }),
  disconnectSocial: (client: string) => req(`/social-accounts/${encodeURIComponent(client)}`, { method: "DELETE" }),
  publishJobs: (postId?: number) => req(`/social-publish-jobs${postId ? `?postId=${postId}` : ""}`),
  retryJob: (id: number) => req(`/social-publish-jobs/${id}/retry`, { method: "POST" }),
  renewRenewal: (id: number, remark: string) => req(`/renewals/${id}/renew`, { method: "POST", body: JSON.stringify({ remark }) }),
  terminateRenewal: (id: number, remark: string) => req(`/renewals/${id}/terminate`, { method: "POST", body: JSON.stringify({ remark }) }),
  markJobPosted: (id: number, url: string) => req(`/social-publish-jobs/${id}/mark-posted`, { method: "POST", body: JSON.stringify({ url }) }),
  publishNow: (postId: number) => req(`/social-posts/${postId}/publish-now`, { method: "POST" }),
  uploadSocialMedia: (files: File[]) => { const fd = new FormData(); files.forEach((f) => fd.append("files", f)); return req(`/social-media/upload`, { method: "POST", body: fd }); },
  listSocialUploads: () => req(`/social-posts/uploads`),
  deleteSocialUpload: (batch: string) => req(`/social-posts/uploads/${encodeURIComponent(batch)}`, { method: "DELETE" }),
  deleteBrandPosts: (client: string) => req(`/social-posts/delete-brand`, { method: "POST", body: JSON.stringify({ client }) }),
};
