"use client";
import { useState } from "react";

/* Fades the screenshot in only once it has fully decoded — avoids the
   "half-loaded / cut image then full image" flash during progressive load. */
export default function ProjectShot({ src, alt }: { src: string; alt: string }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="shot-wrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={"shot" + (ready ? " ready" : "")}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
      />
    </div>
  );
}
