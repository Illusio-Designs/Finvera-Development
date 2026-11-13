export type ResourceState<T, E> = { data: T; request: "idle" | "loading" | "more" | "both"; error: E };
export type ResourceEvent<T, E> = { type: "DATA"; data: T } | { type: "ERROR"; error: E } | { type: "LOADING" | "MORE"; value: boolean };
export function resourceTransition<T, E>(state: ResourceState<T, E>, event: ResourceEvent<T, E>): ResourceState<T, E> {
  if (event.type === "DATA") return { ...state, data: event.data };
  if (event.type === "ERROR") return { ...state, error: event.error };
  const loading = event.type === "LOADING" ? event.value : ["loading", "both"].includes(state.request);
  const more = event.type === "MORE" ? event.value : ["more", "both"].includes(state.request);
  return { ...state, request: loading && more ? "both" : loading ? "loading" : more ? "more" : "idle" };
}
export function resourcePhase<T, E>(state: ResourceState<T, E>) {
  if (state.request !== "idle") return state.data == null ? "loading" : state.request === "more" ? "loading-more" : "refreshing";
  if (state.error) return state.data == null ? "error" : "stale-error";
  return state.data == null ? "unloaded" : Array.isArray(state.data) && !state.data.length ? "empty" : "ready";
}
export const backendState = (ok: boolean, db?: string) => ok && db === "up" ? "online" : "offline";
export const readCacheState = (entry: { at: number } | undefined, ttl: number, now = Date.now()) => !entry ? "missing" : now - entry.at < ttl ? "fresh" : "expired";
