"use client";
import { useState } from "react";

/* Renders a client logo image; if the image is missing or fails to load,
   it falls back to the brand name so a card is never left blank. */
export default function LogoMark({ name, image }: { name: string; image?: string }) {
  const [broken, setBroken] = useState(false);
  if (image && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="logo-img" src={image} alt={name} loading="lazy" onError={() => setBroken(true)} />;
  }
  return <span className="logo-name">{name || "—"}</span>;
}
