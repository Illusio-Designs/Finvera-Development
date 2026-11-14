"use client";
import { WorkspaceHero } from "@/components/admin/Workspace";
import PageLoading from "@/components/admin/PageLoading";
/* Renewals — recurring maintenance / hosting / retainer invoices.
   One request for the data (GET /api/renewals); totals, filters and the
   month-by-month timeline are worked out here. Renewed moves the next date on
   one billing cycle (POST /renewals/:id/renew), Terminate stops it
   (POST /renewals/:id/terminate); both add a dated remark and offer Undo,
   which puts the previous values back with a PUT. `?renewal=ID` (home page,
   notifications) opens that renewal. */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon, Search01Icon, Download04Icon, Alert02Icon, Refresh01Icon, Cancel01Icon, Clock01Icon, RupeeIcon, StopCircleIcon,
  Calendar03Icon, Table02Icon, RepeatIcon,
} from "@hugeicons/core-free-icons";
import { api, renewalsApi, type RenewalRow } from "@/lib/adminApi";
import { exportToExcel } from "@/components/admin/ExportButton";
import Select from "@/components/Select";
import { Timeline, RenewalTable, type RowHandlers } from "@/components/admin/renewals/RenewalViews";
import RenewalDrawer, { type DrawerAction } from "@/components/admin/renewals/RenewalDrawer";
import { RenewDialog, EndDialog, type RenewChoice } from "@/components/admin/renewals/RenewalDialogs";
import {
  CYCLES, STATUSES, cycleOf, inr, inrShort, sumAmount, yearlyValue, day10, daysBetween, fmtDay, label, remarkLine, prependRemark, istToday, addDays,
} from "@/components/admin/renewals/renewalKit";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";
import "./renewals.css";
import "./renewals-workspace.css";

type View = "timeline" | "table";
const VIEW_KEY = "fv-renewals-view";
const readView = (): View => { try { return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "timeline"; } catch { return "timeline"; } };
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const msg = (e: unknown, fb = "Try again.") => (e instanceof Error ? e.message : fb);

function Renewals() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("renewal");

  const [rows, setRows] = useState<RenewalRow[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("timeline");
  const [scope, setScope] = useState<"all" | "soon" | "overdue" | "history">("all");
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fCycle, setFCycle] = useState("");
  const [drawer, setDrawer] = useState<{ row: RenewalRow | null; key: number } | null>(null);
  const [renewDlg, setRenewDlg] = useState<{ row: RenewalRow; resolve: (v: RenewChoice | null) => void } | null>(null);
  const [endDlg, setEndDlg] = useState<{ row: RenewalRow; resolve: (v: string | null) => void } | null>(null);
  const [busy, setBusy] = useState<Set<number>>(new Set());
  const [me, setMe] = useState("");
  const rowsRef = useRef<RenewalRow[]>([]);
  rowsRef.current = rows || [];
  const today = istToday();

  useEffect(() => { setView(readView()); }, []);
  const pickView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };
  useEffect(() => { api.me().then((r: { user?: { name?: string }; name?: string }) => setMe((r?.user ?? r)?.name || "")).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setError("");
    try { const r = await renewalsApi.list(); setRows(Array.isArray(r) ? r : []); }
    catch (e) { setError(msg(e, "Couldn't load the renewals.")); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Deep link: open the renewal once the list is here. */
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!openId) { opened.current = null; return; }
    if (!rows || opened.current === openId) return;
    opened.current = openId;
    const r = rows.find((x) => String(x.id) === openId);
    if (r) setDrawer({ row: r, key: Date.now() });
    else toast("That renewal isn't in the list any more", "warn", { description: "It may have been deleted." });
    router.replace("/dashboard/renewals", { scroll: false });
  }, [openId, rows, router]);

  const patchRow = (row: RenewalRow) => setRows((rs) => (rs ? rs.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : rs));
  const setBusyId = (id: number, on: boolean) => setBusy((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
  /* The drawer shows a row that changed underneath it (Undo): reopen it on the new values. */
  const refreshDrawer = (row: RenewalRow) => setDrawer((d) => (d && d.row?.id === row.id ? { row, key: Date.now() } : d));

  /* ── totals (all rows, not the filtered ones) ── */
  const all = rows || [];
  const totals = useMemo(() => {
    const act = all.filter((r) => r.status === "active");
    const dated = act.filter((r) => day10(r.renewalDate));
    const over = dated.filter((r) => day10(r.renewalDate) < today);
    const due = dated.filter((r) => { const n = daysBetween(today, day10(r.renewalDate)); return n >= 0 && n <= 14; });
    const ended = all.filter((r) => r.status === "cancelled"), paused = all.filter((r) => r.status === "paused");
    return {
      over: over.length, overSum: sumAmount(over), due: due.length, dueSum: sumAmount(due),
      yearly: act.reduce((a, r) => a + yearlyValue(r), 0), active: act.length,
      ended: ended.length, endedYearly: ended.reduce((a, r) => a + yearlyValue(r), 0), paused: paused.length,
    };
  }, [all, today]);

  /* ── filters ── */
  const owners = useMemo(() => [...new Set(all.map((r) => r.owner).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [all]);
  const effectiveStatus = scope === "history" ? "cancelled" : scope === "soon" || scope === "overdue" ? "active" : fStatus;
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => all.filter((r) =>
    (!needle || [r.client, r.project, r.owner, r.email].join(" ").toLowerCase().includes(needle))
    && (!effectiveStatus || r.status === effectiveStatus)
    && (scope !== "soon" || (!!day10(r.renewalDate) && day10(r.renewalDate) >= today && day10(r.renewalDate) <= addDays(today, 14)))
    && (scope !== "overdue" || (!!day10(r.renewalDate) && day10(r.renewalDate) < today))
    && (!fOwner || (fOwner === "__none" ? !r.owner : r.owner === fOwner))
    && (!fCycle || r.cycle === fCycle)), [all, needle, effectiveStatus, fOwner, fCycle, scope, today]);
  const filtering = !!(needle || fStatus || fOwner || fCycle || scope !== "all");
  const clearFilters = () => { setQ(""); setFStatus(""); setFOwner(""); setFCycle(""); setScope("all"); };
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.id, all.filter((r) => r.status === s.id).length])), [all]);

  const [exporting, setExporting] = useState(false);
  async function doExport() {
    setExporting(true);
    try {
      const r = await exportToExcel("renewals", { q: q.trim() || undefined, status: effectiveStatus || undefined, from: scope === "soon" ? today : undefined, to: scope === "soon" ? addDays(today, 14) : scope === "overdue" ? addDays(today, -1) : undefined, owner: fOwner || undefined, cycle: fCycle || undefined }, { file: "renewals", sheet: "Renewals" });
      if (!r.total) toast("Nothing to export", "info", { description: "No renewals match the current filters — the file has only the headings." });
      else toast(`Exported ${plural(r.total, "renewal")}`, "ok", { description: r.truncated ? `${r.file} · only the first 20,000 rows` : r.file });
    } catch (e) {
      toast("Couldn't export", "err", { description: msg(e, "Try again in a moment.") });
    } finally { setExporting(false); }
  }

  const actionPending = useRef(new Set<number>());
  /* ── Renewed / Terminate / Restore (each with Undo) ── */
  async function revert(before: RenewalRow, expected: RenewalRow, fields: (keyof RenewalRow)[], what: string) {
    const body: Partial<RenewalRow> = {};
    for (const f of fields) (body as Record<string, unknown>)[f] = before[f] ?? null;
    try {
      const saved = await renewalsApi.update(before.id, { ...body, expected });
      patchRow(saved); refreshDrawer(saved);
      toast(what, "info", { description: label(saved) });
    } catch (e) {
      toast("Couldn't undo", "err", { description: msg(e, "Reload the page and check the renewal.") });
      load();
    }
  }

  async function renew(row: RenewalRow): Promise<RenewalRow | null> {
    if (actionPending.current.has(row.id)) return null;
    actionPending.current.add(row.id);
    const choice = await new Promise<RenewChoice | null>((resolve) => setRenewDlg({ row, resolve }));
    setRenewDlg(null);
    if (!choice) { actionPending.current.delete(row.id); return null; }
    const before = rowsRef.current.find((r) => r.id === row.id) || row;
    setBusyId(row.id, true);
    try {
      const saved = await renewalsApi.renew(row.id, { expected: row, remark: choice.remark, invoiced: choice.invoiced, ...(choice.picked ? { renewalDate: choice.renewalDate } : {}) });
      patchRow(saved);
      toast(`Renewed · next ${fmtDay(saved.renewalDate)}`, "ok", {
        description: `${label(saved)}${choice.remark ? ` · ${choice.remark}` : ""}`, duration: 8000,
        action: { label: "Undo", onClick: () => revert(before, saved, ["renewalDate", "lastInvoiced", "status", "notes"], `Renewal undone · back to ${before.renewalDate ? fmtDay(before.renewalDate) : "no date"}`) },
      });
      return saved;
    } catch (e) {
      toast("Couldn't mark it renewed", "err", { description: msg(e) });
      return null;
    } finally { actionPending.current.delete(row.id); setBusyId(row.id, false); }
  }

  async function terminate(row: RenewalRow): Promise<RenewalRow | null> {
    if (actionPending.current.has(row.id)) return null;
    actionPending.current.add(row.id);
    const reason = await new Promise<string | null>((resolve) => setEndDlg({ row, resolve }));
    setEndDlg(null);
    if (reason === null) { actionPending.current.delete(row.id); return null; }
    const before = rowsRef.current.find((r) => r.id === row.id) || row;
    setBusyId(row.id, true);
    try {
      const saved = await renewalsApi.terminate(row.id, reason, row);
      patchRow(saved);
      toast("Renewal terminated", "ok", {
        description: `${label(saved)}${reason ? ` · ${reason}` : ""}`, duration: 8000,
        action: { label: "Undo", onClick: () => revert(before, saved, ["status", "notes"], "Termination undone") },
      });
      return saved;
    } catch (e) {
      toast("Couldn't terminate it", "err", { description: msg(e) });
      return null;
    } finally { actionPending.current.delete(row.id); setBusyId(row.id, false); }
  }

  async function restore(row: RenewalRow): Promise<RenewalRow | null> {
    if (actionPending.current.has(row.id)) return null;
    actionPending.current.add(row.id);
    const before = rowsRef.current.find((r) => r.id === row.id) || row;
    setBusyId(row.id, true);
    try {
      const saved = await renewalsApi.restore(row);
      patchRow(saved);
      const late = day10(saved.renewalDate) && day10(saved.renewalDate) < today;
      toast("Renewal restored", "ok", {
        description: `${label(saved)} is active again${late ? ` · it was due ${fmtDay(saved.renewalDate)} — check the date` : ""}`, duration: 8000,
        action: { label: "Undo", onClick: () => revert(before, saved, ["status", "notes"], "Restore undone") },
      });
      return saved;
    } catch (e) {
      toast("Couldn't restore it", "err", { description: msg(e) });
      return null;
    } finally { actionPending.current.delete(row.id); setBusyId(row.id, false); }
  }

  async function removeRow(row: RenewalRow) {
    const ok = await dialog.confirm({ title: `Delete ${label(row)}?`, message: "The renewal, its remarks and its reminders are removed for everyone. This can't be undone — to stop it renewing, Terminate keeps the record.", confirmText: "Delete renewal", danger: true });
    if (!ok) return;
    try { await renewalsApi.remove(row.id); deleted(row); }
    catch (e) { toast("Couldn't delete it", "err", { description: msg(e) }); }
  }

  /* ── drawer callbacks ── */
  function saved(row: RenewalRow, isNew: boolean) {
    if (isNew) {
      setRows((rs) => [...(rs || []), row]);
      setDrawer(null);
      toast("Renewal added", "ok", { description: [label(row), Number(row.amount) ? `${inr(row.amount)} ${cycleOf(row.cycle).name.toLowerCase()}` : "", row.renewalDate ? `next ${fmtDay(row.renewalDate)}` : ""].filter(Boolean).join(" · "), action: { label: "Open", onClick: () => setDrawer({ row, key: Date.now() }) } });
    } else {
      patchRow(row);
      setDrawer(null);
      toast("Renewal saved", "ok", { description: label(row) });
    }
  }
  function deleted(row: RenewalRow) {
    setRows((rs) => rs && rs.filter((r) => r.id !== row.id));
    setDrawer((d) => (d?.row?.id === row.id ? null : d));
    toast("Renewal deleted", "ok", { description: label(row) });
  }
  const drawerAction = (kind: DrawerAction, row: RenewalRow) => (kind === "renew" ? renew(row) : kind === "end" ? terminate(row) : restore(row));
  const openRow = (r: RenewalRow) => setDrawer({ row: r, key: Date.now() });
  const addRow = () => setDrawer({ row: null, key: Date.now() });

  const handlers: RowHandlers = { onOpen: openRow, onRenew: renew, onEnd: terminate, onRestore: restore, onDelete: removeRow, busy };

  const k = (lbl: string, icon: typeof RupeeIcon, tone: string, value: string, sub: string, onClick?: () => void) => (
    <div className={"td-kpi rn-kpi " + tone + (onClick ? " click" : "")} key={lbl} {...(onClick && rows ? { role: "button", tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } } : {})}>
      <span className="td-k"><span className="td-kic"><HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} className="hgi" /></span>{lbl}</span>
      {rows ? <span className="td-v">{value}</span> : <span className="skel" style={{ width: 80, height: 34, borderRadius: 9, margin: "6px 0 4px" }} />}
      {rows ? <span className="td-s">{sub}</span> : <span className="skel skel-line" style={{ width: "65%", height: 10 }} />}
    </div>
  );

  if (!rows && !error) return <div className="td"><WorkspaceHero title="Renewals" eyebrow="Workspace" /><PageLoading label="Loading renewals…" variant="list" /></div>;
  return (
    <div className="td rn renewals-workspace">
      <WorkspaceHero eyebrow="KEEP EVERY CLIENT COVERED" title="Renewals" description="Know what renews, who owns it and what is due." actions={<> <div className="td-acts">
          <button type="button" className="sh-btn" onClick={doExport} disabled={exporting || !rows} title="Download the renewals you see (current filters) as an Excel file">
            {exporting ? <span className="spin rn-spin" aria-hidden /> : <HugeiconsIcon icon={Download04Icon} size={17} strokeWidth={1.8} />}{exporting ? "Preparing…" : "Export"}
          </button>
          <button type="button" className="sh-btn pri" onClick={addRow}><HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />New renewal</button>
        </div> </>} />

      {error && !rows ? (
        <div className="sh-empty err" role="alert">
          <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={1.8} className="hgi" />
          <b>Couldn&apos;t load the renewals</b><span>{error}</span>
          <button type="button" className="sh-btn sm" onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />Try again</button>
        </div>
      ) : (
        <>
          <div className="td-kpis">
            {k("Due in 14 days", Clock01Icon, "blue", String(totals.due), `${inr(totals.dueSum)} scheduled`, () => setScope("soon"))}
            {k("Overdue", Alert02Icon, "red", String(totals.over), totals.over ? "Needs a follow-up" : "Nothing overdue", () => setScope("overdue"))}
            {k("Active renewals", RepeatIcon, "green", String(totals.active), "Current client services", () => { setScope("all"); setFStatus("active"); })}
            {k("Unassigned", Alert02Icon, "violet", String(all.filter((r) => r.status === "active" && !r.owner).length), "Active services without an owner", () => { setScope("all"); setFStatus("active"); setFOwner("__none"); })}
          </div>

          <div className="rn-scopes" role="tablist" aria-label="Renewal views">{([["all", "All renewals"], ["soon", "Due soon"], ["overdue", "Overdue"], ["history", "History"]] as const).map(([key, text]) => <button type="button" role="tab" aria-selected={scope === key} key={key} onClick={() => { setScope(key); setFStatus(""); }}>{text}</button>)}</div>
          {scope === "history" && <p className="rn-scope-note">Terminated services. Open a record for its renewal remarks and activity.</p>}
          <div className="rn-toolbar">
            <label className="rn-search">
              <span className="sh-sr">Search renewals</span>
              <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.8} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, service, owner…" type="search" />
              {q && <button type="button" className="rn-x" onClick={() => setQ("")} aria-label="Clear search"><HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} /></button>}
            </label>
            <div className="rn-fsel"><Select value={fOwner} onChange={setFOwner} ariaLabel="Owner" placeholder="All owners" options={[{ value: "", label: "All owners" }, ...owners.map((owner) => ({ value: owner, label: owner })), { value: "__none", label: "Unassigned" }]} /></div>
            <details className="rn-more-filters"><summary>Filters{(fCycle || fStatus) && <i />}</summary><div className="rn-filter-pop">
              {scope === "all" && <Select value={fStatus} onChange={setFStatus} ariaLabel="Status" options={[{ value: "", label: "All statuses" }, ...STATUSES.map((status) => ({ value: status.id, label: `${status.name} (${counts[status.id] || 0})` }))]} />}
              <Select value={fCycle} onChange={setFCycle} ariaLabel="Billing cycle" options={[{ value: "", label: "Any cycle" }, ...CYCLES.map((cycle) => ({ value: cycle.id, label: cycle.name }))]} />
            </div></details>
            <div className="rn-seg rn-viewseg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "timeline"} onClick={() => pickView("timeline")}><HugeiconsIcon icon={Calendar03Icon} size={16} strokeWidth={1.8} />Timeline</button>
              <button type="button" aria-pressed={view === "table"} onClick={() => pickView("table")}><HugeiconsIcon icon={Table02Icon} size={16} strokeWidth={1.8} />Table</button>
            </div>
          </div>
          {rows && filtering && (
            <div className="rn-count" aria-live="polite">
              {plural(shown.length, "renewal")} match{shown.length === 1 ? "es" : ""} · {inr(sumAmount(shown))}
              <button type="button" className="sh-link" onClick={clearFilters}>Clear filters</button>
            </div>
          )}

          {!rows ? <PageLoading label="Loading renewals…" variant="list" />
            : rows.length === 0 ? (
              <div className="sh-empty rn-empty">
                <HugeiconsIcon icon={RepeatIcon} size={20} strokeWidth={1.8} className="hgi" />
                <b>No renewals yet</b>
                <span>Add the maintenance, hosting or retainer invoices you send every month, quarter or year — reminders go out before each one is due.</span>
                <button type="button" className="sh-btn pri sm" onClick={addRow}><HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} />New renewal</button>
              </div>
            ) : shown.length === 0 ? (
              <div className="sh-empty">
                <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} className="hgi" />
                <b>No renewals match</b><span>Try another search or clear the filters.</span>
                <button type="button" className="sh-btn sm" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : view === "timeline" ? <Timeline rows={shown} h={handlers} today={today} />
              : <RenewalTable rows={shown} h={handlers} today={today} />}
          {error && rows && <div className="sh-empty err rn-inline-err" role="alert"><b>Couldn&apos;t refresh</b><span>{error}</span><button type="button" className="sh-btn sm" onClick={load}>Try again</button></div>}
        </>
      )}

      {drawer && (
        <RenewalDrawer key={drawer.key} row={drawer.row} me={me}
          onClose={() => setDrawer(null)} onSaved={saved} onDeleted={deleted}
          onPatched={patchRow} onAction={drawerAction} />
      )}
      {renewDlg && <RenewDialog row={renewDlg.row} onDone={renewDlg.resolve} />}
      {endDlg && <EndDialog row={endDlg.row} onDone={endDlg.resolve} />}
    </div>
  );
}

export default function AdminRenewals() {
  return <Suspense fallback={null}><Renewals /></Suspense>;
}
