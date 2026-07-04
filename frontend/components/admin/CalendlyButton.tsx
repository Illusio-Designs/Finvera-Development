"use client";
import { useEffect } from "react";

/* Opens a Calendly scheduling popup (loads the official widget on demand). */
export default function CalendlyButton({ url, name, email }: { url?: string; name?: string; email?: string }) {
  useEffect(() => {
    if (document.getElementById("calendly-widget-js")) return;
    const s = document.createElement("script");
    s.id = "calendly-widget-js";
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://assets.calendly.com/assets/external/widget.css";
    document.head.appendChild(l);
  }, []);

  const target = url && url.trim() ? url.trim() : "https://calendly.com/";
  const withPrefill = () => {
    const p = new URLSearchParams();
    if (name) p.set("name", name);
    if (email) p.set("email", email);
    const q = p.toString();
    return q ? `${target}${target.includes("?") ? "&" : "?"}${q}` : target;
  };
  const open = () => {
    const C = (window as unknown as { Calendly?: { initPopupWidget: (o: { url: string }) => void } }).Calendly;
    if (C?.initPopupWidget) C.initPopupWidget({ url: withPrefill() });
    else window.open(withPrefill(), "_blank", "noopener");
  };

  return (
    <button type="button" className="adm-btn primary" onClick={open} style={{ width: "fit-content" }}>
      <svg viewBox="0 0 24 24" width={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 15h.01M12 15h.01M16 15h.01" /></svg>
      Schedule meeting
    </button>
  );
}
