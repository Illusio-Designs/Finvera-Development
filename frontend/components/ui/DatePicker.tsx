"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface DatePickerProps {
  value?: string;
  onChange?: (v: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
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
  const y = d.getFullYear();
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
  placeholder = "Select a date",
}: DatePickerProps) {
  const selected = useMemo(() => parseISO(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => selected ?? new Date());
  const rootRef = useRef<HTMLDivElement | null>(null);

  // When the popover opens, sync the visible month to the selected date.
  useEffect(() => {
    if (open) {
      setViewDate(selected ?? new Date());
    }
  }, [open, selected]);

  // Close on outside mousedown / Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const today = useMemo(() => new Date(), []);

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

  const commit = (d: Date) => {
    onChange?.(toISO(d));
    setOpen(false);
  };

  const goMonth = (delta: number) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const handleButtonKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  return (
    <div className="dp-root" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="dp-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleButtonKey}
      >
        <span className="dp-cal-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9h18" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
        <span className={selected ? "dp-value" : "dp-value dp-placeholder"}>
          {selected ? formatLabel(selected) : placeholder}
        </span>
        <span className={open ? "dp-caret dp-caret-open" : "dp-caret"} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}

      {open && (
        <div className="dp-pop" role="dialog" aria-label="Choose date">
          <div className="dp-head">
            <button
              type="button"
              className="dp-nav"
              aria-label="Previous month"
              onClick={() => goMonth(-1)}
            >
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="dp-title">
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </div>
            <button
              type="button"
              className="dp-nav"
              aria-label="Next month"
              onClick={() => goMonth(1)}
            >
              <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

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
              const isSelected = selected ? isSameDay(cell, selected) : false;
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
                  onClick={() => commit(cell)}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>

          <div className="dp-foot">
            <button
              type="button"
              className="dp-foot-btn"
              onClick={() => commit(new Date())}
            >
              Today
            </button>
            <button
              type="button"
              className="dp-foot-btn"
              onClick={() => {
                onChange?.("");
                setOpen(false);
              }}
            >
              Clear
            </button>
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
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          z-index: 1000;
          width: 288px;
          padding: 14px;
          border-radius: 14px;
          background: var(--panel);
          border: 1px solid var(--line-2);
          box-shadow: 0 24px 50px -20px rgba(23, 43, 92, 0.4),
            0 0 0 1px rgba(16, 30, 60, 0.03);
          animation: dpIn 0.16s var(--ease);
        }
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
        .dp-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
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
        .dp-foot-btn:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(62, 96, 171, 0.2);
        }
      `}</style>
    </div>
  );
}
