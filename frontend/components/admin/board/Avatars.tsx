"use client";
/* Member avatars (photo, or initials on a stable colour) and a stacked row. */
import type { BoardUser } from "@/lib/adminApi";
import { initials, avatarColor } from "@/lib/activityText";

export function Av({ user, size = 24 }: { user?: Pick<BoardUser, "name" | "avatar"> | null; size?: number }) {
  const s = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) };
  const name = user?.name || "Someone";
  // eslint-disable-next-line @next/next/no-img-element
  if (user?.avatar) return <img className="kb-ava" src={user.avatar} alt="" title={name} style={s} loading="lazy" />;
  return <i className="kb-ava" style={{ ...s, background: avatarColor(name) }} title={name} aria-hidden>{initials(name)}</i>;
}

export function AvStack({ users, max = 4, size = 24, label }: { users: BoardUser[]; max?: number; size?: number; label?: string }) {
  if (!users.length) return null;
  const more = users.length - max;
  return (
    <span className="kb-avs" aria-label={label || users.map((u) => u.name).join(", ")} role="img">
      {users.slice(0, max).map((u) => <Av key={u.id} user={u} size={size} />)}
      {more > 0 && <i className="kb-ava kb-ava-more" style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.38)) }} aria-hidden>+{more}</i>}
    </span>
  );
}
