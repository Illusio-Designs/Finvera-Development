"use client";
/* Settings & pixels — brand info, social links and the tracking IDs the
   public site loads. One request for the values (GET /settings/all); edits
   stay on this page until Save, which sends only the keys that changed
   (PUT /settings). Changed fields are highlighted, a bar at the bottom
   counts them, and leaving the page with unsaved changes asks first.
   Field definitions and checks live in ./fields. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon, Refresh01Icon, FloppyDiskIcon, Undo02Icon, HelpCircleIcon, LinkSquare02Icon, ImageDownloadIcon,
  DatabaseBackupIcon, UserShield01Icon, InstagramIcon, ArrowRight01Icon, Settings02Icon,
} from "@hugeicons/core-free-icons";
import { settingsApi, type ApiError } from "@/lib/adminApi";
import { useShell } from "@/components/admin/shell/ShellContext";
import { rolesCan } from "@/lib/permissions";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import ShrinkImages from "@/components/admin/ShrinkImages";
import { SECTIONS, FIELD, clean, idStatus, issueOf, linkOk, type Field } from "./fields";
import "./settings.css";

type Vals = Record<string, string>;
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const IMAGES = "images";

export default function AdminSettings() {
  const router = useRouter();
  const { roles } = useShell();
  const isAdmin = roles.includes("admin");

  const [orig, setOrig] = useState<Vals | null>(null);   // saved values (null while loading)
  const [draft, setDraft] = useState<Vals>({});          // what's in the boxes
  const [loadErr, setLoadErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverErr, setServerErr] = useState<Vals>({});  // a 400 from the server, by key
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [tried, setTried] = useState(false);              // pressed Save with problems
  const [tip, setTip] = useState<string | null>(null);    // open "Where do I find this?"
  const [active, setActive] = useState(SECTIONS[0].id);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const rows = await settingsApi.list();
      const v: Vals = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => { if (FIELD[r.key]) v[r.key] = r.value ?? ""; });
      setOrig(v); setDraft(v); setServerErr({}); setTouched({}); setTried(false);
    } catch (e) { setLoadErr(e instanceof Error ? e.message : "Couldn't load the settings."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Only keys the server has are shown (it creates them all on start). */
  const sections = useMemo(() => (orig ? SECTIONS.map((s) => ({ ...s, fields: s.fields.filter((f) => f.key in orig) })).filter((s) => s.fields.length) : []), [orig]);

  const cleaned = (k: string) => clean(k, draft[k] ?? "");
  const changed = useMemo(() => (orig ? Object.keys(orig).filter((k) => clean(k, draft[k] ?? "") !== clean(k, orig[k] ?? "")) : []), [orig, draft]);
  const isDirty = (k: string) => changed.includes(k);
  const issue = (f: Field) => issueOf(f, cleaned(f.key));
  const blocking = changed.filter((k) => issueOf(FIELD[k], clean(k, draft[k] ?? ""))?.level === "err");
  const n = changed.length;

  /* ── leave-page guard ── */
  const dirtyRef = useRef(0);
  dirtyRef.current = n;
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    // In-app links (sidebar, breadcrumb, related pages): ask first. Runs in the
    // capture phase so it gets the click before Next's <Link> handler does.
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      e.preventDefault(); e.stopPropagation();
      const count = dirtyRef.current;
      dialog.confirm({
        title: "Leave without saving?",
        message: `You have ${plural(count, "unsaved change")} on this page. ${count === 1 ? "It" : "They"} will be lost if you leave.`,
        confirmText: "Leave page", cancelText: "Stay here",
      }).then((ok) => { if (ok) { dirtyRef.current = 0; router.push(url.pathname + url.search + url.hash); } });
    };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onBefore); document.removeEventListener("click", onClick, true); };
  }, [router]);

  /* ── section nav: highlight the section in view ── */
  useEffect(() => {
    if (!orig) return;
    const els = [...sections.map((s) => s.id), ...(isAdmin ? [IMAGES] : [])].map((id) => document.getElementById("st-" + id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id.slice(3));
    }, { rootMargin: "-90px 0px -55% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [orig, sections, isAdmin]);
  /* Phones: keep the current chip in view in the chip row (scrolls the row only). */
  const chipsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = chipsRef.current, on = row?.querySelector<HTMLElement>(".st-nav-i.on");
    if (!row || !on || row.scrollWidth <= row.clientWidth) return;
    const left = on.offsetLeft - row.offsetLeft, right = left + on.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) row.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
  }, [active]);
  const jump = (id: string) => {
    setActive(id);
    document.getElementById("st-" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const focusField = (k: string) => {
    const el = document.getElementById("st_" + k);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el?.focus({ preventScroll: true }), 250);
  };

  const setVal = (k: string, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (serverErr[k]) setServerErr((s) => { const c = { ...s }; delete c[k]; return c; });
  };
  const revert = (k: string) => { if (orig) setVal(k, orig[k] ?? ""); };

  function discard() {
    if (!orig || !n) return;
    const before = draft;
    setDraft(orig); setServerErr({}); setTouched({}); setTried(false);
    toast(`Discarded ${plural(n, "change")}`, "info", { action: { label: "Undo", onClick: () => setDraft(before) } });
  }

  async function save() {
    if (!orig || !n || saving) return;
    if (blocking.length) {
      setTried(true);
      const f = FIELD[blocking[0]];
      toast(blocking.length === 1 ? "Fix 1 field before saving" : `Fix ${blocking.length} fields before saving`, "warn",
        { description: `${f.label}: ${issueOf(f, clean(f.key, draft[f.key] ?? ""))?.text}` });
      focusField(blocking[0]);
      return;
    }
    const payload: Vals = Object.fromEntries(changed.map((k) => [k, clean(k, draft[k] ?? "")]));
    setSaving(true);
    try {
      await settingsApi.save(payload);
      setOrig((o) => ({ ...(o || {}), ...payload }));
      // Keep anything typed while saving; tidy the boxes that were saved.
      setDraft((d) => { const c = { ...d }; for (const k in payload) if (clean(k, c[k] ?? "") === payload[k]) c[k] = payload[k]; return c; });
      setServerErr({}); setTouched({}); setTried(false);
      toast("Settings saved", "ok", { description: `${plural(changed.length, "change")} · live on the site within a couple of minutes` });
    } catch (e) {
      const err = e as ApiError;
      if (err.field && FIELD[err.field]) { setServerErr({ [err.field]: err.message }); focusField(err.field); }
      toast("Couldn't save the settings", "err", { description: err.message || "Try again in a moment. Nothing was changed." });
    } finally { setSaving(false); }
  }

  /* Ctrl/Cmd + S saves. */
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── one field ── */
  function Row({ f }: { f: Field }) {
    const v = draft[f.key] ?? "";
    const c = cleaned(f.key);
    const dirty = isDirty(f.key);
    const iss = serverErr[f.key] ? { level: "err" as const, text: serverErr[f.key] } : issue(f);
    // Problems show once you leave the box (or press Save); saved values show them straight away.
    const showIss = iss && (iss.level === "warn" || !!serverErr[f.key] || touched[f.key] || tried || !dirty);
    const st = f.kind === "id" ? idStatus(f, c) : null;
    const errId = `st_${f.key}_msg`;
    const common = {
      id: "st_" + f.key, value: v,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(f.key, e.target.value),
      onBlur: () => setTouched((t) => (t[f.key] ? t : { ...t, [f.key]: true })),
      placeholder: f.placeholder || (f.kind === "url" ? f.example : undefined),
      "aria-invalid": showIss && iss?.level === "err" ? true : undefined,
      "aria-describedby": showIss || tip === f.key ? errId : undefined,
      className: "st-in" + (showIss && iss?.level === "err" ? " bad" : ""),
    };
    return (
      <div className={"st-row" + (dirty ? " dirty" : "")} data-key={f.key}>
        <div className="st-lab">
          {f.logo && (
            <span className={"st-logo " + f.logo.tone} aria-hidden="true">
              {f.logo.icon ? <HugeiconsIcon icon={f.logo.icon} size={18} strokeWidth={1.8} /> : f.logo.text}
            </span>
          )}
          <span className="st-lab-tx">
            <label htmlFor={"st_" + f.key}>{f.label}</label>
            {f.hint && <small>{f.hint}</small>}
            {dirty && (
              <button type="button" className="st-undo" onClick={() => revert(f.key)} title={`Put back: ${orig?.[f.key] || "empty"}`}>
                <HugeiconsIcon icon={Undo02Icon} size={13} strokeWidth={2} />Undo change
              </button>
            )}
          </span>
        </div>
        <div className="st-ctl">
          <div className="st-ctl-line">
            {f.kind === "textarea" ? <textarea rows={3} {...common} />
              : <input {...common} type={f.kind === "email" ? "email" : f.kind === "url" ? "url" : f.kind === "phone" ? "tel" : "text"}
                  spellCheck={f.kind === "text" ? undefined : false} autoComplete="off"
                  inputMode={f.key === "facebook_pixel_id" ? "numeric" : f.kind === "email" ? "email" : f.kind === "url" ? "url" : f.kind === "phone" ? "tel" : undefined} />}
            {st && (
              <span className={"sh-pill st-pill " + (st === "ok" ? "green" : st === "bad" ? "amber" : "grey")} aria-live="polite">
                {st === "ok" ? "Connected" : st === "bad" ? "Check the format" : "Not set"}
              </span>
            )}
            {f.kind === "url" && (
              linkOk(c)
                ? <a className="sh-btn sm st-open" href={c} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${f.label} link in a new tab`}>
                    <HugeiconsIcon icon={LinkSquare02Icon} size={15} strokeWidth={1.8} />Open
                  </a>
                : <span className="sh-btn sm st-open off" aria-hidden="true"><HugeiconsIcon icon={LinkSquare02Icon} size={15} strokeWidth={1.8} />Open</span>
            )}
          </div>
          <div id={errId} className="st-msgs">
            {showIss && iss && (
              <p className={"st-msg " + iss.level} role={iss.level === "err" ? "alert" : undefined}>
                <HugeiconsIcon icon={Alert02Icon} size={14} strokeWidth={1.9} />{iss.text}
              </p>
            )}
            {f.tip && (
              <>
                <button type="button" className="st-tipbtn" aria-expanded={tip === f.key} onClick={() => setTip((t) => (t === f.key ? null : f.key))}>
                  <HugeiconsIcon icon={HelpCircleIcon} size={14} strokeWidth={1.9} />Where do I find this?
                </button>
                {tip === f.key && (
                  <p className="st-tip">
                    {f.tip}{" "}
                    {f.tipLink && <a href={f.tipLink.href} target="_blank" rel="noopener noreferrer">{f.tipLink.label} ↗</a>}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const related = [
    { href: "/dashboard/system", label: "Email & backups", icon: DatabaseBackupIcon, show: rolesCan(roles, "users") },
    { href: "/dashboard/users", label: "Users & security", icon: UserShield01Icon, show: rolesCan(roles, "users") },
    { href: "/dashboard/social-studio", label: "Instagram & Facebook", icon: InstagramIcon, show: rolesCan(roles, "social") },
  ].filter((r) => r.show);
  const navItems = [
    ...(orig ? sections : SECTIONS).map((s) => ({ id: s.id, title: s.title, icon: s.icon, count: s.fields.filter((f) => isDirty(f.key)).length })),
    ...(isAdmin ? [{ id: IMAGES, title: "Image storage", icon: ImageDownloadIcon, count: 0 }] : []),
  ];
  const relatedLinks = related.length > 0 && (
    <>
      <div className="st-nav-h">Related settings</div>
      {related.map((r) => (
        <Link key={r.href} href={r.href} className="st-rel">
          <HugeiconsIcon icon={r.icon} size={17} strokeWidth={1.8} />{r.label}<HugeiconsIcon icon={ArrowRight01Icon} size={14} strokeWidth={2} className="st-rel-go" />
        </Link>
      ))}
    </>
  );

  return (
    <div className="td st">
      <div className="td-hello">
        <div className="td-hello-tx">
          <div className="td-eyebrow">Admin</div>
          <h1>Settings &amp; pixels</h1>
          <p>Brand info, social links and analytics connections.</p>
        </div>
      </div>

      {loadErr && !orig ? (
        <div className="sh-empty err" role="alert">
          <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={1.8} className="hgi" />
          <b>Couldn&apos;t load the settings</b><span>{loadErr}</span>
          <button type="button" className="sh-btn sm" onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />Try again</button>
        </div>
      ) : (
        <div className="st-grid">
          <nav className="st-nav" aria-label="Settings sections">
            <div className="st-nav-secs" ref={chipsRef}>
              {navItems.map((s) => (
                <button key={s.id} type="button" className={"st-nav-i" + (active === s.id ? " on" : "")} aria-current={active === s.id ? "true" : undefined} onClick={() => jump(s.id)} disabled={!orig}>
                  <HugeiconsIcon icon={s.icon} size={18} strokeWidth={1.8} />
                  <span>{s.title}</span>
                  {s.count > 0 && <i className="st-chg" aria-label={`${plural(s.count, "unsaved change")}`}>{s.count}</i>}
                </button>
              ))}
            </div>
            <div className="st-nav-rel">{relatedLinks}</div>
          </nav>

          <div className="st-col">
            {!orig ? (
              [5, 5, 3].map((rows, i) => (
                <section key={i} className="sh-card st-card" aria-hidden="true">
                  <div className="st-card-h"><span className="skel" style={{ width: 40, height: 40, borderRadius: 12 }} /><span style={{ flex: 1 }}><span className="skel skel-line" style={{ width: 170, height: 14 }} /><span className="skel skel-line" style={{ width: "60%", height: 10, marginTop: 8 }} /></span></div>
                  {Array.from({ length: rows }).map((_, j) => (
                    <div key={j} className="st-row st-skel"><span className="skel skel-line" style={{ width: 140, height: 12 }} /><span className="skel" style={{ height: 42, borderRadius: 12 }} /></div>
                  ))}
                </section>
              ))
            ) : sections.length === 0 ? (
              <div className="sh-empty">
                <HugeiconsIcon icon={Settings02Icon} size={20} strokeWidth={1.8} className="hgi" />
                <b>No settings yet</b>
                <span>The server adds the site settings when it starts. Restart the backend, then reload this page.</span>
                <button type="button" className="sh-btn sm" onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />Reload</button>
              </div>
            ) : sections.map((s) => (
              <section key={s.id} className="sh-card st-card" id={"st-" + s.id} aria-labelledby={`st-${s.id}-h`}>
                <div className="st-card-h">
                  <span className="st-box"><HugeiconsIcon icon={s.icon} size={20} strokeWidth={1.8} /></span>
                  <div>
                    <h2 id={`st-${s.id}-h`}>{s.title}</h2>
                    <small>{s.sub}</small>
                  </div>
                </div>
                {s.fields.map((f) => <div key={f.key}>{Row({ f })}</div>)}
              </section>
            ))}

            {orig && isAdmin && <div id={"st-" + IMAGES} className="st-images"><ShrinkImages /></div>}
            {orig && related.length > 0 && <div className="sh-card st-rel-m">{relatedLinks}</div>}

            {orig && n > 0 && (
              <div className="st-bar" role="region" aria-label="Unsaved changes">
                <span className="st-bar-tx" aria-live="polite">
                  <b>{plural(n, "unsaved change")}</b>
                  <small>{blocking.length ? `${plural(blocking.length, "field")} to fix before saving` : "Changes go live on the site after you save."}</small>
                </span>
                <button type="button" className="sh-btn st-bar-ghost" onClick={discard} disabled={saving}>Discard</button>
                <button type="button" className="sh-btn pri" onClick={save} disabled={saving}>
                  {saving ? <span className="st-spin" aria-hidden /> : <HugeiconsIcon icon={FloppyDiskIcon} size={17} strokeWidth={1.8} />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
