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
  if (!res.ok) throw Object.assign(new Error(data?.message || `Request failed (${res.status})`), { status: res.status });
  return data;
}

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

export const api = {
  login: (email: string, password: string) => {
    memo.clear(); // a different person may be signing in
    return req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false);
  },
  me: () => shared("me", 10000, () => req("/auth/me")),

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
const qs = (q: Q = {}) => {
  const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== "" && v != null && v !== false).map(([k, v]) => [k, String(v)])).toString();
  return s ? `?${s}` : "";
};

export const trackApi = {
  /* Activity history */
  activity: (q: Q = {}): Promise<Paged<ActivityRow>> => req(`/activity${qs(q)}`),
  history: (entity: string, id: string | number): Promise<ActivityRow[]> => req(`/activity/${encodeURIComponent(entity)}/${encodeURIComponent(String(id))}`),

  /* Lead follow-ups */
  logTouch: (leadId: number, body: { type: LeadTouch["type"]; note?: string; nextFollowUpAt?: string | null; followUpNote?: string; meetingAt?: string }): Promise<{ touch: LeadTouch; lead: Record<string, unknown> }> =>
    req(`/leads/${leadId}/touch`, { method: "POST", body: JSON.stringify(body) }),
  touches: (leadId: number): Promise<LeadTouch[]> => req(`/leads/${leadId}/touches`),
  followUps: (mine = false): Promise<{ today: string; counts: { today: number; overdue: number; week: number }; overdue: FollowUpLead[]; week: FollowUpLead[] }> =>
    req(`/leads/follow-ups${mine ? "?mine=1" : ""}`),

  /* Export (rows as JSON; lib/xlsxWrite builds the file) */
  exportRows: (entity: string, q: Q = {}): Promise<ExportData> => req(`/export/${encodeURIComponent(entity)}${qs({ ...q, format: "json" })}`),
  kpiReport: (month: string): Promise<KpiReport> => req(`/export/kpi-report${qs({ month })}`),

  /* Re-compress images uploaded before compression existed (admin). */
  optimizeImages: (limit = 20): Promise<{ processed: number; savedBytes: number; remaining: number; errors: { name: string; error: string }[] }> =>
    req(`/uploads/optimize-existing?limit=${limit}`, { method: "POST" }),
};
/* ═════════════════ end of activity / follow-ups / export block ═════════ */
