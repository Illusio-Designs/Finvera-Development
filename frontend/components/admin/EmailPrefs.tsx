"use client";
/* Email preferences for the signed-in person — which emails they want.
   Each switch saves straight away. "System" (server errors, failed backups)
   is only shown to admins. Self-contained: drop it into any page or tab. */
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, Alert02Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { api, opsApi, type EmailPrefKind, type EmailPrefs as Prefs } from "@/lib/adminApi";
import { userRoles } from "@/lib/permissions";
import { toast } from "@/lib/toast";

const Ic = ({ i, size = 16 }: { i: any; size?: number }) => <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} />;

const KINDS: { key: EmailPrefKind; title: string; desc: string }[] = [
  { key: "contact", title: "New website enquiries", desc: "When someone sends the contact form on the website." },
  { key: "renewals", title: "Renewal reminders", desc: "Renewals coming up or overdue, in one email each morning." },
  { key: "calendar", title: "My content work", desc: "Your posts due today or overdue, in one email each morning." },
  { key: "publishing", title: "Publishing problems", desc: "A post that failed to go out, or a lost Instagram / Facebook connection." },
  { key: "security", title: "Security alerts", desc: "Your password changed, a sign-in from a new device, or two-step login turned on or off." },
  { key: "system", title: "System problems", desc: "Server errors and failed backups (admins only)." },
];

export default function EmailPrefs({ framed = true }: { framed?: boolean }) {
  const [data, setData] = useState<Prefs | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<EmailPrefKind | null>(null);

  useEffect(() => {
    opsApi.getEmailPrefs().then(setData).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your email settings"));
    api.me().then((r) => setIsAdmin(userRoles(r?.user ?? r).includes("admin"))).catch(() => {});
  }, []);

  async function flip(k: EmailPrefKind, on: boolean) {
    if (!data) return;
    const before = data;
    setData({ ...data, prefs: { ...data.prefs, [k]: on } }); // show it at once
    setSaving(k);
    try {
      setData(await opsApi.saveEmailPrefs({ [k]: on }));
      toast(on ? "Emails turned on" : "Emails turned off", "ok", { description: KINDS.find((x) => x.key === k)?.title, sound: false });
    } catch (e) {
      setData(before);
      toast("Couldn't save", "err", { description: e instanceof Error ? e.message : "" });
    } finally { setSaving(null); }
  }

  const known = new Set(data?.kinds || KINDS.map((k) => k.key));
  const rows = KINDS.filter((k) => known.has(k.key) && (k.key !== "system" || isAdmin));

  const body = (
    <>
      {error && <div className="sys-note bad" role="alert"><Ic i={Alert02Icon} /><span>{error}</span></div>}
      {data && !data.mailConfigured && (
        <div className="sys-note warn"><Ic i={InformationCircleIcon} /><span><b>Emails aren’t set up yet</b> — you’ll still get these in the app.</span></div>
      )}
      {!data && !error && <div className="sys-empty">Loading…</div>}
      {data && (
        <ul className="ops-prefs">
          {rows.map((k) => (
            <li key={k.key}>
              <div><b id={`ep-${k.key}`}>{k.title}</b><small id={`ep-${k.key}-d`}>{k.desc}</small></div>
              <label className="ops-switch">
                <input type="checkbox" role="switch" checked={!!data.prefs[k.key]} disabled={saving === k.key}
                  aria-labelledby={`ep-${k.key}`} aria-describedby={`ep-${k.key}-d`}
                  onChange={(e) => flip(k.key, e.target.checked)} />
                <i aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  if (!framed) return body;
  return (
    <section className="sys-card" aria-labelledby="ep-h">
      <div className="sys-card-h">
        <span className="sys-ic"><Ic i={Mail01Icon} size={20} /></span>
        <div>
          <h2 id="ep-h">Email notifications</h2>
          <p>{data?.email ? <>Sent to <b style={{ color: "var(--ink)", fontWeight: 600 }}>{data.email}</b>. </> : null}Pick what you want by email. Everything still shows in the app’s bell.</p>
        </div>
      </div>
      {body}
    </section>
  );
}
