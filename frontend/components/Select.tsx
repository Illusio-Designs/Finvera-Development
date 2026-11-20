"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useDisclosure } from "@/lib/useDisclosure";
import { positionPopover } from "@/lib/positionPopover";

type Opt = { value: string; label: string };

/* This field keeps the string value and optional form input independent of its menu. */
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
  const [open, setOpen] = useDisclosure(false);
  const [active, setActive] = useState(0);
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${generatedId}-list`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const opts = options.map(o => typeof o === "string" ? { value: o, label: o } : o);
  const currentValue = value ?? "";
  const selected = opts.find(o => o.value === currentValue);
  const expanded = open && !disabled;

  useEffect(() => {
    const popup = list.current;
    const button = trigger.current;
    if (!expanded || !popup || !button) return;
    const cleanup = positionPopover(popup, button, { width: Math.max(180, button.offsetWidth), maxHeight: 264 });
    popup.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      cleanup();
      document.removeEventListener("pointerdown", outside);
    };
  }, [expanded, setOpen]);

  useEffect(() => {
    const popup = list.current;
    const option = popup?.children[active];
    if (!expanded || !popup || !option) return;
    const bounds = popup.getBoundingClientRect();
    const row = option.getBoundingClientRect();
    if (row.bottom > bounds.bottom) popup.scrollTop += row.bottom - bounds.bottom + 3;
    if (row.top < bounds.top) popup.scrollTop -= bounds.top - row.top + 3;
  }, [active, expanded]);

  function close() {
    trigger.current?.focus({ preventScroll: true });
    setOpen(false);
  }

  function show() {
    setActive(Math.max(0, opts.findIndex(o => o.value === currentValue)));
    setOpen(true);
  }

  function pick(value: string) {
    close();
    onChange?.(value);
  }

  function onKey(event: KeyboardEvent) {
    if (disabled) return;
    if (!expanded) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === "Tab") {
      close();
      return;
    }
    if (!["Escape", "ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") close();
    else if (event.key === "ArrowDown") setActive(index => Math.min(index + 1, Math.max(0, opts.length - 1)));
    else if (event.key === "ArrowUp") setActive(index => Math.max(0, index - 1));
    else if (event.key === "Home") setActive(0);
    else if (event.key === "End") setActive(Math.max(0, opts.length - 1));
    else if (opts[active]) pick(opts[active].value);
  }

  return (
    <div className={`cselect${expanded ? " open" : ""}${disabled ? " disabled" : ""}`} ref={root}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button type="button" id={triggerId} ref={trigger} className="cselect-btn" disabled={disabled}
        aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? listId : undefined} aria-label={ariaLabel}
        onClick={() => expanded ? close() : show()} onKeyDown={onKey}>
        <span className={`cselect-val${selected ? "" : " ph"}`}>{selected?.label ?? placeholder ?? "Select…"}</span>
        <svg className="cselect-caret" viewBox="0 0 24 24" width="16" fill="none" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {name && <input type="hidden" name={name} value={currentValue} />}
      {expanded && (
        <ul id={listId} ref={list} className="cselect-drop" popover="manual" role="listbox" tabIndex={-1}
          aria-labelledby={triggerId} aria-activedescendant={opts[active] ? `${listId}-${active}` : undefined} onKeyDown={onKey}>
          {opts.map((o, index) => (
            <li key={o.value} role="none">
              <button type="button" role="option" id={`${listId}-${index}`} tabIndex={-1} aria-selected={o.value === currentValue}
                className={`cselect-opt${o.value === currentValue ? " on" : ""}${index === active ? " active" : ""}`}
                onMouseEnter={() => setActive(index)} onClick={() => pick(o.value)}>
                <span>{o.label}</span>
                {o.value === currentValue && (
                  <svg viewBox="0 0 24 24" width="15" fill="none" stroke="currentColor" strokeWidth="2.4"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            </li>
          ))}
          {!opts.length && <li className="cselect-empty" role="presentation">No options available</li>}
        </ul>
      )}
    </div>
  );
}
