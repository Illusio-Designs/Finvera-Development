"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { channelHealth, type HealthAccount, type HealthResult } from "@/lib/socialAccountHealth";
import "./social-account-health.css";
export default function SocialAccountHealth({ accounts, brand = "", canManage = false, onReconnect }: { accounts: HealthAccount[]; brand?: string; canManage?: boolean; onReconnect: (brand: string) => void }) {
  const [results, setResults] = useState<Record<string, HealthResult>>({}), [checking, setChecking] = useState(false);
  const [, tick] = useState(0);
  const generation = useRef(0), lock = useRef(false);
  const signature = JSON.stringify(accounts.map(a => [a.client, a.pageId, a.igUserId, a.igUsername, a.status, a.tokenExpiresAt]));
  useEffect(() => { generation.current++; lock.current = false; setChecking(false); setResults({}); return () => { generation.current++; }; }, [signature]);
  useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(timer); }, []);
  const rows = accounts.filter(a => !brand || a.client === brand).flatMap(account => (["facebook", ...(account.igUsername || account.igUserId ? ["instagram"] : [])]).map(platform => ({ account, platform, key: JSON.stringify([account.client, platform]) })));
  async function check(targets: typeof rows) {
    if (lock.current) return;
    lock.current = true; setChecking(true);
    const id = generation.current;
    let index = 0;
    async function worker() {
      while (index < targets.length && id === generation.current) {
        const row = targets[index++];
        let result: HealthResult;
        try { result = { data: await api.channelCapabilities(row.account.client, row.platform) }; }
        catch (error) { result = { error: error instanceof Error ? error.message : "Could not check access." }; }
        if (id === generation.current) setResults(current => ({ ...current, [row.key]: result }));
      }
    }
    try { await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker)); }
    finally { if (id === generation.current) { lock.current = false; setChecking(false); } }
  }
  const attention = rows.filter(r => ["danger", "warning"].includes(channelHealth(r.account, r.platform, results[r.key]).state)).length;
  return <details className="sah-panel" open={attention > 0 || undefined}>
    <summary><span><b>Account health</b><small>{rows.length} channels · {attention ? `${attention} need attention` : "Review connection and publishing access"}</small></span><span className={attention ? "sah-attention" : ""}>{attention ? "Needs attention" : "Connection overview"}</span></summary>
    <div className="sah-body"><div className="sah-toolbar"><p>Checks read account access; they do not publish or edit profiles.</p><button type="button" className="adm-btn ghost" disabled={checking || !rows.length} onClick={() => check(rows)}>{checking ? "Checking access…" : "Check all accounts"}</button></div>
      {!rows.length && <p>No connected accounts for this view. Connect a brand in Social studio to begin.</p>}
      <div className="sah-grid">{rows.map(row => {
        const result = results[row.key], health = channelHealth(row.account, row.platform, result);
        const expiry = result?.data?.expiresAt || row.account.tokenExpiresAt;
        return <article key={row.key} className={`sah-card ${health.state}`} aria-label={`${row.account.client} ${row.platform} account health`}><header><div><h3>{row.account.client}</h3><small>{row.platform === "facebook" ? "Facebook" : "Instagram"}</small></div><span className="sah-badge">{health.label}</span></header><p>{health.detail}</p>
          <small>Checked: {result?.data?.checkedAt ? new Date(result.data.checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "Not checked in this session"}</small>
          <small>Access expiry: {expiry ? new Date(expiry).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "Not reported"}</small>
          {result?.data && <details><summary>Permission details</summary><ul>{result.data.actions.filter(a => ["token", "view", "publish", "edit", "stories", "covers"].includes(a.id)).map(a => <li key={a.id}><b>{a.label}: {a.state.replaceAll("_", " ")}</b><p>{a.detail}</p></li>)}</ul></details>}
          <footer><button type="button" className="adm-btn ghost" disabled={checking} onClick={() => check([row])}>Check access</button>{health.reconnect && (canManage ? <button type="button" className="adm-btn primary" onClick={() => onReconnect(row.account.client)}>Reconnect brand</button> : <small>Ask an administrator to reconnect this brand.</small>)}{health.label === "Publishing paused" && <Link className="adm-btn ghost" href={`/dashboard/social-studio?tab=channels&brand=${encodeURIComponent(row.account.client)}`}>Manage channel</Link>}</footer>
        </article>;
      })}</div>
    </div>
  </details>;
}
