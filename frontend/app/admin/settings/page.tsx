"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/adminApi";

const LABELS: Record<string, string> = {
  site_name: "Site name",
  site_tagline: "Tagline",
  contact_email: "Contact email",
  contact_phone: "Contact phone",
  contact_address: "Address",
  social_x: "X / Twitter URL",
  social_linkedin: "LinkedIn URL",
  social_github: "GitHub URL",
  google_analytics_id: "Google Analytics ID (G-XXXX)",
  google_tag_manager_id: "Google Tag Manager ID (GTM-XXXX)",
  facebook_pixel_id: "Facebook Pixel ID",
  google_site_verification: "Google site verification",
};
const GROUP_TITLES: Record<string, string> = {
  general: "General",
  social: "Social links",
  analytics: "Analytics & pixels",
};
const GROUP_SUB: Record<string, string> = {
  analytics: "Connect Google Analytics, GTM and the Facebook Pixel. Leave blank to disable.",
};

export default function AdminSettings() {
  const [rows, setRows] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data: any[] = await api.getSettings();
        setRows(data);
        const v: Record<string, string> = {};
        data.forEach((r) => { v[r.key] = r.value || ""; });
        setValues(v);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    setSaving(true); setMsg(""); setError("");
    try { await api.saveSettings(values); setMsg("Settings saved."); setTimeout(() => setMsg(""), 2500); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="adm-empty">Loading…</div>;

  const groups = Array.from(new Set(rows.map((r) => r.group || "general")));

  return (
    <>
      <div className="adm-top">
        <div><h1>Settings &amp; pixels</h1><p>Brand info, social links and analytics connections.</p></div>
        <button className="adm-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
      {msg && <div className="adm-msg ok">{msg}</div>}
      {error && <div className="adm-msg err">{error}</div>}

      {groups.map((g) => (
        <div className="adm-group" key={g}>
          <h3>{GROUP_TITLES[g] || g}</h3>
          {GROUP_SUB[g] && <p className="gsub">{GROUP_SUB[g]}</p>}
          {rows.filter((r) => (r.group || "general") === g).map((r) => (
            <div className="adm-field" key={r.key}>
              <label htmlFor={r.key}>{LABELS[r.key] || r.key}</label>
              <input id={r.key} value={values[r.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [r.key]: e.target.value }))} />
            </div>
          ))}
        </div>
      ))}
      <button className="adm-btn primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
    </>
  );
}
