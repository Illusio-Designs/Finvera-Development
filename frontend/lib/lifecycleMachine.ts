export type PollState = "hidden" | "running" | "disposed";
export const pollTransition = (state: PollState, event: "VISIBLE" | "HIDDEN" | "CLEANUP"): PollState => state === "disposed" || event === "CLEANUP" ? "disposed" : event === "VISIBLE" ? "running" : "hidden";
export const lazyState = (value: unknown) => value === undefined ? "uninitialized" : value === null ? "unavailable" : "ready";
