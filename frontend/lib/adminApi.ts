/* Client-side API helper for the admin dashboard (uses JWT from localStorage). */
"use client";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "fv_admin_token";

export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const hasApi = () => Boolean(API_BASE);

async function req(path: string, options: RequestInit = {}, auth = true): Promise<any> {
  if (!API_BASE) throw new Error("NEXT_PUBLIC_API_URL is not set — connect the backend to use the admin.");
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined" && !location.pathname.endsWith("/admin/login")) location.href = "/admin/login";
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
  // settings / seo
  getSettings: () => req(`/settings/all`),
  saveSettings: (body: any) => req(`/settings`, { method: "PUT", body: JSON.stringify(body) }),
  listSeo: () => req(`/seo`),
  saveSeo: (page: string, body: any) => req(`/seo/${page}`, { method: "PUT", body: JSON.stringify(body) }),
  // contact
  listContact: () => req(`/contact`),
  markContact: (id: number, isRead: boolean) => req(`/contact/${id}/read`, { method: "PATCH", body: JSON.stringify({ isRead }) }),
  removeContact: (id: number) => req(`/contact/${id}`, { method: "DELETE" }),
  // upload
  upload: async (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append("file", file);
    return req(`/uploads`, { method: "POST", body: fd });
  },
};
