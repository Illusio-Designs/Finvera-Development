export type EnquiryState = "idle" | "sending" | "ok" | "error";
export type EnquiryEvent = "SUBMIT" | "SUCCESS" | "FAILURE" | "RESET" | "SETTLED";
export function enquiryTransition(state: EnquiryState, event: EnquiryEvent): EnquiryState {
  if (event === "SUBMIT") return "sending";
  if (event === "SUCCESS") return "ok";
  if (event === "FAILURE") return "error";
  if (event === "RESET") return "idle";
  return state === "sending" ? "idle" : state;
}
export type CaptchaState = { phase: "empty" | "loading" | "ready" | "token" | "expired" | "error" | "unmounted"; token: string };
export function captchaTransition(state: CaptchaState, event: { type: "LOAD" | "RESET" | "EXPIRE" | "ERROR" | "REMOVE" } | { type: "TOKEN"; token: string }): CaptchaState {
  if (event.type === "TOKEN") return { phase: "token", token: event.token };
  if (event.type === "LOAD") return { ...state, phase: "loading" };
  if (event.type === "REMOVE") return { ...state, phase: "unmounted" };
  return { phase: event.type === "RESET" ? "ready" : event.type === "EXPIRE" ? "expired" : "error", token: "" };
}
