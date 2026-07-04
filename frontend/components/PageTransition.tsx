"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * PageTransition
 *
 * A route-change transition overlay. On each pathname change it sweeps a
 * brand-gradient panel up from the bottom to fully cover the viewport, then
 * continues upward to reveal the new page (~600ms total). The Finvera logo
 * mark rides in the center of the panel.
 *
 * - Never blocks clicks (pointer-events: none on the overlay).
 * - Skips the animation on the very first mount to avoid a wipe on initial load.
 * - Respects prefers-reduced-motion by rendering nothing / skipping animation.
 */
export default function PageTransition(): React.ReactElement | null {
  const pathname = usePathname();
  const mountedRef = useRef(false);
  const [animKey, setAnimKey] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Determine reduced-motion preference on the client.
    if (typeof window !== "undefined") {
      setReduceMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      );
    }
  }, []);

  useEffect(() => {
    // Skip the very first mount so there is no wipe on initial load.
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Bump the key to (re)trigger the CSS keyframe animation.
    setAnimKey((k) => k + 1);
  }, [pathname]);

  // Nothing to render before the first transition, or under reduced-motion.
  if (reduceMotion || animKey === 0) {
    return null;
  }

  return (
    <div
      key={animKey}
      className="page-transition"
      aria-hidden="true"
      role="presentation"
    >
      <div className="page-transition__mark">
        <svg viewBox="0 0 500 500" width="60">
          <use href="#finmark" />
        </svg>
      </div>

      <style jsx>{`
        .page-transition {
          position: fixed;
          inset: 0;
          z-index: 9999;
          pointer-events: none;
          background: var(--grad);
          display: flex;
          align-items: center;
          justify-content: center;
          transform: translateY(100%);
          will-change: transform;
          animation: page-wipe 600ms var(--ease, cubic-bezier(0.65, 0, 0.35, 1))
            forwards;
        }

        .page-transition__mark {
          opacity: 0;
          transform: scale(0.92);
          animation: page-wipe-mark 600ms
            var(--ease, cubic-bezier(0.65, 0, 0.35, 1)) forwards;
        }

        .page-transition__mark :global(svg use),
        .page-transition__mark :global(svg path) {
          fill: #fff;
        }

        @keyframes page-wipe {
          0% {
            transform: translateY(100%);
          }
          50% {
            transform: translateY(0%);
          }
          100% {
            transform: translateY(-100%);
          }
        }

        @keyframes page-wipe-mark {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
          60% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.04);
          }
        }
      `}</style>
    </div>
  );
}
