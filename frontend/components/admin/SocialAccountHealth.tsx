"use client";
import { DisclosureSummary } from "@/components/admin/Workspace";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/adminApi";
import { channelHealth, type HealthAccount, type HealthResult } from "@/lib/socialAccountHealth";
import "./social-account-health.css";
export default function SocialAccountHealth({ accounts, brand = "", onCheckLogins, checkingLogins = false }: {
  accounts: HealthAccount[];
  brand?: string;
  onCheckLogins?: () => void;
  checkingLogins?: boolean;
}) {
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
  const description = `${rows.length} ${rows.length === 1 ? "channel" : "channels"}${attention ? ` · ${attention} need attention` : ""}`;
  return <details className="sah-panel" open={attention > 0 || undefined}>
    <DisclosureSummary><b>Connection checks</b><small className={attention ? "sah-attention" : undefined}>{description}</small></DisclosureSummary>
    <div className="sah-body">
      <div className="sah-toolbar">
        <div>
          <button type="button" className="adm-btn ghost" disabled={checking || checkingLogins || !rows.length} onClick={() => check(rows)}>
            {checking ? "Checking permissions…" : "Check channel permissions"}
          </button>
          <small>Reads Meta permissions for the channels in this view.</small>
        </div>
        {onCheckLogins && <div>
          <button type="button" className="adm-btn ghost" disabled={checkingLogins || checking || !accounts.length} onClick={onCheckLogins}>
            {checkingLogins ? "Checking logins…" : "Check saved logins"}
          </button>
          <small>Refreshes the connection status for all connected brands.</small>
        </div>}
      </div>
      {!rows.length && <p>No channels are connected in this view.</p>}
      <div className="sah-grid">{rows.map(row => {
        const result = results[row.key], health = channelHealth(row.account, row.platform, result);
        const expiry = result?.data?.expiresAt || row.account.tokenExpiresAt;
        return <article key={row.key} className={`sah-card ${health.state}`} aria-label={`${row.account.client} ${row.platform} account health`}><header><div><h3>{row.account.client}</h3><small>{row.platform === "facebook" ? "Facebook" : "Instagram"}</small></div><span className="sah-badge">{health.label}</span></header><p>{health.detail}</p>
          <small>Checked: {result?.data?.checkedAt ? new Date(result.data.checkedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "Not checked in this session"}</small>
          <small>Access expiry: {expiry ? new Date(expiry).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "Not reported"}</small>
          {result?.data && <details>
            <DisclosureSummary>Permission details</DisclosureSummary>
            <ul>{result.data.actions.map(action => <li key={action.id}>
              <b>{action.label} · {action.state.replaceAll("_", " ")}</b>
              <p>{action.detail}</p>
              {action.url && <a href={action.url} target="_blank" rel="noopener noreferrer">{action.label} ↗</a>}
            </li>)}</ul>
            <details><DisclosureSummary>Granted scopes</DisclosureSummary>
              <small>{result.data.scopes?.join(", ") || "No scopes reported"}</small>
            </details>
          </details>}
          <footer>
            <button type="button" className="adm-btn ghost" disabled={checking || checkingLogins} onClick={() => check([row])}>
              {result?.data ? "Check again" : "Check access"}
            </button>
            {health.reconnect && <small>{onCheckLogins ? "Use Reconnect Meta on this brand’s channel group." : "Ask an administrator to reconnect this brand."}</small>}
          </footer>
        </article>;
      })}</div>
    </div>
  </details>;
}
