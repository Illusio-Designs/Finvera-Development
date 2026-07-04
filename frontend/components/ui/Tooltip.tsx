"use client";

import type { ReactNode } from "react";

interface TooltipProps {
  label: string;
  children: ReactNode;
  pos?: "top" | "bottom" | "left" | "right";
}

export default function Tooltip({ label, children, pos = "top" }: TooltipProps) {
  return (
    <span className={`tt-root tt-${pos}`} tabIndex={0}>
      {children}
      <span className="tt-bubble" role="tooltip" aria-label={label}>
        {label}
        <span className="tt-arrow" aria-hidden="true" />
      </span>

      <style jsx>{`
        .tt-root {
          position: relative;
          display: inline-flex;
          align-items: center;
          outline: none;
          font-family: var(--font, system-ui, sans-serif);
        }
        .tt-bubble {
          position: absolute;
          z-index: 1100;
          pointer-events: none;
          white-space: nowrap;
          max-width: 220px;
          padding: 6px 9px;
          border-radius: 8px;
          background: #101a30;
          color: #fff;
          font-size: 12px;
          line-height: 1.35;
          font-weight: 500;
          box-shadow: 0 10px 24px -10px rgba(16, 26, 48, 0.7);
          opacity: 0;
          visibility: hidden;
          transform: scale(0.94);
          transition: opacity 0.16s var(--ease), transform 0.16s var(--ease),
            visibility 0.16s var(--ease);
        }
        .tt-root:hover .tt-bubble,
        .tt-root:focus-within .tt-bubble {
          opacity: 1;
          visibility: visible;
          transform: scale(1);
        }
        .tt-arrow {
          position: absolute;
          width: 8px;
          height: 8px;
          background: #101a30;
          transform: rotate(45deg);
        }

        /* top */
        .tt-top .tt-bubble {
          bottom: calc(100% + 8px);
          left: 50%;
          transform-origin: bottom center;
          transform: translateX(-50%) scale(0.94);
        }
        .tt-top:hover .tt-bubble,
        .tt-top:focus-within .tt-bubble {
          transform: translateX(-50%) scale(1);
        }
        .tt-top .tt-arrow {
          bottom: -4px;
          left: 50%;
          margin-left: -4px;
        }

        /* bottom */
        .tt-bottom .tt-bubble {
          top: calc(100% + 8px);
          left: 50%;
          transform-origin: top center;
          transform: translateX(-50%) scale(0.94);
        }
        .tt-bottom:hover .tt-bubble,
        .tt-bottom:focus-within .tt-bubble {
          transform: translateX(-50%) scale(1);
        }
        .tt-bottom .tt-arrow {
          top: -4px;
          left: 50%;
          margin-left: -4px;
        }

        /* left */
        .tt-left .tt-bubble {
          right: calc(100% + 8px);
          top: 50%;
          transform-origin: right center;
          transform: translateY(-50%) scale(0.94);
        }
        .tt-left:hover .tt-bubble,
        .tt-left:focus-within .tt-bubble {
          transform: translateY(-50%) scale(1);
        }
        .tt-left .tt-arrow {
          right: -4px;
          top: 50%;
          margin-top: -4px;
        }

        /* right */
        .tt-right .tt-bubble {
          left: calc(100% + 8px);
          top: 50%;
          transform-origin: left center;
          transform: translateY(-50%) scale(0.94);
        }
        .tt-right:hover .tt-bubble,
        .tt-right:focus-within .tt-bubble {
          transform: translateY(-50%) scale(1);
        }
        .tt-right .tt-arrow {
          left: -4px;
          top: 50%;
          margin-top: -4px;
        }
      `}</style>
    </span>
  );
}
