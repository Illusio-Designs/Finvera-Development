"use client";
import { useEffect, useRef, useState } from "react";

export type Me = { name?: string; email?: string; role?: string; avatar?: string; title?: string } | null;

function initials(name?: string) {
  const p = (name || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}

export default function UserMenu({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const Avatar = ({ size }: { size: number }) => (
    me?.avatar
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className="adm-avatar" src={me.avatar} alt={me?.name || ""} style={{ width: size, height: size }} />
      : <span className="adm-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>{initials(me?.name)}</span>
  );

  return (
    <div className="adm-usermenu" ref={ref}>
      <button className="adm-usermenu-btn" onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open}>
        <Avatar size={34} />
        <span className="um-name">{me?.name || "Account"}</span>
        <svg className={"um-caret" + (open ? " up" : "")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="adm-usermenu-pop">
          <div className="um-head">
            <Avatar size={42} />
            <div className="um-id">
              <b>{me?.name || "Account"}</b>
              <small>{me?.email || ""}</small>
            </div>
          </div>
          {(me?.title || me?.role) && (
            <div className="um-meta">
              {me?.title && <span>{me.title}</span>}
              {me?.role && <span className="um-role">{me.role}</span>}
            </div>
          )}
          <button className="um-item danger" onClick={onLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
