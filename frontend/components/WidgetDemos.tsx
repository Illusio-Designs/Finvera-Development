"use client";
import { useState } from "react";
import Toaster from "./admin/Toaster";
import { toast } from "@/lib/toast";

const Eye = ({ off }: { off?: boolean }) =>
  off ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><path d="M1 1l22 22" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );

export function PasswordDemo() {
  const [show, setShow] = useState(false);
  return (
    <div className="adm-field" style={{ maxWidth: 320, width: "100%" }}>
      <label>Password</label>
      <div className="adm-pass">
        <input type={show ? "text" : "password"} defaultValue="supersecret" />
        <button type="button" className="adm-eye" onClick={() => setShow((s) => !s)} data-tip={show ? "Hide" : "Show"} aria-label="Toggle password">
          <Eye off={show} />
        </button>
      </div>
    </div>
  );
}

export function ToastDemo() {
  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-grad" data-cursor onClick={() => toast("Saved successfully")}>Trigger success</button>
        <button className="btn btn-ghost" data-cursor onClick={() => toast("Something went wrong", "err")}>Trigger error</button>
      </div>
      <Toaster />
    </>
  );
}

export function TooltipDemo() {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      <button className="btn btn-ghost" data-tip="I'm a tooltip">Hover me</button>
      <button className="adm-ibtn" data-tip="Edit" style={{ borderColor: "var(--line-2)" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
      </button>
    </div>
  );
}

export function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn btn-ghost" data-cursor onClick={() => setOpen(true)}>Open confirm dialog</button>
      {open && (
        <div className="adm-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="adm-confirm">
            <div className="adm-confirm-ic">
              <svg viewBox="0 0 24 24" width={22} fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </div>
            <h3>Delete this item?</h3>
            <p>This will permanently remove it. This can&apos;t be undone.</p>
            <div className="adm-confirm-actions">
              <button className="adm-btn ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="adm-btn danger" onClick={() => setOpen(false)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function SuccessCheckDemo() {
  const [n, setN] = useState(0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div className="success-check" key={n}><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></div>
      <button className="btn btn-ghost" data-cursor onClick={() => setN((x) => x + 1)}>Replay</button>
    </div>
  );
}
