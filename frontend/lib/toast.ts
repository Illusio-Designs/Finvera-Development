"use client";

export type ToastType = "ok" | "err";

/** Show a toast notification (handled by <Toaster/> mounted in the admin layout). */
export function toast(message: string, type: ToastType = "ok") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fv-toast", { detail: { message, type } }));
  }
}
