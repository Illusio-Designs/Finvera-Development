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
  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  me: () => req("/auth/me"),

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

  /* Users (for assigning members) */
  listUsers: () => req(`/users`),

  /* Kanban — boards (Trello-style) */
  listBoards: () => req(`/boards`),
  createBoard: (body: any) => req(`/boards`, { method: "POST", body: JSON.stringify(body) }),
  updateBoard: (id: number, body: any) => req(`/boards/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteBoard: (id: number) => req(`/boards/${id}`, { method: "DELETE" }),

  /* Kanban — cards */
  listTasks: (boardId?: number) => req(`/tasks${boardId ? `?boardId=${boardId}` : ""}`),
  createTask: (body: any) => req(`/tasks`, { method: "POST", body: JSON.stringify(body) }),
  updateTask: (id: number, body: any) => req(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteTask: (id: number) => req(`/tasks/${id}`, { method: "DELETE" }),

  /* Kanban — comments */
  listComments: (taskId: number) => req(`/tasks/${taskId}/comments`),
  addComment: (taskId: number, body: string) => req(`/tasks/${taskId}/comments`, { method: "POST", body: JSON.stringify({ body }) }),
  deleteComment: (id: number) => req(`/comments/${id}`, { method: "DELETE" }),
};
