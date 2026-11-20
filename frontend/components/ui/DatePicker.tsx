"use client";
import { useDisclosure } from "@/lib/useDisclosure";
import { positionPopover } from "@/lib/positionPopover";

import { useEffect, useMemo, useRef, useState } from "react";

interface DatePickerProps {
  value?: string;
  onChange?: (v: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  defaultValue?: string;
  mode?: "date" | "month" | "datetime" | "time";
  ariaLabel?: string;
  allowedMonths?: readonly string[];
  today?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Parse an ISO YYYY-MM-DD string into a local Date, or null. */
function parseISO(v: string | undefined): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(year, month, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Format a Date as ISO YYYY-MM-DD in local time. */
function toISO(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format a Date as e.g. "Jul 4, 2026". */
function formatLabel(d: Date): string {
  const month = MONTHS[d.getMonth()].slice(0, 3);
  return `${month} ${d.getDate()}, ${d.getFullYear()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DatePicker({
  value,
  onChange,
  id,
  name,
  placeholder,
  defaultValue = "",
  mode = "date",
  ariaLabel,
  allowedMonths,
  today: referenceDay,
  min,
  max,
  disabled,
  clearable = true,
}: DatePickerProps) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const current = value ?? localValue;
  const monthOnly = mode === "month";
  const timeOnly = mode === "time";
  const withTime = timeOnly || mode === "datetime";
  const currentDate = monthOnly ? current + "-01" : current.split("T")[0];
  const currentTime = (timeOnly ? current : current.split("T")[1] || "").slice(0, 5);
  const selected = useMemo(() => timeOnly ? null : parseISO(currentDate), [currentDate, timeOnly]);
  const valid = (choice: string) => (!min || choice >= min) && (!max || choice <= max)
    && (!monthOnly || !allowedMonths || allowedMonths.includes(choice));
  const [open, setOpen] = useDisclosure(false);
  const [viewDate, setViewDate] = useState<Date>(() => selected ?? new Date());
  const [draftDate, setDraftDate] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const popover = useRef<HTMLDivElement | null>(null);
  const today = parseISO(referenceDay) ?? new Date();
  const todayChoice = monthOnly ? toISO(today).slice(0, 7) : toISO(today);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function change(choice: string) {
    if (value === undefined) setLocalValue(choice);
    onChange?.(choice);
    close();
  }

  function toggle() {
    if (open) { close(); return; }
    const bound = min && todayChoice < min ? min : max && todayChoice > max ? max : undefined;
    setViewDate(selected ?? parseISO(bound && (monthOnly ? bound + "-01" : bound.slice(0, 10))) ?? today);
    setDraftDate(selected ? toISO(selected) : "");
    setDraftTime(currentTime);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const panel = popover.current;
    const button = trigger.current;
    if (!panel || !button) return;
    const cleanup = positionPopover(panel, button, { width: timeOnly ? 248 : 288 });
    function handlePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey, true);
    return () => {
      cleanup();
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey, true);
    };
  }, [open, timeOnly]);

  const grid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length < 42) cells.push(null); // 6 rows x 7
    return cells;
  }, [viewDate]);

  const commit = (date: Date) => {
    const choice = monthOnly ? toISO(date).slice(0, 7) : toISO(date);
    if (mode === "datetime") setDraftDate(choice);
    else if (valid(choice)) change(choice);
  };
  function viewAfter(delta: number) {
    return new Date(viewDate.getFullYear(), viewDate.getMonth() + delta * (monthOnly ? 12 : 1), 1);
  }
  function canNavigate(delta: number) {
    const next = viewAfter(delta);
    const first = monthOnly ? toISO(next).slice(0, 4) + "-01" : toISO(next);
    const last = monthOnly ? toISO(next).slice(0, 4) + "-12"
      : toISO(new Date(next.getFullYear(), next.getMonth() + 1, 0));
    return next.getFullYear() >= 100 && next.getFullYear() <= 9999
      && (!min || last >= min.slice(0, last.length)) && (!max || first <= max.slice(0, first.length));
  }
  const [hour, minute = ""] = draftTime.split(":");
  const updateTime = (part: "hour" | "minute", text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 2);
    setDraftTime(part === "hour" ? `${digits}:${minute}` : `${hour}:${digits}`);
  };
  const formatTime = (value: string) => value.padStart(2, "0");
  const timeValue = `${formatTime(hour)}:${formatTime(minute)}`;
  const timeChoice = timeOnly ? timeValue : `${draftDate}T${timeValue}`;
  const canApply = !!hour && !!minute && Number(hour) < 24 && Number(minute) < 60
    && (timeOnly || !!draftDate) && valid(timeChoice);
  const validDay = (choice: string) => mode === "datetime"
    ? (!min || choice >= min.slice(0, 10)) && (!max || choice <= max.slice(0, 10))
    : valid(choice);
  const dateLabel = selected ? monthOnly ? `${MONTHS[selected.getMonth()]} ${selected.getFullYear()}` : formatLabel(selected) : "";
  const label = withTime ? (timeOnly ? currentTime : [dateLabel, currentTime].filter(Boolean).join(" · ")) : dateLabel;
  const dialogLabel = timeOnly ? "Choose time" : mode === "datetime" ? "Choose date and time" : monthOnly ? "Choose month" : "Choose date";

  return (
    <div className="dp-root" ref={rootRef}>
      <button
        type="button"
        id={id}
        ref={trigger}
        disabled={disabled}
        className="dp-trigger"
        aria-label={ariaLabel ? label ? `${ariaLabel}, ${label}` : ariaLabel : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="dp-cal-icon" aria-hidden="true">
          {timeOnly ? <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg> : <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>}
        </span>
        <span className={label ? "dp-value" : "dp-value dp-placeholder"}>
          {label || placeholder || (timeOnly ? "Select a time" : monthOnly ? "Select a month" : mode === "datetime" ? "Select date and time" : "Select a date")}
        </span>
        <span className={open ? "dp-caret dp-caret-open" : "dp-caret"} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {name ? <input type="hidden" name={name} value={current} disabled={disabled} /> : null}

      {open && (
        <div className="dp-pop" popover="manual" ref={popover} role="dialog" aria-label={dialogLabel}>
          {!timeOnly && <>
          <div className="dp-head">
            <button
              type="button"
              className="dp-nav"
              aria-label={monthOnly ? "Previous year" : "Previous month"}
              disabled={!canNavigate(-1)}
              onClick={() => setViewDate(viewAfter(-1))}
            >
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="dp-title">
              {!monthOnly && MONTHS[viewDate.getMonth()] + " "}{viewDate.getFullYear()}
            </div>
            <button
              type="button"
              className="dp-nav"
              aria-label={monthOnly ? "Next year" : "Next month"}
              disabled={!canNavigate(1)}
              onClick={() => setViewDate(viewAfter(1))}
            >
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {monthOnly ? <div className="dp-month-grid">
            {MONTHS.map((month, index) => {
              const date = new Date(viewDate.getFullYear(), index, 1);
              const choice = toISO(date).slice(0, 7);
              return <button key={month} type="button" className={choice === current ? "dp-day dp-selected" : "dp-day"}
                aria-pressed={choice === current} disabled={!valid(choice)} onClick={() => commit(date)}>{month.slice(0, 3)}</button>;
            })}
          </div> : <>
          <div className="dp-weekdays">
            {WEEKDAYS.map((w) => (
              <span key={w} className="dp-weekday">
                {w}
              </span>
            ))}
          </div>

          <div className="dp-grid">
            {grid.map((cell, i) => {
              if (!cell) return <span key={`b-${i}`} className="dp-blank" />;
              const isToday = isSameDay(cell, today);
              const choice = toISO(cell);
              const isSelected = mode === "datetime" ? choice === draftDate : choice === currentDate;
              const cls = [
                "dp-day",
                isToday ? "dp-today" : "",
                isSelected ? "dp-selected" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={toISO(cell)}
                  type="button"
                  className={cls}
                  aria-pressed={isSelected}
                  disabled={!validDay(choice)}
                  onClick={() => commit(cell)}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>

          </>}
          </>}
          {withTime && <div className="dp-time" onKeyDown={event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (canApply) change(timeChoice);
          }}>
            <span>24-hour time</span>
            <div>
              <input aria-label="Hours" inputMode="numeric" value={hour} placeholder="HH" onChange={event => updateTime("hour", event.target.value)} />
              <span aria-hidden="true">:</span>
              <input aria-label="Minutes" inputMode="numeric" value={minute} placeholder="MM" onChange={event => updateTime("minute", event.target.value)} />
            </div>
          </div>}
          <div className="dp-foot">
            {!timeOnly && <button type="button" className="dp-foot-btn" disabled={!validDay(todayChoice)}
              onClick={() => {
                setViewDate(today);
                commit(today);
              }}>{monthOnly ? "This month" : "Today"}</button>}
            {clearable && <button type="button" className="dp-foot-btn" onClick={() => change("")}>Clear</button>}
            {withTime && <button type="button" className="dp-foot-btn dp-apply" disabled={!canApply}
              onClick={() => change(timeChoice)}>Apply</button>}
          </div>
        </div>
      )}

      <style jsx>{`
        .dp-root {
          position: relative;
          display: inline-block;
          width: 100%;
          font-family: var(--font, system-ui, sans-serif);
        }
        .dp-trigger {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 11px;
          border: 1px solid var(--line-2);
          background: var(--panel);
          color: var(--ink);
          font-size: 14px;
          cursor: pointer;
          text-align: left;
          transition: border-color 0.25s var(--ease), box-shadow 0.25s var(--ease),
            background 0.25s var(--ease);
        }
        .dp-trigger:hover {
          border-color: var(--blue-400);
        }
        .dp-trigger:focus-visible {
          outline: none;
          border-color: var(--blue-500);
          box-shadow: 0 0 0 3px rgba(62, 96, 171, 0.18);
        }
        .dp-cal-icon {
          display: inline-flex;
          color: var(--blue-500);
        }
        .dp-value {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dp-placeholder {
          color: var(--muted-2);
        }
        .dp-caret {
          display: inline-flex;
          color: var(--muted);
          transition: transform 0.25s var(--ease);
        }
        .dp-caret-open {
          transform: rotate(180deg);
        }
        .dp-pop {
          position: fixed;
          inset: auto;
          margin: 0;
          overflow: auto;
          box-sizing: border-box;
          z-index: 1000;
          width: min(288px, calc(100vw - 32px));
          padding: 14px;
          border-radius: 14px;
          background: var(--panel);
          border: 1px solid var(--line-2);
          box-shadow: 0 24px 50px -20px rgba(23, 43, 92, 0.4),
            0 0 0 1px rgba(16, 30, 60, 0.03);
          animation: dpIn 0.16s var(--ease);
        }
        .dp-month-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
        .dp-month-grid .dp-day { aspect-ratio: auto; min-height: 38px; }
        button:disabled { opacity: .45; cursor: default; }
        @keyframes dpIn {
          from {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .dp-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .dp-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
        }
        .dp-nav {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border-radius: 9px;
          border: 1px solid var(--line);
          background: var(--panel-2);
          color: var(--muted);
          cursor: pointer;
          transition: background 0.2s var(--ease), color 0.2s var(--ease),
            border-color 0.2s var(--ease);
        }
        .dp-nav:hover {
          background: var(--bg-2);
          color: var(--blue-600);
          border-color: var(--blue-400);
        }
        .dp-nav:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(62, 96, 171, 0.2);
        }
        .dp-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          margin-bottom: 4px;
        }
        .dp-weekday {
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: var(--muted-2);
          padding: 4px 0;
        }
        .dp-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }
        .dp-blank {
          aspect-ratio: 1 / 1;
        }
        .dp-day {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          aspect-ratio: 1 / 1;
          border: none;
          border-radius: 9px;
          background: transparent;
          color: var(--ink);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.18s var(--ease), color 0.18s var(--ease),
            box-shadow 0.18s var(--ease);
        }
        .dp-day:hover {
          background: var(--bg-2);
        }
        .dp-day:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(62, 96, 171, 0.22);
        }
        .dp-today {
          box-shadow: inset 0 0 0 1.5px var(--blue-400);
          font-weight: 600;
        }
        .dp-selected {
          background: var(--blue-500);
          color: #fff;
          font-weight: 600;
        }
        .dp-selected:hover {
          background: var(--blue-600);
        }
        .dp-selected.dp-today {
          box-shadow: inset 0 0 0 1.5px rgba(255, 255, 255, 0.7);
        }
        .dp-time { display: grid; gap: 6px; margin-top: 10px; color: var(--muted); font-size: 13px; }
        .dp-time > div { display: flex; align-items: center; gap: 8px; }
        .dp-time input {
          width: 52px;
          min-width: 0;
          padding: 7px;
          border: 1px solid var(--line-2);
          border-radius: 8px;
          background: var(--panel);
          color: var(--ink);
          text-align: center;
          font: inherit;
          font-size: 16px;
        }
        .dp-foot {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--line);
        }
        .dp-foot-btn {
          border: none;
          background: transparent;
          color: var(--blue-600);
          font-size: 13px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.18s var(--ease), color 0.18s var(--ease);
        }
        .dp-foot-btn:hover {
          background: var(--bg-2);
        }
        .dp-foot-btn.dp-apply { margin-left: auto; color: #fff; background: var(--blue-500); }
        .dp-foot-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(62, 96, 171, 0.2);
        }
      `}</style>
    </div>
  );
}
