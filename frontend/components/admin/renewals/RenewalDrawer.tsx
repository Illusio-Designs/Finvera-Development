"use client";
/* The renewal drawer (also "Add renewal"): client / project, status, quick
   actions (Renewed, Terminate / Restore, call, WhatsApp, email) and three
   tabs — Details (every field, Save sends only what changed), Remarks (the
   dated remarks log, add a remark) and History (the activity log). */
import { useEffect, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon, Call02Icon, WhatsappIcon, Mail01Icon, Delete02Icon, Tick02Icon, Alert02Icon, Refresh01Icon, Note01Icon,
  CheckmarkCircle02Icon, StopCircleIcon, PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import { api, renewalsApi, type RenewalRow } from "@/lib/adminApi";
import Select from "@/components/Select";
import DatePicker from "@/components/ui/DatePicker";
import HistoryList from "@/components/admin/HistoryList";
import { initials, avatarColor } from "@/lib/activityText";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import { contactLinks } from "./RenewalViews";
import { CYCLES, STATUSES, cycleOf, inr, yearlyValue, parseRemarks, remarkLine, prependRemark, dueChip, fmtDay, label, istToday, type Remark } from "./renewalKit";

type Tab = "details" | "remarks" | "history";
type Draft = Partial<RenewalRow> & Record<string, unknown>;
const EDITABLE = ["client", "project", "amount", "cycle", "renewalDate", "lastInvoiced", "status", "owner", "email", "phone", "notes", "position"] as const;
const norm = (v: unknown) => (v === "" || v === undefined ? null : v);
const same = (a: unknown, b: unknown) => String(norm(a) ?? "") === String(norm(b) ?? "");
const sameKey = (k: string, a: unknown, b: unknown) => (k === "renewalDate" || k === "lastInvoiced" ? String(a || "").slice(0, 10) === String(b || "").slice(0, 10) : same(a, b));

export const NEW_RENEWAL: Draft = { cycle: "yearly", status: "active", amount: null, position: 0 };
export type DrawerAction = "renew" | "end" | "restore";

function RemarkItem({ m }: { m: Remark }) {
  const icon = m.kind === "renewed" ? CheckmarkCircle02Icon : m.kind === "terminated" ? StopCircleIcon : Note01Icon;
  return (
    <li className={"rn-tl " + m.kind}>
      <span className="rn-tl-ic" aria-hidden><HugeiconsIcon icon={icon} size={15} strokeWidth={1.9} /></span>
      <div className="rn-tl-b">
        {m.kind === "text" ? <p>{m.text}</p> : (
          <>
            <small><b>{m.what}</b>{m.date ? ` · ${m.date}` : ""}{m.by ? ` · ${m.by}` : ""}</small>
            {m.text ? <p>{m.text}</p> : <p className="rn-muted">No remark</p>}
          </>
        )}
      </div>
    </li>
  );
}

export default function RenewalDrawer({ row, me, initialTab = "details", onClose, onSaved, onPatched, onDeleted, onAction }: {
  row: RenewalRow | null; me: string; initialTab?: Tab;
  onClose: () => void;
  onSaved: (row: RenewalRow, isNew: boolean, before: RenewalRow | null) => void;
  /* A remark was added (saved on the server already); the drawer stays open. */
  onPatched: (row: RenewalRow) => void;
  onDeleted: (r: RenewalRow) => void;
  /* Renewed / Terminate / Restore through the page (dialogs, Undo); resolves with the saved row or null. */
  onAction: (kind: DrawerAction, row: RenewalRow) => Promise<RenewalRow | null>;
}) {
  const isNew = !row;
  const [base, setBase] = useState<Draft>(() => (row ? { ...row } : { ...NEW_RENEWAL }));
  const [draft, setDraft] = useState<Draft>(base);
  const [tab, setTab] = useState<Tab>(isNew ? "details" : initialTab);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<{ text: string; field?: string } | null>(null);
  const [conflict, setConflict] = useState(false);
  const [histKey, setHistKey] = useState(0);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [firstRemark, setFirstRemark] = useState("");
  const [newRemark, setNewRemark] = useState("");
  const [addingRemark, setAddingRemark] = useState(false);
  const [rawNotes, setRawNotes] = useState(false);
  const clientRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { api.listUsers().then((u: unknown) => setUsers(Array.isArray(u) ? u : [])).catch(() => {}); }, []);
  useEffect(() => { (isNew ? clientRef.current : closeRef.current)?.focus({ preventScroll: true }); }, [isNew]);

  const dirtyKeys = useMemo(() => EDITABLE.filter((k) => !sameKey(k, draft[k], base[k])), [draft, base]);
  const dirty = isNew ? !!String(draft.client || "").trim() || !!firstRemark.trim() || dirtyKeys.some((k) => !["cycle", "status", "position"].includes(k)) : dirtyKeys.length > 0;
  const set = (k: string, v: unknown) => { if (saving || addingRemark) return; setDraft((d) => ({ ...d, [k]: v })); if (err?.field === k) setErr(null); };

  async function tryClose() {
    if (saving || addingRemark) return;
    if (dirty || newRemark.trim()) {
      const ok = await dialog.confirm({ title: isNew ? "Discard this renewal?" : "Discard your changes?", message: isNew ? "It hasn't been added yet." : "The changes you made here haven't been saved.", confirmText: "Discard", cancelText: "Keep editing", danger: true });
      if (!ok) return;
    }
    onClose();
  }
  const tryCloseRef = useRef(tryClose);
  tryCloseRef.current = tryClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || document.querySelector(".adm-overlay, .rn-dlg-scrim, .rn-menu")) return; // a dialog / menu on top handles its own Escape
      tryCloseRef.current();
    };
    document.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, []);

  /* A row came back from the server (save, Renewed, remark…): it is the new baseline;
     fields the person is still editing keep their edits. */
  function adopt(saved: RenewalRow, keepEdits = true) {
    setBase({ ...saved });
    setDraft((d) => {
      if (!keepEdits) return { ...saved };
      const next: Draft = { ...saved };
      for (const k of EDITABLE) if (!sameKey(k, d[k], base[k])) (next as Record<string, unknown>)[k] = d[k];
      return next;
    });
    setHistKey((k) => k + 1);
  }

  async function save() {
    if (saving || addingRemark) return;
    const client = String(draft.client || "").trim();
    if (!client) { setTab("details"); setErr({ text: "Add the client or company name.", field: "client" }); clientRef.current?.focus(); return; }
    const email = String(draft.email || "").trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { setTab("details"); setErr({ text: "That billing email doesn't look right.", field: "email" }); return; }
    const amt = draft.amount === null || draft.amount === undefined || String(draft.amount) === "" ? null : Number(draft.amount);
    if (amt !== null && (!isFinite(amt) || amt < 0)) { setTab("details"); setErr({ text: "The amount should be a number of rupees.", field: "amount" }); return; }
    setSaving(true); setErr(null);
    try {
      const keys = isNew ? EDITABLE.filter((k) => norm(draft[k]) !== null) : dirtyKeys;
      const body: Record<string, unknown> = {};
      for (const k of keys) body[k] = norm(typeof draft[k] === "string" && k !== "notes" ? String(draft[k]).trim() || null : draft[k]);
      if (isNew || "client" in body) body.client = client;
      if ("amount" in body) body.amount = Math.max(0, Math.round(Number(body.amount) || 0));
      if ("position" in body) body.position = Math.round(Number(body.position) || 0);
      if (isNew && firstRemark.trim()) body.notes = remarkLine("Note", me, firstRemark);
      const saved = isNew ? await renewalsApi.create(body as Partial<RenewalRow>) : await renewalsApi.update(row!.id, { ...body, expected: base } as Partial<RenewalRow> & { expected: Partial<RenewalRow> });
      adopt(saved, false);
      onSaved(saved, isNew, row);
    } catch (e) {
      const ex = e as Error & { field?: string };
      setConflict((e as { status?: number }).status === 409);
      setErr({ text: ex.message || "Couldn't save.", field: ex.field });
      toast("Couldn't save the renewal", "err", { description: ex.message });
    } finally { setSaving(false); }
  }

  async function reloadSaved() {
    if (!row || !(await dialog.confirm({ title: "Reload this renewal?", message: "This replaces your unsaved edits with the latest saved values.", confirmText: "Reload", cancelText: "Keep editing" }))) return;
    try { const latest = await renewalsApi.get(row.id); adopt(latest, false); onPatched(latest); setErr(null); setConflict(false); } catch (e) { setErr({ text: e instanceof Error ? e.message : "Couldn't reload." }); }
  }
  async function addRemark() {
    if (!row || !newRemark.trim() || addingRemark || saving) return;
    setAddingRemark(true);
    try {
      const saved = await renewalsApi.remark(row.id, newRemark);
      adopt(saved);
      setNewRemark("");
      onPatched(saved);
      toast("Remark added", "ok", { description: label(saved) });
    } catch (e) {
      setErr({ text: e instanceof Error ? e.message : "Couldn’t add the remark." });
      toast("Couldn't add the remark", "err", { description: e instanceof Error ? e.message : "Try again." });
    } finally { setAddingRemark(false); }
  }

  async function act(kind: DrawerAction) {
    if (!row || saving || addingRemark) return;
    if (dirty) { toast("Save or discard your changes first", "warn", { description: "Then mark it renewed or terminated." }); return; }
    const saved = await onAction(kind, { ...row, ...base } as RenewalRow);
    if (saved) adopt(saved, false);
  }

  async function remove() {
    if (!row) return;
    const ok = await dialog.confirm({ title: `Delete ${label(row)}?`, message: "The renewal, its remarks and its reminders are removed for everyone. This can't be undone — to stop it renewing, Terminate keeps the record.", confirmText: "Delete renewal", danger: true });
    if (!ok) return;
    try { await renewalsApi.remove(row.id); onDeleted(row); }
    catch (e) { toast("Couldn't delete it", "err", { description: e instanceof Error ? e.message : "Try again." }); }
  }

  const c = contactLinks(draft as RenewalRow);
  const remarks = useMemo(() => parseRemarks(String(draft.notes || "")), [draft.notes]);
  const ownerOpts = users.map((u) => ({ value: u.name, label: u.name }));
  if (draft.owner && !ownerOpts.some((o) => o.value === draft.owner)) ownerOpts.unshift({ value: String(draft.owner), label: String(draft.owner) });
  ownerOpts.unshift({ value: "", label: "Unassigned" });
  const fe = (k: string) => (err?.field === k ? " bad" : "");
  const chip = row ? dueChip({ ...row, ...base } as RenewalRow) : null;
  const notesDirty = !isNew && !same(draft.notes, base.notes);
  const cyc = cycleOf(String(draft.cycle));
  const title = String(draft.client || "").trim() || (isNew ? "New renewal" : row!.client);
  const ended = base.status === "cancelled";

  return (
    <>
      <div className="rn-scrim" onMouseDown={tryClose} aria-hidden />
      <aside className="rn-drawer renewal-detail" role="dialog" aria-modal="true" aria-labelledby="rn-dtitle">
        <header className="rn-dh">
          <div className="rn-dh-top">
            <i className="rn-av lg" style={{ background: avatarColor(title) }} aria-hidden>{initials(isNew && !draft.client ? "+" : title)}</i>
            <div className="rn-dh-tx">
              <h2 id="rn-dtitle">{title}</h2>
              <p>{isNew ? "Track a recurring invoice for a client." : [draft.project, Number(draft.amount) ? `${inr(Number(draft.amount))} ${cyc.name.toLowerCase()}` : "", `#${row!.id}`].filter(Boolean).join(" · ")}</p>
            </div>
            <button ref={closeRef} type="button" className="sh-icb" onClick={tryClose} aria-label="Close"><HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} /></button>
          </div>

          {!isNew && (
            <div className="rn-dsum">
              <span><small>Next renewal</small><b>{base.renewalDate ? fmtDay(String(base.renewalDate)) : "No date"}</b>{chip && <span className={"sh-pill nodot " + chip.tone}>{chip.text}</span>}</span>
              <span><small>Last renewed</small><b>{base.lastInvoiced ? fmtDay(String(base.lastInvoiced)) : "—"}</b></span>
              <span><small>Owner</small><b>{base.owner || "Unassigned"}</b></span>
            </div>
          )}

          {!isNew && (
            <div className="rn-quick">
              {ended ? (
                <button type="button" className="sh-btn sm" onClick={() => act("restore")}><HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />Restore</button>
              ) : (
                <>
                  <button type="button" className="sh-btn sm rn-ok" onClick={() => act("renew")}><HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2} />Renewed</button>
                  <button type="button" className="sh-btn sm rn-end" onClick={() => act("end")}>Terminate</button>
                </>
              )}
              {c.tel ? <a className="sh-btn sm" href={c.tel}><HugeiconsIcon icon={Call02Icon} size={16} strokeWidth={1.8} />Call</a>
                : <span className="sh-btn sm off" title="Add a phone number first" aria-disabled="true"><HugeiconsIcon icon={Call02Icon} size={16} strokeWidth={1.8} />Call</span>}
              {c.wa ? <a className="sh-btn sm rn-wa" href={c.wa} target="_blank" rel="noopener noreferrer"><HugeiconsIcon icon={WhatsappIcon} size={16} strokeWidth={1.8} />WhatsApp</a>
                : <span className="sh-btn sm off" title="Add a phone number first" aria-disabled="true"><HugeiconsIcon icon={WhatsappIcon} size={16} strokeWidth={1.8} />WhatsApp</span>}
              {c.mail ? <a className="sh-btn sm" href={c.mail}><HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={1.8} />Email</a>
                : <span className="sh-btn sm off" title="Add a billing email first" aria-disabled="true"><HugeiconsIcon icon={Mail01Icon} size={16} strokeWidth={1.8} />Email</span>}
            </div>
          )}

          {!isNew && (
            <div className="rn-tabs" role="tablist" aria-label="Renewal sections">
              {([["details", "Summary"], ["remarks", "Remarks"], ["history", "Activity"]] as [Tab, string][]).map(([k, t]) => (
                <button key={k} type="button" role="tab" id={`rn-tab-${k}`} aria-controls={`rn-pane-${k}`} aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                  {t}
                  {k === "remarks" && remarks.length > 0 && <em className="rn-tcount">{remarks.length}</em>}
                  {k === "details" && dirtyKeys.some((x) => x !== "notes") && <i className="rn-dirty" aria-label="unsaved changes" />}
                  {k === "remarks" && notesDirty && <i className="rn-dirty" aria-label="unsaved changes" />}
                </button>
              ))}
            </div>
          )}
        </header>

        <div className="rn-db">
          {err && <div className="rn-err" role="alert">{err.text}{conflict && <button type="button" className="sh-btn sm" onClick={reloadSaved}>Reload saved record</button>}</div>}
          {tab === "details" && (
            <div id="rn-pane-details" role="tabpanel" aria-labelledby={isNew ? undefined : "rn-tab-details"} className="rn-form">
              <div className="rn-fsec">Client</div>
              <div className="rn-frow">
                <div className={"rn-field" + fe("client")}><label htmlFor="rn-client">Client / company</label>
                  <input ref={clientRef} id="rn-client" value={String(draft.client || "")} onChange={(e) => set("client", e.target.value)} placeholder="e.g. Crosscoin" autoComplete="off" aria-invalid={err?.field === "client" || undefined} /></div>
                <div className="rn-field"><label htmlFor="rn-project">Project / service</label>
                  <input id="rn-project" value={String(draft.project || "")} onChange={(e) => set("project", e.target.value)} placeholder="e.g. Website maintenance, Hosting" /></div>
              </div>
              <div className="rn-frow">
                <div className={"rn-field" + fe("email")}><label htmlFor="rn-email">Billing email</label>
                  <input id="rn-email" type="email" inputMode="email" value={String(draft.email || "")} onChange={(e) => set("email", e.target.value)} placeholder="accounts@client.com" /></div>
                <div className="rn-field"><label htmlFor="rn-phone">Phone</label>
                  <input id="rn-phone" type="tel" inputMode="tel" value={String(draft.phone || "")} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98200 11223" /></div>
              </div>

              <div className="rn-fsec">Billing</div>
              <div className="rn-frow">
                <div className={"rn-field" + fe("amount")}><label htmlFor="rn-amount">Renewal amount (₹)</label>
                  <input id="rn-amount" type="number" min={0} step={500} inputMode="numeric" value={draft.amount === null || draft.amount === undefined ? "" : String(draft.amount)}
                    onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))} placeholder="e.g. 15000" /></div>
                <div className="rn-field"><label htmlFor="rn-cycle">Billing cycle</label>
                  <Select id="rn-cycle" value={String(draft.cycle || "yearly")} onChange={(v) => set("cycle", v)} options={CYCLES.map((x) => ({ value: x.id, label: `${x.name} · every ${x.months === 1 ? "month" : x.months === 12 ? "year" : `${x.months} months`}` }))} ariaLabel="Billing cycle" /></div>
              </div>
              <div className="rn-frow">
                <div className="rn-field"><label htmlFor="rn-date">Next renewal date</label>
                  <DatePicker id="rn-date" value={String(draft.renewalDate || "").slice(0, 10)} onChange={(v) => set("renewalDate", v)} placeholder="Pick a date" />
                  {!!draft.renewalDate && <button type="button" className="sh-link muted rn-clear" onClick={() => set("renewalDate", null)}>Clear date</button>}</div>
                <div className="rn-field"><label htmlFor="rn-last">Last renewed on</label>
                  <DatePicker id="rn-last" value={String(draft.lastInvoiced || "").slice(0, 10)} onChange={(v) => set("lastInvoiced", v)} placeholder="Pick a date" />
                  {!!draft.lastInvoiced && <button type="button" className="sh-link muted rn-clear" onClick={() => set("lastInvoiced", null)}>Clear date</button>}</div>
              </div>
              {Number(draft.amount) > 0 && <p className="rn-hint">{inr(Number(draft.amount))} {cyc.name.toLowerCase()} = <b>{inr(yearlyValue(draft as RenewalRow))}</b> a year.</p>}

              <div className="rn-fsec">Ownership</div>
              <div className="rn-frow">
                <div className="rn-field"><label htmlFor="rn-owner">Owner</label>
                  <Select id="rn-owner" value={String(draft.owner || "")} onChange={(v) => set("owner", v || null)} options={ownerOpts} placeholder="Assign a team member" ariaLabel="Owner" /></div>
                <div className="rn-field"><span className="rn-lbl" id="rn-status-l">Status</span>
                  <div className="rn-seg rn-seg-full" role="radiogroup" aria-labelledby="rn-status-l">
                    {STATUSES.map((x) => <button key={x.id} type="button" role="radio" aria-checked={draft.status === x.id} className={x.tone} onClick={() => set("status", x.id)}><i aria-hidden />{x.name}</button>)}
                  </div></div>
              </div>
              {!isNew && draft.status === "cancelled" && base.status !== "cancelled" && <p className="rn-hint">Tip: <b>Terminate</b> at the top also notes why it ended.</p>}
              <div className="rn-frow">
                <div className="rn-field"><label htmlFor="rn-pos">Order <small className="rn-muted">(same-day sort)</small></label>
                  <input id="rn-pos" type="number" step={1} value={draft.position === null || draft.position === undefined ? "" : String(draft.position)} onChange={(e) => set("position", e.target.value === "" ? 0 : Number(e.target.value))} /></div>
              </div>

              {isNew && (
                <>
                  <div className="rn-fsec">Remark</div>
                  <div className="rn-field"><label htmlFor="rn-first">First remark <small className="rn-muted">(optional)</small></label>
                    <textarea id="rn-first" rows={3} value={firstRemark} onChange={(e) => setFirstRemark(e.target.value)} placeholder="Scope, invoice terms, anything to remember. Renewed / Terminate add a dated line here." /></div>
                </>
              )}
            </div>
          )}

          {tab === "remarks" && row && (
            <div id="rn-pane-remarks" role="tabpanel" aria-labelledby="rn-tab-remarks" className="rn-form">
              <div className="rn-addrm">
                <label htmlFor="rn-newrm" className="rn-lbl">Add a remark</label>
                <textarea id="rn-newrm" rows={2} value={newRemark} onChange={(e) => setNewRemark(e.target.value)} placeholder="e.g. Called accounts, payment promised by Wednesday" maxLength={1000} disabled={notesDirty}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addRemark(); } }} />
                <div className="rn-addrm-f">
                  <small className="rn-muted">{notesDirty ? "Save or undo your text edits below first." : `Saved straight away as “${fmtDay(istToday())} · Note · ${me || "you"}”.`}</small>
                  <button type="button" className="sh-btn sm pri" onClick={addRemark} disabled={!newRemark.trim() || addingRemark || notesDirty}>
                    {addingRemark ? <span className="spin rn-spin light" aria-hidden /> : <HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2} />}Add remark
                  </button>
                </div>
              </div>
              {remarks.length ? <ol className="rn-tline">{remarks.map((m, i) => <RemarkItem key={i} m={m} />)}</ol>
                : <div className="sh-empty rn-empty-sm"><HugeiconsIcon icon={Note01Icon} size={20} strokeWidth={1.8} className="hgi" /><b>No remarks yet</b><span>Renewed and Terminate add a dated line here, with who did it.</span></div>}
              <div className="rn-raw">
                <button type="button" className="sh-link muted" onClick={() => setRawNotes((v) => !v)} aria-expanded={rawNotes}><HugeiconsIcon icon={PencilEdit02Icon} size={14} strokeWidth={1.8} />{rawNotes ? "Hide the text" : "Edit the remarks as text"}</button>
                {rawNotes && (
                  <div className="rn-field">
                    <label htmlFor="rn-notes" className="sh-sr">Remarks text</label>
                    <textarea id="rn-notes" rows={7} value={String(draft.notes || "")} onChange={(e) => set("notes", e.target.value)} />
                    {notesDirty && <button type="button" className="sh-link muted rn-clear" onClick={() => set("notes", base.notes ?? null)}>Undo text edits</button>}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "history" && row && (
            <div id="rn-pane-history" role="tabpanel" aria-labelledby="rn-tab-history">
              <HistoryList entity="renewal" id={row.id} open refreshKey={histKey} />
            </div>
          )}
        </div>

        <footer className="rn-df">
          {!isNew && <button type="button" className="sh-btn rn-danger" disabled={saving || addingRemark} onClick={remove}><HugeiconsIcon icon={Delete02Icon} size={16} strokeWidth={1.8} />Delete</button>}
          <span className="rn-sp" />
          {!isNew && dirty && <span className="rn-unsaved">Unsaved changes</span>}
          <button type="button" className="sh-btn" onClick={tryClose}>{dirty || isNew ? "Cancel" : "Close"}</button>
          <button type="button" className="sh-btn pri" onClick={save} disabled={saving || addingRemark || (!isNew && !dirty)}>
            {saving ? <><span className="spin rn-spin light" aria-hidden /> Saving…</> : <><HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} />{isNew ? "Add renewal" : "Save"}</>}
          </button>
        </footer>
      </aside>
    </>
  );
}

