"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/adminApi";

type S = "checking" | "online" | "offline";

export default function BackendStatus({ variant = "pill" }: { variant?: "pill" | "card" }) {
  const [state, setState] = useState<S>("checking");
  const [info, setInfo] = useState<{ db?: string; uptime?: number; env?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!alive) return;
        setInfo(data);
        setState(res.ok && data?.db === "up" ? "online" : "offline");
      } catch {
        if (alive) { setState("offline"); setInfo(null); }
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const color = state === "online" ? "#28c840" : state === "offline" ? "#ff5f57" : "#febc2e";
  const label = state === "online" ? "Backend online" : state === "offline" ? "Backend offline" : "Checking…";
  const host = API_BASE.replace(/^https?:\/\//, "");
  const uptime = typeof info?.uptime === "number" ? `${Math.floor(info.uptime / 60)}m` : null;

  if (variant === "card") {
    return (
      <div className="adm-panel" style={{ padding: 20, display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
        <span className={"adm-statusdot" + (state === "online" ? " live" : "")} style={{ background: color }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b style={{ fontSize: 15 }}>{label}</b>
          <div style={{ color: "var(--muted-2)", fontSize: 12.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {host}{info?.db ? ` · db ${info.db}` : ""}{uptime ? ` · up ${uptime}` : ""}{info?.env ? ` · ${info.env}` : ""}
          </div>
        </div>
        {state === "offline" && (
          <a href={`${API_BASE}/api/health`} target="_blank" rel="noreferrer" className="adm-btn ghost" style={{ flex: "none" }}>Check</a>
        )}
      </div>
    );
  }

  return (
    <div className="adm-statuspill" title={`${label}${info?.db ? ` · db ${info.db}` : ""} · ${host}`}>
      <span className={"adm-statusdot" + (state === "online" ? " live" : "")} style={{ background: color }} />
      <span className="adm-lbl">{label}</span>
    </div>
  );
}
