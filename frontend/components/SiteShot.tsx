"use client";
import { useState } from "react";

/**
 * Renders a live screenshot of an external site inside a device frame.
 * Screenshots are generated on-demand by thum.io (with a WordPress mShots
 * fallback) so they stay current. The build environment can't reach these
 * domains, but the deployed site can.
 */
export default function SiteShot({ url, kind, alt }: { url: string; kind: "desktop" | "mobile"; alt: string }) {
  const clean = url.replace(/\/$/, "");
  const primary =
    kind === "mobile"
      ? `https://image.thum.io/get/viewportWidth/400/width/520/crop/1100/noanimate/${clean}`
      : `https://image.thum.io/get/viewportWidth/1280/width/1280/crop/800/noanimate/${clean}`;
  const fallback = `https://s0.wp.com/mshots/v1/${encodeURIComponent(clean)}?w=${kind === "mobile" ? 520 : 1280}`;

  const [src, setSrc] = useState(primary);
  const [ready, setReady] = useState(false);

  return (
    <div className="shot-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={"shot" + (ready ? " ready" : "")}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setReady(true)}
        onError={() => { if (src !== fallback) { setReady(false); setSrc(fallback); } }}
      />
    </div>
  );
}
