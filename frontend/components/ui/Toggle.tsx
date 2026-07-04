"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <span className="tg-root">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={checked ? "tg-track tg-on" : "tg-track"}
        onClick={() => onChange(!checked)}
      >
        <span className="tg-knob" aria-hidden="true" />
      </button>
      {label ? <span className="tg-label">{label}</span> : null}

      <style jsx>{`
        .tg-root {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font, system-ui, sans-serif);
        }
        .tg-track {
          position: relative;
          flex: 0 0 auto;
          width: 44px;
          height: 26px;
          padding: 0;
          border: none;
          border-radius: 999px;
          background: var(--line-2);
          cursor: pointer;
          transition: background 0.28s var(--ease), box-shadow 0.2s var(--ease);
        }
        .tg-track:hover {
          background: rgba(16, 30, 60, 0.24);
        }
        .tg-on {
          background: var(--grad);
        }
        .tg-on:hover {
          background: var(--grad);
          filter: brightness(1.03);
        }
        .tg-track:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(62, 96, 171, 0.3);
        }
        .tg-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 5px -1px rgba(16, 26, 48, 0.4);
          transition: transform 0.28s var(--ease);
        }
        .tg-on .tg-knob {
          transform: translateX(18px);
        }
        .tg-label {
          font-size: 14px;
          color: var(--ink);
          user-select: none;
        }
      `}</style>
    </span>
  );
}
