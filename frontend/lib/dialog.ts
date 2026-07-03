"use client";
/* App dialog system — replaces native prompt()/confirm()/alert() with our own
   styled modal. A <DialogHost/> (mounted in the admin layout) listens for the
   "fv-dialog" event and resolves the returned promise. */

export type DialogOpts = {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type Kind = "prompt" | "confirm" | "alert";

function open(kind: Kind, opts: DialogOpts): Promise<unknown> {
  if (typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent("fv-dialog", { detail: { kind, opts, resolve } }));
  });
}

export const dialog = {
  prompt: (opts: DialogOpts) => open("prompt", opts) as Promise<string | null>,
  confirm: (opts: DialogOpts) => open("confirm", opts) as Promise<boolean>,
  alert: (opts: DialogOpts) => open("alert", opts) as Promise<void>,
};
