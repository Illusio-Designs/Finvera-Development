export function pushEligibility(input: { ios: boolean; standalone: boolean; supported: boolean; permission: string }) {
  if (input.ios && !input.standalone) return "ios-install";
  if (!input.supported) return "unsupported";
  return input.permission === "denied" ? "denied" : input.permission !== "granted" ? "off" : "subscription";
}
export const subscriptionAction = (exists: boolean, keyMatches: boolean) => !exists ? "create" : keyMatches ? "reuse" : "replace";
export const installState = (installed: boolean, prompt: boolean, ios: boolean) => installed ? "installed" : prompt ? "prompt" : ios ? "instructions" : "unavailable";
export function readNotification<T extends { isRead: boolean }>(notification: T): T { return { ...notification, isRead: true }; }
