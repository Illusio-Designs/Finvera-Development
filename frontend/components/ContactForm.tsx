"use client";
import { useState } from "react";
import { Arrow, Check } from "./icons";
import PhoneInput from "./PhoneInput";
import Select from "./Select";
import { toast } from "@/lib/toast";

const PROJECT_TYPES = ["SaaS platform", "CRM system", "Cloud & DevOps", "AI & automation", "Something else"];

const endpoint = `${(process.env.NEXT_PUBLIC_API_URL || "https://api.finvera.solutions").replace(/\/$/, "")}/api/contact`;

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const [bad, setBad] = useState<Record<string, string>>({});
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
  const clr = (k: string) => setBad((b) => (b[k] ? (() => { const n = { ...b }; delete n[k]; return n; })() : b));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;

    // Custom validation (native bubbles suppressed via noValidate)
    const errs: Record<string, string> = {};
    if (!data.name?.trim()) errs.name = "Please tell us your name.";
    if (!data.email?.trim()) errs.email = "We need an email to reply.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = "That email doesn't look right.";
    if (!data.message?.trim()) errs.message = "A few details help us prepare.";
    setBad(errs);
    if (Object.keys(errs).length) {
      const first = form.querySelector(`[name="${Object.keys(errs)[0]}"]`) as HTMLElement | null;
      first?.focus();
      toast("Please check the highlighted fields.", "err");
      return;
    }

    setState("sending"); setError("");
    try {
      if (endpoint) {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || "Something went wrong. Please try again.");
        }
      } else {
        // No backend configured yet — simulate success (demo mode)
        await new Promise((r) => setTimeout(r, 500));
      }
      setState("ok");
      form.reset();
      setProjectType(PROJECT_TYPES[0]);
      toast("Message sent — we'll be in touch shortly! 🎉");
    } catch (err) {
      setState("error");
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      toast(msg, "err");
    }
  }

  return (
    <form id="contactForm" onSubmit={onSubmit} noValidate>
      <div className="field row">
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor="name">Full name *</label>
          <input id="name" name="name" placeholder="Jane Doe"
            className={bad.name ? "invalid" : ""} aria-invalid={!!bad.name}
            onChange={() => clr("name")} />
          {bad.name && <span className="field-err">{bad.name}</span>}
        </div>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor="email">Work email *</label>
          <input id="email" name="email" type="email" placeholder="jane@company.com"
            className={bad.email ? "invalid" : ""} aria-invalid={!!bad.email}
            onChange={() => clr("email")} />
          {bad.email && <span className="field-err">{bad.email}</span>}
        </div>
      </div>
      <div className="field row">
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor="company">Company</label>
          <input id="company" name="company" placeholder="Acme Inc." />
        </div>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label>Phone</label>
          <PhoneInput name="phone" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="projectType">Project type</label>
        <Select id="projectType" name="projectType" value={projectType} onChange={setProjectType}
          options={PROJECT_TYPES} ariaLabel="Project type" />
      </div>
      <div className="field">
        <label htmlFor="message">Project details *</label>
        <textarea id="message" name="message" placeholder="Tell us what you're building, timeline and goals..."
          className={bad.message ? "invalid" : ""} aria-invalid={!!bad.message}
          onChange={() => clr("message")} />
        {bad.message && <span className="field-err">{bad.message}</span>}
      </div>
      <button type="submit" className="btn btn-primary" data-cursor data-magnetic
        disabled={state === "sending"} style={{ width: "100%", justifyContent: "center", opacity: state === "sending" ? 0.7 : 1 }}>
        {state === "sending" ? "Sending…" : "Send message"} <Arrow />
      </button>
      <p className="form-note">By submitting, you agree to our privacy policy.</p>
      {state === "ok" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.35)", color: "#15803d", fontSize: 14, fontWeight: 500 }}>
          <Check width={18} /> Thanks! Your message has been received — we&apos;ll be in touch shortly.
        </div>
      )}
      {state === "error" && (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.35)", color: "#dc2626", fontSize: 14, fontWeight: 500 }}>
          {error}
        </div>
      )}
    </form>
  );
}
