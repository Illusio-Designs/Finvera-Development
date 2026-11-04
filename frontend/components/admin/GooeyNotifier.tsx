"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GooeyToaster, gooeyToast } from "goey-toast";
import "goey-toast/styles.css";
import type { ToastDetail } from "@/lib/toast";
import { playSound } from "@/lib/sound";

/* Dashboard toaster: shows every toast() as a gooey toast, with a sound.
   (The public site keeps the plain <Toaster/>.) */
export default function GooeyNotifier() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<ToastDetail>).detail;
      const show = d.type === "err" ? gooeyToast.error : d.type === "warn" ? gooeyToast.warning : d.type === "info" ? gooeyToast.info : gooeyToast.success;
      show(d.message, {
        description: d.description,
        action: d.action,
        duration: d.duration ?? (d.type === "err" ? 6000 : 4000),
      });
      if (d.sound !== false) playSound(d.type === "err" || d.type === "warn" ? "error" : d.type === "info" ? "notify" : "success");
    };
    window.addEventListener("fv-toast", onToast);
    return () => window.removeEventListener("fv-toast", onToast);
  }, []);

  if (!mounted) return null;
  // Escape dashboard stacking contexts so drawer overlays cannot cover errors.
  return createPortal(
    <div data-dashboard-notifications style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}>
      <GooeyToaster position="bottom-right" preset="smooth" closeButton="top-right" showProgress visibleToasts={4} />
    </div>, document.body,
  );
}
