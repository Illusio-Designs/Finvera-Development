"use client";
import { useState } from "react";
import { Arrow, Check } from "./icons";

const endpoint = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/api/contact`
  : "";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
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
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form id="contactForm" onSubmit={onSubmit}>
      <div className="field row">
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor="name">Full name *</label>
          <input id="name" name="name" required placeholder="Jane Doe" />
        </div>
        <div className="field" style={{ margin: 0, flex: 1 }}>
          <label htmlFor="email">Work email *</label>
          <input id="email" name="email" type="email" required placeholder="jane@company.com" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" placeholder="Acme Inc." />
      </div>
      <div className="field">
        <label htmlFor="projectType">Project type</label>
        <select id="projectType" name="projectType">
          <option>SaaS platform</option>
          <option>CRM system</option>
          <option>Cloud &amp; DevOps</option>
          <option>AI &amp; automation</option>
          <option>Something else</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="message">Project details *</label>
        <textarea id="message" name="message" required placeholder="Tell us what you're building, timeline and goals..." />
      </div>
      <button type="submit" className="btn btn-primary" data-cursor data-magnetic
        disabled={state === "sending"} style={{ width: "100%", justifyContent: "center", opacity: state === "sending" ? 0.7 : 1 }}>
        {state === "sending" ? "Sending…" : "Send message"} <Arrow />
      </button>
      <p className="form-note">By submitting, you agree to our privacy policy.</p>
      {state === "ok" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(40,200,64,.12)", border: "1px solid rgba(40,200,64,.3)", color: "#8fe6a0", fontSize: 14 }}>
          <Check width={18} /> Thanks! Your message has been received — we&apos;ll be in touch shortly.
        </div>
      )}
      {state === "error" && (
        <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(255,95,87,.12)", border: "1px solid rgba(255,95,87,.3)", color: "#ffb4ae", fontSize: 14 }}>
          {error}
        </div>
      )}
    </form>
  );
}
