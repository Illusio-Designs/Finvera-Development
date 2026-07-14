"use client";
import { useEffect, useRef, useState } from "react";

export type Me = { name?: string; email?: string; role?: string; roles?: string[]; avatar?: string; title?: string } | null;

function initials(name?: string) {
  const p = (name || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase();
}
const UserGlyph = () => (
  <svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
);

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

  const Avatar = ({ size }: { size: number }) => {
    if (me?.avatar) {
      // eslint-disable-next-line @next/next/no-img-element
      return <img className="adm-avatar" src={me.avatar} alt={me?.name || ""} style={{ width: size, height: size }} />;
    }
    const ini = initials(me?.name);
    return <span className="adm-avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>{ini || <UserGlyph />}</span>;
  };

  if (!me) {
    return (
      <div className="adm-usermenu">
        <div className="adm-usermenu-btn" style={{ pointerEvents: "none" }}>
          <span className="skel skel-circle" style={{ width: 34, height: 34, flex: "none" }} />
          <span className="skel skel-line" style={{ width: 74, height: 12 }} />
        </div>
      </div>
    );
  }

  const roles = me?.roles?.length ? me.roles : (me?.role ? [me.role] : []);

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
          {(me?.title || roles.length > 0) && (
            <div className="um-meta">
              {me?.title && <span>{me.title}</span>}
              {roles.map((r) => <span className="um-role" key={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</span>)}
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
