export function hydrateEditor<T extends { id?: number; _full?: boolean }>(draft: T | null, full: T, requestedId: number, dirty: Iterable<keyof T>): T | null {
  if (draft?.id !== requestedId || draft._full) return draft;
  const merged = { ...draft, ...full };
  for (const key of dirty) Object.assign(merged, { [key]: draft[key] });
  return merged;
}
export function reviewState(input: { loaded: boolean; canReview: boolean; checks: boolean[]; required: number; mediaCount: number; checking: boolean; error?: string; issueCount: number; busy: boolean }) {
  if (input.busy) return "submitting";
  if (!input.loaded) return "loading";
  if (!input.canReview) return "read-only";
  if (input.checking) return "checking";
  if (input.error) return "check-error";
  if (!input.mediaCount || input.issueCount) return "blocked";
  return Array.from({ length: input.required }, (_, index) => input.checks[index]).every(Boolean) ? "ready" : "checklist";
}
export function uploadState(input: { editable: boolean; posted: boolean; disabled: boolean; busy: boolean; coverBusy: boolean; remaining: number; dragging: boolean }) {
  if (!input.editable || input.posted) return "read-only";
  if (input.disabled) return "disabled";
  if (input.busy) return "uploading";
  if (input.coverBusy) return "cover";
  if (input.remaining <= 0) return "full";
  return input.dragging ? "dragging" : "idle";
}
