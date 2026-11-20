"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { positionPopover } from "@/lib/positionPopover";
import "./workspace-action-menu.css";

export default function WorkspaceActionMenu({ label, children, disabled = false }: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const expanded = open && !disabled;

  function close() {
    trigger.current?.focus({ preventScroll: true });
    setOpen(false);
  }

  useEffect(() => {
    if (!expanded || !panel.current || !trigger.current) return;
    const cleanup = positionPopover(panel.current, trigger.current, { width: 248, maxHeight: 400 });
    panel.current.querySelector<HTMLElement>("button:not(:disabled), a[href]")?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => {
      cleanup();
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [expanded]);

  return <div className="fw-action-menu" ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => { if (event.key === "Escape" && expanded) { event.preventDefault(); event.stopPropagation(); close(); } }}>
    <button type="button" id={`${id}-trigger`} ref={trigger} className="adm-btn ghost" disabled={disabled}
      aria-expanded={expanded} aria-controls={expanded ? id : undefined} onClick={() => setOpen(!expanded)}>
      {label}<svg className="fw-action-menu-caret" aria-hidden="true" viewBox="0 0 16 16" width="14" height="14">
        <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    {expanded && <div id={id} ref={panel} className="fw-action-menu-panel" popover="manual" role="group" aria-labelledby={`${id}-trigger`}
      onClick={event => { if ((event.target as Element).closest("button,a[href]")) close(); }}>
      {children}
    </div>}
  </div>;
}
