"use client";
import { useSaveWorkflow } from "@/lib/useSaveWorkflow";
/* The lead drawer (also "Add lead"): name / company, the stage picker (which
   sets the progress score), quick actions (call, WhatsApp, email, join /
   schedule a meeting) and three tabs — Details (every field, Save),
   Follow-up (log a touch + the touches so far) and History. */
import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon, Call02Icon, WhatsappIcon, Mail01Icon, Link04Icon, Calendar03Icon, Delete02Icon, Tick02Icon, Alert02Icon,
} from "@hugeicons/core-free-icons";
import { api, leadsApi, type LeadRow, type LeadStage, type LeadTouch } from "@/lib/adminApi";
import Select from "@/components/Select";
import DatePicker from "@/components/ui/DatePicker";
import CalendlyButton from "@/components/admin/CalendlyButton";
import HistoryList from "@/components/admin/HistoryList";
import { LeadTouchPanel, waDigits } from "@/components/admin/LeadFollowUps";
import { relative, whenOf, initials, avatarColor } from "@/lib/activityText";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { STAGES, stageOf, inr, cap, SOURCES, PRIORITIES, LOST_REASONS, followChip, toLocalInput, isUrl } from "./leadKit";

type Tab = "details" | "follow" | "history";
type Draft = Partial<LeadRow> & Record<string, unknown>;
const EDITABLE = ["name", "company", "purpose", "email", "phone", "source", "stage", "value", "owner", "priority",
  "nextFollowUpAt", "followUpNote", "meetingUrl", "meetingAt", "lostReason", "notes"] as const;
const norm = (v: unknown) => (v === "" || v === undefined ? null : v);
const same = (a: unknown, b: unknown) => String(norm(a) ?? "") === String(norm(b) ?? "");

export const NEW_LEAD: Draft = { stage: "new", priority: "medium", source: "Website", value: 0 };

export default function LeadDrawer({ lead, defaults, calendlyUrl, initialTab = "details", onClose, onSaved, onDeleted, onPatched }: {
  lead: LeadRow | null; defaults?: Draft; calendlyUrl?: string; initialTab?: Tab;
  onClose: () => void;
  onSaved: (row: LeadRow, isNew: boolean, before: LeadRow | null) => void;
  onDeleted: (id: number) => void;
  /* A touch was logged: these fields changed on the server already. */
  onPatched: (id: number, patch: Partial<LeadRow>) => void;
}) {
  const isNew = !lead;
  const [base, setBase] = useState<Draft>(() => (lead ? { ...lead } : { ...NEW_LEAD, ...defaults }));
  const [draft, setDraft] = useState<Draft>(base);
  const [tab, setTab] = useState<Tab>(isNew ? "details" : initialTab);
  const { saving, setSaving, error: err, setError: setErr } = useSaveWorkflow<{ text: string; field?: string } | null>(null);
  const [preset, setPreset] = useState<{ type: LeadTouch["type"]; at: number } | null>(null);
  const [histKey, setHistKey] = useState(0);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const nameRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lostRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.listUsers().then((u: unknown) => setUsers(Array.isArray(u) ? u : [])).catch(() => {}); }, []);
  useEffect(() => { (isNew ? nameRef.current : closeRef.current)?.focus({ preventScroll: true }); }, [isNew]);

  const dirtyKeys = useMemo(() => EDITABLE.filter((k) => !same(draft[k], base[k])), [draft, base]);
  const dirty = isNew ? !!String(draft.name || "").trim() || dirtyKeys.some((k) => k !== "stage") : dirtyKeys.length > 0;
  const set = (k: string, v: unknown) => { if (saving) return; setDraft((d) => ({ ...d, [k]: v })); if (err?.field === k) setErr(null); };
  const st = stageOf(String(draft.stage));

  async function tryClose() {
    if (saving) return;
    if (dirty) {
      const ok = await dialog.confirm({ title: isNew ? "Discard this lead?" : "Discard your changes?", message: isNew ? "It hasn't been added yet." : "The changes you made here haven't been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true });
      if (!ok) return;
    }
    onClose();
  }
  const tryCloseRef = useRef(tryClose);
  tryCloseRef.current = tryClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".adm-overlay")) return; // a dialog on top handles its own Escape
      tryCloseRef.current();
    };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, []);

  function pickStage(id: LeadStage) {
    set("stage", id);
    if (id === "lost") { setTab("details"); setTimeout(() => lostRef.current?.focus(), 40); }
  }

  async function save() {
    const name = String(draft.name || "").trim();
    if (!name) { setTab("details"); setErr({ text: "Add the contact name.", field: "name" }); nameRef.current?.focus(); return; }
    const email = String(draft.email || "").trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { setTab("details"); setErr({ text: "That email doesn't look right.", field: "email" }); return; }
    setSaving(true); setErr(null);
    try {
      const keys = isNew ? EDITABLE.filter((k) => norm(draft[k]) !== null) : dirtyKeys;
      const body: Record<string, unknown> = {};
      for (const k of keys) body[k] = norm(typeof draft[k] === "string" ? String(draft[k]).trim() || null : draft[k]);
      body.name = name;
      if ("value" in body) body.value = Math.max(0, Math.round(Number(body.value) || 0));
      // The older `nextFollowUp` column mirrors the new date; send both the same.
      if ("nextFollowUpAt" in body) body.nextFollowUp = body.nextFollowUpAt ?? null;
      // The stage picker sets the progress score (the server keeps the two in step too).
      if (isNew || "stage" in body) body.progress = stageOf(String(draft.stage)).pct;
      const row = isNew ? await leadsApi.create(body as Partial<LeadRow>) : await leadsApi.update(lead!.id, body as Partial<LeadRow>);
      setBase({ ...row }); setDraft({ ...row }); setHistKey((k) => k + 1);
      onSaved(row, isNew, lead);
    } catch (e) {
      const ex = e as Error & { field?: string };
      setErr({ text: ex.message || "Couldn't save.", field: ex.field });
      toast("Couldn't save the lead", "err", { description: ex.message });
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!lead) return;
    const ok = await dialog.confirm({ title: `Delete ${lead.name}?`, message: "The lead, its follow-ups and its touches are removed for everyone. This can't be undone.", confirmText: "Delete lead", danger: true });
    if (!ok) return;
    try { await leadsApi.remove(lead.id); onDeleted(lead.id); }
    catch (e) { toast("Couldn't delete it", "err", { description: e instanceof Error ? e.message : "Try again." }); }
  }

  const tel = String(draft.phone || "").replace(/[^\d+]/g, "");
  const wa = waDigits(String(draft.phone || ""));
  const mail = String(draft.email || "").trim();
  const meet = isUrl(draft.meetingUrl) ? String(draft.meetingUrl).trim() : "";
  const chip = lead ? followChip({ ...lead, ...draft } as LeadRow) : null;
  const touch = (type: LeadTouch["type"]) => { if (!isNew) { setPreset({ type, at: Date.now() }); setTab("follow"); } };
  const ownerOpts = [{ value: "", label: "Unassigned" }, ...users.map((u) => ({ value: u.name, label: u.name }))];
  if (draft.owner && !ownerOpts.some((o) => o.value === draft.owner)) ownerOpts.unshift({ value: String(draft.owner), label: String(draft.owner) });
  const fe = (k: string) => (err?.field === k ? " bad" : "");

  return (
    <>
      <div className="ld-scrim" onMouseDown={tryClose} aria-hidden />
      <aside className="ld-drawer leads-detail" role="dialog" aria-modal="true" aria-labelledby="ld-dtitle">
        <header className="ld-dh">
          <div className="ld-dh-top">
            <i className="ld-av lg" style={{ background: avatarColor(String(draft.name || "?")) }} aria-hidden>{initials(String(draft.name || "") || "+")}</i>
            <div className="ld-dh-tx">
              <h2 id="ld-dtitle">{isNew ? (String(draft.name || "").trim() || "New lead") : String(draft.name || lead!.name)}</h2>
              <p>{isNew ? "Add a prospect to the pipeline." : [draft.company, Number(draft.value) ? inr(Number(draft.value)) : "", `Lead #${lead!.id}`].filter(Boolean).join(" · ")}</p>
            </div>
            <button ref={closeRef} type="button" className="sh-icb" onClick={tryClose} aria-label="Close"><HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} /></button>
          </div>

          <div className="ld-stages" role="radiogroup" aria-label="Stage">
            {STAGES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={draft.stage === s.id} className={"ld-stg" + (draft.stage === s.id ? " on" : "")}
                style={{ "--c": s.c, "--c-bg": s.bg } as React.CSSProperties} onClick={() => pickStage(s.id)}>
                <small><i aria-hidden />{s.name}</small><span>{s.pct}%</span>
              </button>
            ))}
          </div>
          <div className="ld-dprog" style={{ "--c": st.c } as React.CSSProperties}>
            <span className="ld-track"><i style={{ width: `${st.pct}%` }} /></span>
            <b>{st.pct}%</b><span>{st.id === "lost" ? "Lost" : st.id === "won" ? "Won" : `${st.name} · progress`}</span>
            {!isNew && !same(draft.stage, base.stage) && <em>Save to apply</em>}
          </div>

          {!isNew && (
            <div className="ld-quick">
              {tel ? <a className="sh-btn sm" href={`tel:${tel}`} onClick={() => touch("call")}><HugeiconsIcon icon={Call02Icon} size={16} strokeWidth={1.8} />Call</a>
                : <span className="sh-btn sm off" title="Add a phone number first" aria-disabled="true"><HugeiconsIcon icon={Call02Icon} size={16} strokeWidth={1.8} />Call</span>}
              {wa ? <a className="sh-btn sm wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" onClick={() => touch("whatsapp")}><HugeiconsIcon icon={WhatsappIcon} size={16} strokeWidth={1.8} />WhatsApp</a>
                : <span className="sh-btn sm off" title="Add a phone number first" aria-disabled="true"><HugeiconsIcon icon={WhatsappIcon} size={16} strokeWidth={1.8} />WhatsApp</span>}
              {mail ? <a className="sh-btn sm" href={`mailto:${mail}`} onClick={() => touch("email")}><HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={1.8} />Email</a>
                : <span className="sh-btn sm off" title="Add an email first" aria-disabled="true"><HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={1.8} />Email</span>}
              {meet && <a className="sh-btn sm" href={meet} target="_blank" rel="noopener noreferrer"><HugeiconsIcon icon={Link04Icon} size={16} strokeWidth={1.8} />Join meeting</a>}
              {isUrl(calendlyUrl) && <CalendlyButton url={calendlyUrl} name={String(draft.name || "")} email={mail} className="sh-btn sm" label="Schedule"
                icon={<HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={1.8} />} />}
            </div>
          )}

          {!isNew && (
            <div className="ld-tabs" role="tablist" aria-label="Lead sections">
              {([["details", "Summary"], ["follow", "Notes"], ["history", "Activity"]] as [Tab, string][]).map(([k, t]) => (
                <button key={k} type="button" role="tab" id={`ld-tab-${k}`} aria-controls={`ld-pane-${k}`} aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                  {t}{k === "details" && dirty && <i className="ld-dirty" aria-label="unsaved changes" />}
                  {k === "follow" && chip && chip.tone !== "grey" && <i className={"ld-tdot " + chip.tone} aria-label={chip.text} />}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="ld-db">
          {err && <div className="ld-err" role="alert"><HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.8} />{err.text}</div>}
          {tab === "details" && (
            <div id="ld-pane-details" role="tabpanel" aria-labelledby={isNew ? undefined : "ld-tab-details"} className="ld-form">
              {draft.stage === "lost" && (
                <div className="ld-field ld-lost">
                  <label htmlFor="ld-lostReason">Why was it lost?</label>
                  <input ref={lostRef} id="ld-lostReason" value={String(draft.lostReason || "")} onChange={(e) => set("lostReason", e.target.value)} placeholder="e.g. Budget, went with another agency" />
                  <div className="ld-chips">{LOST_REASONS.map((r) => <button key={r} type="button" className={"ld-qchip" + (draft.lostReason === r ? " on" : "")} onClick={() => set("lostReason", r)}>{r}</button>)}</div>
                </div>
              )}
              <div className="ld-fsec">Contact</div>
              <div className="ld-frow">
                <div className={"ld-field" + fe("name")}><label htmlFor="ld-name">Contact name</label>
                  <input ref={nameRef} id="ld-name" value={String(draft.name || "")} onChange={(e) => set("name", e.target.value)} placeholder="Full name" autoComplete="off" aria-invalid={err?.field === "name" || undefined} /></div>
                <div className="ld-field"><label htmlFor="ld-company">Company</label>
                  <input id="ld-company" value={String(draft.company || "")} onChange={(e) => set("company", e.target.value)} placeholder="Company name" /></div>
              </div>
              <div className="ld-field"><label htmlFor="ld-purpose">Purpose</label>
                <input id="ld-purpose" value={String(draft.purpose || "")} onChange={(e) => set("purpose", e.target.value)} placeholder="e.g. CRM Build, SaaS Revamp" /></div>
              <div className="ld-frow">
                <div className={"ld-field" + fe("email")}><label htmlFor="ld-email">Email</label>
                  <input id="ld-email" type="email" inputMode="email" value={String(draft.email || "")} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" /></div>
                <div className="ld-field"><label htmlFor="ld-phone">Phone</label>
                  <input id="ld-phone" type="tel" inputMode="tel" value={String(draft.phone || "")} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98200 11223" /></div>
              </div>

              <div className="ld-fsec">Deal</div>
              <div className="ld-frow">
                <div className="ld-field"><label htmlFor="ld-value">Estimated value (₹)</label>
                  <input id="ld-value" type="number" min={0} step={1000} inputMode="numeric" value={draft.value === null || draft.value === undefined ? "" : String(draft.value)}
                    onChange={(e) => set("value", e.target.value === "" ? null : Number(e.target.value))} placeholder="e.g. 25000" /></div>
                <div className="ld-field"><label htmlFor="ld-owner">Owner (BD)</label>
                  <Select id="ld-owner" value={String(draft.owner || "")} onChange={(v) => set("owner", v)} options={ownerOpts} placeholder="Assign a team member" ariaLabel="Owner" /></div>
              </div>
              <div className="ld-frow">
                <div className="ld-field"><label htmlFor="ld-source">Source</label>
                  <Select id="ld-source" value={String(draft.source || "")} onChange={(v) => set("source", v)} options={SOURCES} ariaLabel="Source" /></div>
                <div className="ld-field"><label htmlFor="ld-priority">Priority</label>
                  <Select id="ld-priority" value={String(draft.priority || "")} onChange={(v) => set("priority", v)} options={PRIORITIES.map((p) => ({ value: p, label: cap(p) }))} ariaLabel="Priority" /></div>
              </div>

              <details className="ld-form-section"><summary>Follow-up &amp; meeting{draft.nextFollowUpAt ? ` · ${String(draft.nextFollowUpAt).slice(0,10)}` : ""}</summary>
              <div className="ld-frow">
                <div className="ld-field"><label htmlFor="ld-next">Next follow-up</label>
                  <DatePicker id="ld-next" value={String(draft.nextFollowUpAt || "").slice(0, 10)} onChange={(v) => set("nextFollowUpAt", v)} placeholder="Pick a date" />
                  {draft.nextFollowUpAt && <button type="button" className="sh-link muted ld-clear" onClick={() => set("nextFollowUpAt", null)}>Clear date</button>}</div>
                <div className="ld-field"><label htmlFor="ld-meetat">Meeting time</label>
                  <input id="ld-meetat" type="datetime-local" value={toLocalInput(draft.meetingAt)} onChange={(e) => set("meetingAt", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
              </div>
              <div className="ld-field"><label htmlFor="ld-funote">Follow-up note</label>
                <input id="ld-funote" value={String(draft.followUpNote || "")} onChange={(e) => set("followUpNote", e.target.value)} placeholder="What to do next, e.g. Send the revised quote" /></div>
              <div className="ld-field"><label htmlFor="ld-meeturl">Meeting link</label>
                <div className="ld-linkrow">
                  <input id="ld-meeturl" type="url" inputMode="url" value={String(draft.meetingUrl || "")} onChange={(e) => set("meetingUrl", e.target.value)} placeholder="https://meet.google.com/… or your Calendly link" />
                  {meet && <a className="sh-btn" href={meet} target="_blank" rel="noopener noreferrer">Open</a>}
                </div></div>
              {!isNew && (
                <div className="ld-field"><span className="ld-lbl">Last contacted</span>
                  <div className="ld-readonly">{lead?.lastContactedAt ? <><b>{relative(lead.lastContactedAt)}</b><span>{whenOf(lead.lastContactedAt)}</span></> : <span>Not contacted yet — log a call or message in Notes</span>}</div></div>
              )}
              </details>
              {isNew && <div className="ld-field"><label htmlFor="ld-notes">Notes</label>
                <textarea id="ld-notes" rows={4} value={String(draft.notes || "")} onChange={(e) => set("notes", e.target.value)} placeholder="Context, next steps, objections…" /></div>}
              {isNew && calendlyUrl && (
                <div className="ld-field"><span className="ld-lbl">Meeting</span>
                  <CalendlyButton url={calendlyUrl} name={String(draft.name || "")} email={mail} className="sh-btn" label="Schedule with Calendly"
                    icon={<HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={1.8} />} /></div>
              )}
            </div>
          )}

          {tab === "follow" && lead && (
            <div id="ld-pane-follow" role="tabpanel" aria-labelledby="ld-tab-follow" className="ld-form">
              <div className="ld-field"><label htmlFor="ld-notes">Lead notes</label><textarea id="ld-notes" rows={3} value={String(draft.notes || "")} onChange={(e) => set("notes", e.target.value)} placeholder="Context, next steps, objections…" /><small>Save to apply changes to these notes. Contact logs below save separately.</small></div>
              <h3 className="ld-notes-heading">Log a conversation &amp; next step</h3>
              <LeadTouchPanel key={lead.id} lead={{ ...lead, ...draft, id: lead.id }} showContact={false} preset={preset}
                patch={(v) => {
                  setBase((b) => ({ ...b, ...v })); setDraft((d) => ({ ...d, ...v }));
                  onPatched(lead.id, v as Partial<LeadRow>); setHistKey((k) => k + 1);
                }}
                reload={async () => { /* the row is patched in place — no list reload */ }} />
            </div>
          )}

          {tab === "history" && lead && (
            <div id="ld-pane-history" role="tabpanel" aria-labelledby="ld-tab-history">
              <HistoryList entity="lead" id={lead.id} open refreshKey={histKey} />
            </div>
          )}
        </div>

        <footer className="ld-df">
          {!isNew && <button type="button" className="sh-btn ld-danger" disabled={saving} onClick={remove}><HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />Delete</button>}
          <span className="ld-sp" />
          {!isNew && dirty && <span className="ld-unsaved">Unsaved changes</span>}
          <button type="button" className="sh-btn" onClick={tryClose}>{dirty || isNew ? "Cancel" : "Close"}</button>
          <button type="button" className="sh-btn pri" onClick={save} disabled={saving || (!isNew && !dirty)}>
            {saving ? <><span className="spin" aria-hidden /> Saving…</> : <><HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} />{isNew ? "Add lead" : "Save"}</>}
          </button>
        </footer>
      </aside>
    </>
  );
}
