export type SaveState<E> = { activity: "idle" | "saving"; outcome: "none" | "error" | "conflict"; error: E };
export type SaveEvent<E> = { type: "ACTIVITY"; saving: boolean } | { type: "ERROR"; error: E } | { type: "CONFLICT"; value: boolean };
export function saveTransition<E>(state: SaveState<E>, event: SaveEvent<E>): SaveState<E> {
  if (event.type === "ACTIVITY") return { ...state, activity: event.saving ? "saving" : "idle" };
  if (event.type === "ERROR") return { ...state, error: event.error, outcome: state.outcome === "conflict" ? "conflict" : event.error ? "error" : "none" };
  return { ...state, outcome: event.value ? "conflict" : state.error ? "error" : "none" };
}
export const reportCaptureAction = (saved: boolean, dirty: boolean, status?: string) => !saved ? "create" : dirty || status ? "update" : "read";
