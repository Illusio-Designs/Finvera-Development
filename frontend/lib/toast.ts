"use client";

export type ToastType = "ok" | "err" | "info" | "warn";

export type ToastOptions = {
  /** Second line under the title — say what happened to what. */
  description?: string;
  /** Optional button, e.g. { label: "Open", onClick } */
  action?: { label: string; onClick: () => void };
  /** Play the matching sound (default true). */
  sound?: boolean;
  duration?: number;
};

export type ToastDetail = ToastOptions & { message: string; type: ToastType };

/** Show a toast notification (handled by the toaster mounted in the layout). */
export function toast(message: string, type: ToastType = "ok", opts: ToastOptions = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fv-toast", { detail: { message, type, ...opts } satisfies ToastDetail }));
  }
}
