"use client";
import { useState } from "react";
import { logoImage } from "@/lib/logoPresentation";

/* A failed image falls back to the company name. A replacement gets a fresh try. */
export default function LogoMark({ name, image }: { name: string; image?: string }) {
  const [failedSource, setFailedSource] = useState("");
  const source = logoImage(image);
  if (source && failedSource !== source) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img key={source} className="logo-img" src={source} alt={name} loading="lazy" onError={() => setFailedSource(source)} />;
  }
  return <span className="logo-name">{name || "—"}</span>;
}
