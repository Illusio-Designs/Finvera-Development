"use client";
import { useEffect, useState } from "react";
import { Arrow } from "./icons";
import PhoneInput from "./PhoneInput";
import Toaster from "./admin/Toaster";
import { toast } from "@/lib/toast";

const endpoint = `${(process.env.NEXT_PUBLIC_API_URL || "https://api.finvera.solutions").replace(/\/$/, "")}/api/contact`;

/**
 * Site-wide slide-in aside panel for a quick enquiry. Available on every page:
 * a floating trigger button opens the panel; also opens for any element with a
 * [data-consult] attribute (e.g. "Book a consultation" CTAs). Includes toast
 * feedback + a success check micro-animation.
 */
export default function ConsultPanel() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement)?.closest("[data-consult]");
      if (t) { e.preventDefault(); setOpen(true); }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", open);
    return () => document.body.classList.remove("no-scroll");
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setSending(true);
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Please try again.");
      form.reset(); setDone(true); toast("Thanks! We'll be in touch shortly. 🎉");
      setTimeout(() => { setDone(false); setOpen(false); }, 1900);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong.", "err");
    } finally { setSending(false); }
  }

  return (
    <>
      <button className="consult-fab" onClick={() => setOpen(true)} data-tip="Let's talk" data-tip-pos="right" aria-label="Quick enquiry">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z" /></svg>
      </button>

      <div className={"consult-scrim" + (open ? " show" : "")} onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }} aria-hidden={!open}>
        <aside className={"consult-panel" + (open ? " open" : "")} role="dialog" aria-label="Quick enquiry" aria-modal="true">
          <button className="consult-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          {done ? (
            <div className="consult-done">
              <div className="success-check"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></div>
              <h3>Message sent!</h3>
              <p>We&apos;ll get back to you within one business day.</p>
            </div>
          ) : (
            <>
              <span className="eyebrow">Quick enquiry</span>
              <h3>Let&apos;s build something great</h3>
              <p className="consult-sub">Tell us about your project — we reply within a day.</p>
              <form onSubmit={onSubmit}>
                <div className="field"><label htmlFor="c_name">Name *</label><input id="c_name" name="name" required placeholder="Jane Doe" /></div>
                <div className="field"><label htmlFor="c_email">Email *</label><input id="c_email" name="email" type="email" required placeholder="jane@company.com" /></div>
                <div className="field"><label>Phone</label><PhoneInput name="phone" /></div>
                <div className="field"><label htmlFor="c_msg">Project details *</label><textarea id="c_msg" name="message" required placeholder="What are you building?" /></div>
                <button type="submit" className="btn btn-primary" disabled={sending} style={{ width: "100%", justifyContent: "center" }}>
                  {sending ? "Sending…" : "Send message"} <Arrow />
                </button>
              </form>
            </>
          )}
        </aside>
      </div>
      <Toaster />
    </>
  );
}
