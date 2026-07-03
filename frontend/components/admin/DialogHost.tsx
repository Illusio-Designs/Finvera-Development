"use client";
import { useEffect, useRef, useState } from "react";
import type { DialogOpts } from "@/lib/dialog";

type Active = { kind: "prompt" | "confirm" | "alert"; opts: DialogOpts; resolve: (v: unknown) => void };

export default function DialogHost() {
  const [active, setActive] = useState<Active | null>(null);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDialog = (e: Event) => {
      const d = (e as CustomEvent).detail as Active;
      setValue(d.opts.defaultValue || "");
      setActive(d);
    };
    window.addEventListener("fv-dialog", onDialog);
    return () => window.removeEventListener("fv-dialog", onDialog);
  }, []);

  useEffect(() => { if (active?.kind === "prompt") setTimeout(() => inputRef.current?.focus(), 30); }, [active]);

  if (!active) return null;
  const { kind, opts, resolve } = active;

  const close = (result: unknown) => { setActive(null); resolve(result); };
  const onConfirm = () => close(kind === "prompt" ? value.trim() || null : kind === "confirm" ? true : undefined);
  const onCancel = () => close(kind === "prompt" ? null : kind === "confirm" ? false : undefined);

  return (
    <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="adm-confirm" role="dialog" aria-modal="true">
        {opts.danger && (
          <div className="adm-confirm-ic">
            <svg viewBox="0 0 24 24" width={22} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
          </div>
        )}
        <h3>{opts.title}</h3>
        {opts.message && <p>{opts.message}</p>}
        {kind === "prompt" && (
          <input
            ref={inputRef}
            className="adm-dialog-input"
            value={value}
            placeholder={opts.placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onConfirm(); } if (e.key === "Escape") onCancel(); }}
          />
        )}
        <div className="adm-confirm-actions">
          {kind !== "alert" && <button className="adm-btn ghost" onClick={onCancel}>{opts.cancelText || "Cancel"}</button>}
          <button className={"adm-btn " + (opts.danger ? "danger" : "primary")} onClick={onConfirm}>
            {opts.confirmText || (kind === "confirm" ? "Confirm" : kind === "alert" ? "OK" : "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
