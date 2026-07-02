/* Client-side API helper for the admin. Uses the live backend when
   NEXT_PUBLIC_API_URL is set, otherwise a localStorage mock backend. */
"use client";
import { mockApi } from "./adminMock";

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "fv_admin_token";
const MOCK = !API_BASE;

export const getToken = () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);
export const hasApi = () => Boolean(API_BASE);
export const isMock = () => MOCK;

async function req(path: string, options: RequestInit = {}, auth = true): Promise<any> {
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
    MOCK ? mockApi.login(email) : req("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }, false),
  me: () => (MOCK ? mockApi.me() : req("/auth/me")),

  list: (resource: string) => (MOCK ? mockApi.list(resource) : req(`/${resource}`)),
  get: (resource: string, id: string | number) => (MOCK ? mockApi.list(resource).then((r: any[]) => r.find((x) => x.id === id || x.slug === id)) : req(`/${resource}/${id}`)),
  create: (resource: string, body: any) => (MOCK ? mockApi.create(resource, body) : req(`/${resource}`, { method: "POST", body: JSON.stringify(body) })),
  update: (resource: string, id: string | number, body: any) => (MOCK ? mockApi.update(resource, Number(id), body) : req(`/${resource}/${id}`, { method: "PUT", body: JSON.stringify(body) })),
  remove: (resource: string, id: string | number) => (MOCK ? mockApi.remove(resource, Number(id)) : req(`/${resource}/${id}`, { method: "DELETE" })),

  getSettings: () => (MOCK ? mockApi.getSettings() : req(`/settings/all`)),
  saveSettings: (body: any) => (MOCK ? mockApi.saveSettings(body) : req(`/settings`, { method: "PUT", body: JSON.stringify(body) })),
  listSeo: () => (MOCK ? mockApi.listSeo() : req(`/seo`)),
  saveSeo: (page: string, body: any) => (MOCK ? mockApi.saveSeo(page, body) : req(`/seo/${page}`, { method: "PUT", body: JSON.stringify(body) })),

  listContact: () => (MOCK ? mockApi.listContact() : req(`/contact`)),
  markContact: (id: number, isRead: boolean) => (MOCK ? mockApi.markContact(id, isRead) : req(`/contact/${id}/read`, { method: "PATCH", body: JSON.stringify({ isRead }) })),
  removeContact: (id: number) => (MOCK ? mockApi.removeContact(id) : req(`/contact/${id}`, { method: "DELETE" })),

  upload: async (file: File): Promise<{ url: string }> => {
    if (MOCK) return mockApi.upload(file);
    const fd = new FormData(); fd.append("file", file);
    return req(`/uploads`, { method: "POST", body: fd });
  },

  /* Kanban board */
  getColumns: async (): Promise<{ id: string; title: string }[]> => {
    if (MOCK) return mockApi.getColumns();
    const s = await req(`/settings`);
    try { return JSON.parse(s.kanban_columns || "[]"); } catch { return []; }
  },
  saveColumns: (columns: any[]) => (MOCK ? mockApi.saveColumns(columns) : req(`/settings`, { method: "PUT", body: JSON.stringify({ kanban_columns: JSON.stringify(columns) }) })),
  listTasks: () => (MOCK ? mockApi.listTasks() : req(`/tasks`)),
  createTask: (body: any) => (MOCK ? mockApi.createTask(body) : req(`/tasks`, { method: "POST", body: JSON.stringify(body) })),
  updateTask: (id: number, body: any) => (MOCK ? mockApi.updateTask(id, body) : req(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) })),
  deleteTask: (id: number) => (MOCK ? mockApi.deleteTask(id) : req(`/tasks/${id}`, { method: "DELETE" })),
};
