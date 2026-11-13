export type DisclosureState = "open" | "closed";
export const disclosureTransition = (state: DisclosureState, event: "OPEN" | "CLOSE" | "TOGGLE"): DisclosureState => event === "OPEN" ? "open" : event === "CLOSE" ? "closed" : state === "open" ? "closed" : "open";
export const imageTransition = (_state: string | undefined, event: "LOAD" | "READY" | "FAIL") => event === "LOAD" ? "loading" : event === "READY" ? "ready" : "error";
export function dialogResult(kind: "prompt" | "confirm" | "alert", confirmed: boolean, value: string) {
  return kind === "prompt" ? confirmed ? value.trim() || null : null : kind === "confirm" ? confirmed : undefined;
}
export const revealState = (visible: boolean, oneWay: boolean, alreadyRevealed: boolean) => visible || oneWay && alreadyRevealed ? "visible" : "hidden";
