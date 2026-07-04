"use client";
import { useEffect, useRef, useState } from "react";

type Opt = { value: string; label: string };

/* Shared custom select — replaces native <select> across the site and dashboard.
   Controlled via value/onChange; renders a hidden <input name> so it also works
   inside plain (FormData) forms. Styled to match whichever field context it sits in
   (.field on the marketing site, .adm-field in the dashboard). */
export default function Select({
  value, onChange, options, id, name, placeholder, disabled, ariaLabel,
}: {
  value?: string;
  onChange?: (v: string) => void;
  options: (Opt | string)[];
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const opts: Opt[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = opts.find((o) => o.value === value);
  const currentValue = value ?? "";

  useEffect(() => {
    if (!open) return;
    const idx = opts.findIndex((o) => o.value === currentValue);
    setActive(idx >= 0 ? idx : 0);
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (v: string) => { onChange?.(v); setOpen(false); };

  const onKey = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, opts.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (opts[active]) pick(opts[active].value); }
  };

  return (
    <div className={"cselect" + (open ? " open" : "") + (disabled ? " disabled" : "")} ref={ref}>
      <button type="button" id={id} className="cselect-btn" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)} onKeyDown={onKey}>
        <span className={"cselect-val" + (selected ? "" : " ph")}>{selected ? selected.label : (placeholder || "Select…")}</span>
        <svg className="cselect-caret" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {name && <input type="hidden" name={name} value={currentValue} />}
      {open && (
        <ul className="cselect-drop" role="listbox">
          {opts.map((o, i) => (
            <li key={o.value}>
              <button type="button" role="option" aria-selected={o.value === currentValue}
                className={"cselect-opt" + (o.value === currentValue ? " on" : "") + (i === active ? " active" : "")}
                onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}>
                <span>{o.label}</span>
                {o.value === currentValue && (
                  <svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
