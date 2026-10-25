"use client";
import { useEffect, useState } from "react";
import { dialog } from "@/lib/dialog";

/* "Install app" in the sidebar. Android/desktop Chrome & Edge get the
   browser's own install prompt; iPhone/iPad (Safari has no prompt) get the
   two-step instructions. Hidden once the app is already installed. */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallApp({ className = "" }: { className?: string }) {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1));
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as PromptEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  if (installed || (!evt && !ios)) return null;

  const install = async () => {
    if (evt) {
      await evt.prompt();
      const { outcome } = await evt.userChoice;
      if (outcome === "accepted") setEvt(null);
      return;
    }
    await dialog.alert({
      title: "Add Finvera to your Home Screen",
      message: "1. Tap the Share button in Safari (the square with an arrow).\n2. Scroll down and tap “Add to Home Screen”, then “Add”.\n\nFinvera then opens full screen from its own icon, like an app.",
      confirmText: "Got it",
    });
  };

  return (
    <button type="button" className={"adm-install " + className} onClick={install} data-tip="Install app" data-tip-pos="right">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M12 7v7M9 11l3 3 3-3M10 18h4" />
      </svg>
      <span className="adm-lbl">Install app</span>
    </button>
  );
}
