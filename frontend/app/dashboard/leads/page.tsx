"use client";
/* Leads — the business-development pipeline.
   One request for the data (GET /api/leads); everything else (totals,
   follow-up counts, filters, board / list) is worked out here. Changes are
   optimistic: the card moves first, the server is told after, and a failed
   save puts it back. `?lead=ID` (home page, notifications) opens that lead. */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon, Search01Icon, KanbanIcon, LeftToRightListBulletIcon, RupeeIcon, Target02Icon, CheckmarkCircle02Icon, ChartIncreaseIcon,
  Alert02Icon, Refresh01Icon, UserAdd01Icon, Cancel01Icon, Download04Icon,
} from "@hugeicons/core-free-icons";
import { leadsApi, type LeadRow, type LeadStage } from "@/lib/adminApi";
import { FollowUpStrip, inRange, type FollowRange } from "@/components/admin/LeadFollowUps";
import { exportToExcel } from "@/components/admin/ExportButton";
import Select from "@/components/Select";
import LeadBoard, { BoardSkeleton } from "@/components/admin/leads/LeadBoard";
import LeadList, { ListSkeleton } from "@/components/admin/leads/LeadList";
import LeadDrawer from "@/components/admin/leads/LeadDrawer";
import LostDialog from "@/components/admin/leads/LostDialog";
import { STAGES, stageOf, isOpen, inr, inrShort, sumValue, byPosition, istMonth, SOURCES, PRIORITIES, cap } from "@/components/admin/leads/leadKit";
import { istToday } from "@/lib/activityText";
import { toast } from "@/lib/toast";
import "./leads.css";

type View = "board" | "list";
const VIEW_KEY = "fv-leads-view";
const readView = (): View => { try { return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board"; } catch { return "board"; } };
const badges = () => window.dispatchEvent(new Event("fv-badges"));
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const CALENDLY = process.env.NEXT_PUBLIC_CALENDLY_URL;

function Leads() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("lead"); // /dashboard/leads?lead=ID (home page, notifications)

  const [rows, setRows] = useState<LeadRow[] | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("board");
  const [q, setQ] = useState("");
  const [fStage, setFStage] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fSource, setFSource] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [range, setRange] = useState<FollowRange>("");
  const [drawer, setDrawer] = useState<{ lead: LeadRow | null; key: number } | null>(null);
  const [lost, setLost] = useState<{ lead: LeadRow; resolve: (r: string | null) => void } | null>(null);
  const rowsRef = useRef<LeadRow[]>([]);
  rowsRef.current = rows || [];

  useEffect(() => { setView(readView()); }, []);
  const pickView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ } };

  const load = useCallback(async () => {
    setError("");
    try { const r = await leadsApi.list(); setRows(Array.isArray(r) ? r : []); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the leads."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Deep link: open the lead once the list is here. */
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!openId) { opened.current = null; return; }
    if (!rows || opened.current === openId) return;
    opened.current = openId;
    const l = rows.find((r) => String(r.id) === openId);
    if (l) setDrawer({ lead: l, key: Date.now() });
    else toast("That lead isn't in the list any more", "warn", { description: "It may have been deleted." });
    router.replace("/dashboard/leads", { scroll: false });
  }, [openId, rows, router]);

  const patchRow = (id: number, p: Partial<LeadRow>) => setRows((rs) => (rs ? rs.map((r) => (r.id === id ? { ...r, ...p } : r)) : rs));

  /* ── totals ── */
  const all = rows || [];
  const totals = useMemo(() => {
    const open = all.filter(isOpen);
    const won = all.filter((l) => l.stage === "won"), lostN = all.filter((l) => l.stage === "lost").length;
    const month = istMonth(new Date().toISOString());
    const wonMonth = won.filter((l) => istMonth(l.wonAt || l.updatedAt) === month);
    const today = istToday();
    const due = open.filter((l) => { const d = String(l.nextFollowUpAt || l.nextFollowUp || "").slice(0, 10); return /^\d{4}-/.test(d) && d <= today; }).length;
    return {
      pipe: sumValue(open), open: open.length, due, won: won.length, lost: lostN, wonValue: sumValue(won),
      wonMonth: sumValue(wonMonth), wonMonthN: wonMonth.length,
      rate: won.length + lostN ? Math.round((won.length / (won.length + lostN)) * 100) : null,
    };
  }, [all]);

  /* ── filters ── */
  const owners = useMemo(() => [...new Set(all.map((l) => l.owner).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)), [all]);
  const sources = useMemo(() => [...new Set([...SOURCES, ...(all.map((l) => l.source).filter(Boolean) as string[])])], [all]);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => all.filter((l) =>
    (!needle || [l.name, l.company, l.purpose, l.email, l.phone, l.owner, l.source, l.notes].join(" ").toLowerCase().includes(needle))
    && (!fOwner || (fOwner === "__none" ? !l.owner : l.owner === fOwner))
    && (!fSource || l.source === fSource)
    && (!fPriority || l.priority === fPriority)
    && (view === "board" || !fStage || (fStage === "open" ? isOpen(l) : l.stage === fStage))
    && inRange(l, range)), [all, needle, fOwner, fSource, fPriority, fStage, view, range]);
  const filtering = !!(needle || fOwner || fSource || fPriority || range || (view === "list" && fStage));
  const clearFilters = () => { setQ(""); setFOwner(""); setFSource(""); setFPriority(""); setFStage(""); setRange(""); };
  const exportParams = () => ({
    q: q.trim() || undefined, owner: fOwner && fOwner !== "__none" ? fOwner : undefined, source: fSource || undefined, priority: fPriority || undefined,
    stage: view === "list" && fStage ? (fStage === "open" ? "new,contacted,qualified,proposal" : fStage) : undefined,
  });

  const [exporting, setExporting] = useState(false);
  async function doExport() {
    setExporting(true);
    try {
      const r = await exportToExcel("leads", exportParams(), { file: "leads", sheet: "Leads" });
      if (!r.total) toast("Nothing to export", "info", { description: "No leads match the current filters — the file has only the headings." });
      else toast(`Exported ${r.total.toLocaleString("en-IN")} lead${r.total === 1 ? "" : "s"}`, "ok", {
        description: (range ? "Follow-up filter isn't part of the export · " : "") + (r.truncated ? `${r.file} · only the first 20,000 rows` : r.file),
      });
    } catch (e) {
      toast("Couldn't export", "err", { description: e instanceof Error ? e.message : "Try again in a moment." });
    } finally { setExporting(false); }
  }

  /* ── moving cards ── */
  const reorderOk = useRef(true); // false once /leads/reorder 404s (older backend)
  async function saveOrder(stage: LeadStage, ids: number[]) {
    if (!reorderOk.current || !ids.length) return;
    try { await leadsApi.reorder(stage, ids); }
    catch (e) { if ((e as { status?: number })?.status === 404) reorderOk.current = false; else throw e; }
  }
  const askLost = (lead: LeadRow) => new Promise<string | null>((resolve) => setLost({ lead, resolve }));

  async function move(id: number, to: LeadStage, beforeId: number | null) {
    const cur = rowsRef.current;
    const lead = cur.find((l) => l.id === id);
    if (!lead) return;
    const from = lead.stage;
    const fromIds = cur.filter((l) => l.stage === from).sort(byPosition).map((l) => l.id);
    const dest = cur.filter((l) => l.stage === to && l.id !== id).sort(byPosition).map((l) => l.id);
    const at = beforeId == null ? dest.length : Math.max(0, dest.indexOf(beforeId));
    const ids = [...dest.slice(0, at), id, ...dest.slice(at)];
    const sameCol = from === to;
    if (sameCol && ids.join() === fromIds.join()) return;

    let reason: string | null | undefined;
    if (!sameCol && to === "lost") { reason = await askLost(lead); setLost(null); if (reason === null) return; }

    // Snapshot what this move touches so Undo / a failure can put it back.
    const touched = new Set([...fromIds, ...ids]);
    const before = new Map(cur.filter((l) => touched.has(l.id)).map((l) => [l.id, { stage: l.stage, progress: l.progress, position: l.position, lostReason: l.lostReason, wonAt: l.wonAt }]));
    const restore = () => setRows((rs) => rs && rs.map((r) => (before.has(r.id) ? { ...r, ...before.get(r.id)! } : r)));
    const pos = new Map(ids.map((x, i) => [x, i]));
    setRows((rs) => rs && rs.map((r) => {
      if (r.id === id) return { ...r, stage: to, progress: stageOf(to).pct, position: pos.get(id)!, ...(reason !== undefined ? { lostReason: reason || null } : {}), ...(sameCol ? {} : { wonAt: to === "won" ? new Date().toISOString() : null }) };
      return pos.has(r.id) ? { ...r, position: pos.get(r.id)! } : r;
    }));

    try {
      if (!sameCol) {
        const saved = await leadsApi.update(id, { stage: to, progress: stageOf(to).pct, ...(reason !== undefined ? { lostReason: reason || null } : {}) });
        patchRow(id, { stage: saved.stage, progress: saved.progress ?? stageOf(saved.stage).pct, wonAt: saved.wonAt ?? null, lostReason: saved.lostReason ?? null, updatedAt: saved.updatedAt });
      }
      await saveOrder(to, ids);
    } catch (e) {
      restore();
      toast(`Couldn't move ${lead.name}`, "err", { description: e instanceof Error ? e.message : "Try again." });
      return;
    }
    if (!sameCol) badges();

    const undo = async () => {
      restore();
      try {
        if (!sameCol) await leadsApi.update(id, { stage: from, progress: stageOf(from).pct, lostReason: lead.lostReason ?? null });
        await saveOrder(from, fromIds);
        if (!sameCol) badges();
        toast(`${lead.name} is back in ${stageOf(from).name}`, "info");
      } catch (e) {
        toast("Couldn't undo", "err", { description: e instanceof Error ? e.message : "Reload the page and check the lead." });
        load();
      }
    };
    const s = stageOf(to);
    toast(sameCol ? "Order saved" : `${lead.name} moved to ${s.name}`, "ok", {
      description: sameCol ? s.name : to === "lost" ? (reason ? `Lost reason: ${reason}` : "Progress 0%") : `Progress ${s.pct}%`,
      action: { label: "Undo", onClick: undo }, duration: 7000,
    });
  }

  /* ── drawer callbacks ── */
  function saved(row: LeadRow, isNew: boolean, before: LeadRow | null) {
    if (isNew) setRows((rs) => [row, ...(rs || [])]);
    else patchRow(row.id, row);
    setDrawer(null);
    if (isNew) toast("Lead added", "ok", { description: [row.name, Number(row.value) ? inr(row.value) : "", stageOf(row.stage).name].filter(Boolean).join(" · "), action: { label: "Open", onClick: () => setDrawer({ lead: row, key: Date.now() }) } });
    else toast("Lead saved", "ok", { description: `${row.name} · ${stageOf(row.stage).name}` });
    if (isNew || !before || before.stage !== row.stage || before.nextFollowUpAt !== row.nextFollowUpAt || before.owner !== row.owner) badges();
  }
  function deleted(id: number) {
    const l = rowsRef.current.find((r) => r.id === id);
    setRows((rs) => rs && rs.filter((r) => r.id !== id));
    setDrawer(null);
    toast("Lead deleted", "ok", { description: l?.name });
    badges();
  }
  const openLead = (l: LeadRow) => setDrawer({ lead: l, key: Date.now() });
  const addLead = () => setDrawer({ lead: null, key: Date.now() });

  const k = (label: string, icon: typeof RupeeIcon, tone: string, value: string, sub: string) => (
    <div className={"td-kpi " + tone} key={label}>
      <span className="td-k"><span className="td-kic"><HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} className="hgi" /></span>{label}</span>
      {rows ? <span className="td-v">{value}</span> : <span className="skel" style={{ width: 80, height: 34, borderRadius: 9, margin: "6px 0 4px" }} />}
      {rows ? <span className="td-s">{sub}</span> : <span className="skel skel-line" style={{ width: "65%", height: 10 }} />}
    </div>
  );

  return (
    <div className="td ld">
      <div className="td-hello">
        <div className="td-hello-tx">
          <div className="td-eyebrow">Sales</div>
          <h1>Leads</h1>
          <p>Business-development pipeline. Track prospects from first touch to won.</p>
        </div>
        <div className="td-acts">
          <button type="button" className="sh-btn" onClick={doExport} disabled={exporting} title="Download the leads you see (current filters) as an Excel file">
            {exporting ? <span className="spin ld-spin" aria-hidden /> : <HugeiconsIcon icon={Download04Icon} size={17} strokeWidth={1.8} />}{exporting ? "Preparing…" : "Export"}
          </button>
          <button type="button" className="sh-btn pri" onClick={addLead}><HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />Add lead</button>
        </div>
      </div>

      {error && !rows ? (
        <div className="sh-empty err" role="alert">
          <HugeiconsIcon icon={Alert02Icon} size={20} strokeWidth={1.8} className="hgi" />
          <b>Couldn&apos;t load the leads</b><span>{error}</span>
          <button type="button" className="sh-btn sm" onClick={load}><HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />Try again</button>
        </div>
      ) : (
        <>
          <div className="td-kpis">
            {k("Open pipeline", RupeeIcon, "blue", inrShort(totals.pipe), `${plural(totals.open, "open lead")} · ${inr(totals.pipe)}`)}
            {k("Open leads", Target02Icon, "amber", String(totals.open), totals.due ? `${plural(totals.due, "follow-up")} due or overdue` : "No follow-ups due today")}
            {k("Won this month", CheckmarkCircle02Icon, "green", inrShort(totals.wonMonth), `${plural(totals.wonMonthN, "deal")} · ${inrShort(totals.wonValue)} won in all`)}
            {k("Win rate", ChartIncreaseIcon, "violet", totals.rate == null ? "—" : `${totals.rate}%`, `${totals.won} won · ${totals.lost} lost`)}
          </div>

          {rows && rows.length > 0 && <FollowUpStrip rows={rows} value={range} onChange={setRange} />}

          <div className="ld-toolbar">
            <label className="ld-search">
              <span className="sh-sr">Search leads</span>
              <HugeiconsIcon icon={Search01Icon} size={17} strokeWidth={1.8} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, purpose…" type="search" />
              {q && <button type="button" className="ld-x" onClick={() => setQ("")} aria-label="Clear search"><HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} /></button>}
            </label>
            <div className="ld-filters">
              {view === "list" && (
                <div className="ld-fsel"><Select value={fStage} onChange={setFStage} ariaLabel="Stage" placeholder="All stages"
                  options={[{ value: "", label: "All stages" }, { value: "open", label: "Open (not won / lost)" }, ...STAGES.map((s) => ({ value: s.id, label: s.name }))]} /></div>
              )}
              <div className="ld-fsel"><Select value={fOwner} onChange={setFOwner} ariaLabel="Owner" placeholder="All owners"
                options={[{ value: "", label: "All owners" }, ...owners.map((o) => ({ value: o, label: o })), { value: "__none", label: "Unassigned" }]} /></div>
              <div className="ld-fsel"><Select value={fSource} onChange={setFSource} ariaLabel="Source" placeholder="All sources"
                options={[{ value: "", label: "All sources" }, ...sources.map((s) => ({ value: s, label: s }))]} /></div>
              <div className="ld-fsel"><Select value={fPriority} onChange={setFPriority} ariaLabel="Priority" placeholder="Any priority"
                options={[{ value: "", label: "Any priority" }, ...PRIORITIES.map((p) => ({ value: p, label: cap(p) }))]} /></div>
              {filtering && <button type="button" className="sh-link ld-clearall" onClick={clearFilters}>Clear filters</button>}
            </div>
            <div className="ld-seg" role="group" aria-label="View">
              <button type="button" aria-pressed={view === "board"} onClick={() => pickView("board")}><HugeiconsIcon icon={KanbanIcon} size={16} strokeWidth={1.8} />Board</button>
              <button type="button" aria-pressed={view === "list"} onClick={() => pickView("list")}><HugeiconsIcon icon={LeftToRightListBulletIcon} size={16} strokeWidth={1.8} />List</button>
            </div>
          </div>
          {rows && filtering && <div className="ld-count" aria-live="polite">{plural(shown.length, "lead")} match{shown.length === 1 ? "es" : ""} · {inr(sumValue(shown))}</div>}

          {!rows ? (view === "board" ? <BoardSkeleton /> : <ListSkeleton />)
            : rows.length === 0 ? (
              <div className="sh-empty ld-empty">
                <HugeiconsIcon icon={UserAdd01Icon} size={20} strokeWidth={1.8} className="hgi" />
                <b>No leads yet</b>
                <span>Add your first prospect — new enquiries from the website form land here too.</span>
                <button type="button" className="sh-btn pri sm" onClick={addLead}><HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} />Add lead</button>
              </div>
            ) : view === "board" ? (
              <LeadBoard leads={shown} onOpen={openLead} onMove={move} onAdd={addLead} filtered={filtering} />
            ) : shown.length === 0 ? (
              <div className="sh-empty">
                <HugeiconsIcon icon={Search01Icon} size={20} strokeWidth={1.8} className="hgi" />
                <b>No leads match</b><span>Try another search or clear the filters.</span>
                <button type="button" className="sh-btn sm" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              <LeadList leads={shown} onOpen={openLead} />
            )}
          {error && rows && <div className="sh-empty err ld-inline-err" role="alert"><b>Couldn&apos;t refresh</b><span>{error}</span></div>}
        </>
      )}

      {drawer && (
        <LeadDrawer key={drawer.key} lead={drawer.lead} calendlyUrl={CALENDLY}
          onClose={() => setDrawer(null)} onSaved={saved} onDeleted={deleted} onPatched={(id, p) => { patchRow(id, p); badges(); }} />
      )}
      {lost && <LostDialog name={lost.lead.name} initial={lost.lead.lostReason} onDone={(r) => lost.resolve(r)} />}
    </div>
  );
}

export default function AdminLeads() {
  return <Suspense fallback={null}><Leads /></Suspense>;
}
