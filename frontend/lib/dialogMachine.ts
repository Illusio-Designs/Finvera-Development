export type Update<T> = T | ((previous: T) => T);
export type BusyDialog<T> = { phase: "closed" } | { phase: "editing" | "submitting"; data: Omit<T, "busy"> };
export function dialogValue<T extends { busy: boolean }>(state: BusyDialog<T>): T | null {
  return state.phase === "closed" ? null : { ...state.data, busy: state.phase === "submitting" } as T;
}
export function updateDialog<T extends { busy: boolean }>(state: BusyDialog<T>, update: Update<T | null>): BusyDialog<T> {
  const value = typeof update === "function" ? update(dialogValue(state)) : update;
  if (!value) return { phase: "closed" };
  const { busy, ...data } = value;
  return { phase: busy ? "submitting" : "editing", data };
}
export type ImportWizard<B, T> = { phase: "closed" } | { phase: "brand"; data: B } | { phase: "team" | "importing"; data: Omit<T, "busy"> };
export function importTeamValue<B, T extends { busy: boolean }>(state: ImportWizard<B, T>): T | null {
  return state.phase === "team" || state.phase === "importing" ? { ...state.data, busy: state.phase === "importing" } as T : null;
}
export function updateImport<B, T extends { busy: boolean }>(state: ImportWizard<B, T>, action: { kind: "brand"; update: Update<B | null> } | { kind: "team"; update: Update<T | null> }): ImportWizard<B, T> {
  if (action.kind === "brand") {
    const current = state.phase === "brand" ? state.data : null;
    const value = typeof action.update === "function" ? (action.update as (previous: B | null) => B | null)(current) : action.update;
    return value ? { phase: "brand", data: value } : state.phase === "brand" ? { phase: "closed" } : state;
  }
  const current = importTeamValue(state);
  const value = typeof action.update === "function" ? action.update(current) : action.update;
  if (!value) return current ? { phase: "closed" } : state;
  const { busy, ...data } = value;
  return { phase: busy ? "importing" : "team", data };
}
