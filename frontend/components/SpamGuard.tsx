"use client";
import { captchaTransition, type CaptchaState } from "@/lib/enquiryMachine";
/* Spam guard for the public enquiry forms.
   • Two honeypot inputs (`website`, `company_url`) that people never see or
     reach; bots that fill every field get a fake "thanks" from the server.
   • `startedAt`: when the form was shown (sent too fast = a bot).
   • Cloudflare Turnstile, only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
   Usage: const guard = useSpamGuard(); render {guard.fields} inside the form,
   spread guard.extra() into the JSON body, call guard.reset() after sending. */
import { useCallback, useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT; s.async = true; s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("captcha script failed")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

/* Off-screen, not display:none (some bots skip hidden inputs). */
const HIDE: React.CSSProperties = { position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden", opacity: 0, pointerEvents: "none" };

export function useSpamGuard() {
  const startedAt = useRef<number>(0);
  const captcha = useRef<CaptchaState>({ phase: "empty", token: "" });
  const widget = useRef<string | null>(null);
  // A callback ref: the form can unmount and come back (e.g. the quick-enquiry
  // panel after a send), and each new box gets its own widget.
  const [box, setBox] = useState<HTMLDivElement | null>(null);

  useEffect(() => { startedAt.current = Date.now(); }, []);

  useEffect(() => {
    if (!SITE_KEY || !box) return;
    let alive = true;
    captcha.current = captchaTransition(captcha.current, { type: "LOAD" });
    loadScript().then(() => {
      if (!alive || !window.turnstile) return;
      captcha.current = captchaTransition(captcha.current, { type: "RESET" });
      widget.current = window.turnstile.render(box, {
        sitekey: SITE_KEY,
        callback: (t: string) => { captcha.current = captchaTransition(captcha.current, { type: "TOKEN", token: t }); },
        "expired-callback": () => { captcha.current = captchaTransition(captcha.current, { type: "EXPIRE" }); },
        "error-callback": () => { captcha.current = captchaTransition(captcha.current, { type: "ERROR" }); },
      });
    }).catch(() => { /* the server answers "please complete the security check" */ });
    return () => {
      alive = false;
      if (widget.current && window.turnstile) { try { window.turnstile.remove(widget.current); } catch { /* gone */ } }
      widget.current = null;
      captcha.current = captchaTransition(captcha.current, { type: "REMOVE" });
    };
  }, [box]);

  const extra = useCallback((): Record<string, string | number> => {
    const out: Record<string, string | number> = { startedAt: startedAt.current || Date.now() };
    if (SITE_KEY) out.turnstileToken = captcha.current.token;
    return out;
  }, []);

  /** After a send (or when a panel re-opens): new start time and a fresh captcha. */
  const reset = useCallback(() => {
    startedAt.current = Date.now();
    if (SITE_KEY && widget.current && window.turnstile) { captcha.current = captchaTransition(captcha.current, { type: "RESET" }); try { window.turnstile.reset(widget.current); } catch { /* ignore */ } }
  }, []);

  const fields = (
    <>
      <div aria-hidden="true" style={HIDE}>
        <label>Leave this empty<input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
        <label>Leave this empty<input type="text" name="company_url" tabIndex={-1} autoComplete="off" defaultValue="" /></label>
      </div>
      {SITE_KEY && <div ref={setBox} className="turnstile-box" style={{ margin: "4px 0 14px", minHeight: 65 }} />}
    </>
  );

  return { fields, extra, reset };
}
