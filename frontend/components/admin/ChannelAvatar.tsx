"use client";
import { useEffect, useState } from "react";
export default function ChannelAvatar({ picture, label, className = "ss-ava", color }: { picture?: string | null; label: string; className?: string; color?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [picture]);
  return <span className={className} style={{ background: color }} role="img" aria-label={`${label} profile picture`}>{picture && !failed ? <img src={picture} alt="" onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /> : label.trim().slice(0, 2).toUpperCase()}</span>;
}
