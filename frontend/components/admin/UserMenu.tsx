"use client";
import { useDisclosure } from "@/lib/useDisclosure";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserIcon, UserMultipleIcon, Settings02Icon, CommandIcon, Logout03Icon } from "@hugeicons/core-free-icons";
import { ROLE_LABELS } from "@/lib/permissions";

export type Me = {
  id?: number; name?: string; email?: string; role?: string; roles?: string[]; avatar?: string | null; title?: string | null;
  socialClients?: unknown;
} | null;

const initials = (name?: string) => (name || "").trim().split(/\s+/).map((w) => w[0] || "").slice(0, 2).join("").toUpperCase();

export function Avatar({ me, size = 36 }: { me: Me; size?: number }) {
  if (me?.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="sh-av" src={me.avatar} alt="" style={{ width: size, height: size }} />;
  }
  return <span className="sh-av" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }} aria-hidden="true">{initials(me?.name) || "?"}</span>;
}

/* Sidebar footer: who is signed in (opens the account menu, upwards) and a
   sign-out button. Menu: My account, Users and Settings when allowed, the
   command palette, Sign out. */
export default function UserMenu({ me, roleText, canUsers, canSettings, onLogout, onPalette, mac }: {
  me: Me; roleText: string; canUsers: boolean; canSettings: boolean; onLogout: () => void; onPalette: () => void; mac: boolean;
}) {
  const [open, setOpen] = useDisclosure(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const roles = me?.roles?.length ? me.roles : (me?.role ? [me.role] : []);
  const close = () => setOpen(false);

  return (
    <div className="sh-me" ref={ref}>
      <button type="button" className="sh-me-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label="Account menu" data-tip={me?.name || "Account"}>
        {me ? <Avatar me={me} /> : <span className="skel skel-circle" style={{ width: 36, height: 36, flex: "none" }} />}
        <span className="sh-me-txt">
          {me ? <><b>{me.name || "Signed in"}</b><small>{roleText || "Account"}</small></> : <span className="skel skel-line" style={{ width: 90, height: 12, display: "block" }} />}
        </span>
      </button>
      <button type="button" className="sh-icb plain sh-me-out" onClick={onLogout} aria-label="Sign out" data-tip="Sign out">
        <HugeiconsIcon icon={Logout03Icon} size={18} strokeWidth={1.8} className="hgi" />
      </button>
      {open && (
        <div className="sh-pop sh-userpop" role="menu" aria-label="Account">
          <div className="sh-pop-h">
            <Avatar me={me} size={44} />
            <span className="sh-userpop-id">
              <b>{me?.name || "Account"}</b>
              <small>{me?.email || ""}</small>
            </span>
          </div>
          {(me?.title || roles.length > 0) && (
            <div className="sh-userpop-roles">
              {me?.title && <span className="sh-pill grey">{me.title}</span>}
              {roles.map((r) => <span className="sh-pill blue" key={r}>{ROLE_LABELS[r] || r}</span>)}
            </div>
          )}
          <div className="sh-menu">
            <Link href="/dashboard/account" role="menuitem" onClick={close}><HugeiconsIcon icon={UserIcon} size={18} strokeWidth={1.8} className="hgi" />My account</Link>
            {canUsers && <Link href="/dashboard/users" role="menuitem" onClick={close}><HugeiconsIcon icon={UserMultipleIcon} size={18} strokeWidth={1.8} className="hgi" />Team &amp; users</Link>}
            {canSettings && <Link href="/dashboard/settings" role="menuitem" onClick={close}><HugeiconsIcon icon={Settings02Icon} size={18} strokeWidth={1.8} className="hgi" />Settings &amp; pixels</Link>}
            <button type="button" role="menuitem" onClick={() => { close(); onPalette(); }}>
              <HugeiconsIcon icon={CommandIcon} size={18} strokeWidth={1.8} className="hgi" />Jump to a page<kbd>{mac ? "⌘ K" : "Ctrl K"}</kbd>
            </button>
            <hr />
            <button type="button" role="menuitem" className="danger" onClick={() => { close(); onLogout(); }}>
              <HugeiconsIcon icon={Logout03Icon} size={18} strokeWidth={1.8} className="hgi" />Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
