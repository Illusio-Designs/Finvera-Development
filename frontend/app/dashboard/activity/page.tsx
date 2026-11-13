"use client";
import { useResourceState } from "@/lib/useResourceState";
/* Activity — who changed what across the dashboard (admins only).
   A timeline grouped by day; tap a row to see every change as old → new.
   Filters: kind of item, person, action, dates and a search; 50 at a time
   with "Load more"; Export downloads the same filtered list as Excel. */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Cancel01Icon, ArrowDown01Icon, ArrowUpRight01Icon, Activity01Icon } from "@hugeicons/core-free-icons";
import { api, trackApi, type ActivityRow } from "@/lib/adminApi";
import PageLoading from "@/components/admin/PageLoading";
import { WorkspaceHero, WorkspaceStats } from "@/components/admin/Workspace";
import "./activity-workspace.css";
import Select from "@/components/Select";
import DatePicker from "@/components/ui/DatePicker";
import ExportButton from "@/components/admin/ExportButton";
import { ENTITY_GROUPS, sentence, istDay, dayHeading, timeOf, whenOf, initials, avatarColor, itemHref } from "@/lib/activityText";

const ACTIONS = [
  { value: "", label: "Any action" },
  { value: "create", label: "Added" },
  { value: "update", label: "Changed" },
  { value: "delete", label: "Deleted" },
  { value: "other", label: "Other (calls, renewals, uploads…)" },
];
const PAGE = 50;

type Filters = { type: string; userId: string; action: string; from: string; to: string; q: string };
const EMPTY: Filters = { type: "", userId: "", action: "", from: "", to: "", q: "" };

export default function ActivityPage() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [qInput, setQInput] = useState("");
  const { data: items, setData: setItems, loading, setLoading, more, setMore, error, setError } = useResourceState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const reqId = useRef(0);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => { api.listUsers().then((u: unknown) => setUsers(Array.isArray(u) ? u : [])).catch(() => {}); }, []);
  // Search waits for a short pause in typing.
  useEffect(() => { const t = setTimeout(() => setF((s) => (s.q === qInput.trim() ? s : { ...s, q: qInput.trim() })), 350); return () => clearTimeout(t); }, [qInput]);

  const params = useMemo(() => ({
    entity: ENTITY_GROUPS.find((g) => g.value === f.type)?.entity || "",
    userId: f.userId, action: f.action, from: f.from, to: f.to, q: f.q,
  }), [f]);

  const paramsRef = useRef(params); paramsRef.current = params;
  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true); setMore(false); setItems([]); setTotal(0); setError("");
    if (params.from && params.to && params.from > params.to) { setError("The end date must be on or after the start date."); setLoading(false); return; }
    trackApi.activity({ ...params, page: 1, limit: PAGE })
      .then((r) => { if (id !== reqId.current) return; setItems(r.items || []); setTotal(r.total || 0); setPage(1); })
      .catch((e) => { if (id === reqId.current) setError(e?.status === 404 ? "Activity history isn't on this server yet — update the backend." : e instanceof Error ? e.message : "Couldn't load the activity."); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
    return () => { ++reqId.current; };
  }, [params, refresh]);

  async function loadMore() {
    if (more || loading) return;
    const id = reqId.current, requested = params;
    setMore(true); setError("");
    try {
      const r = await trackApi.activity({ ...params, page: page + 1, limit: PAGE });
      if (id !== reqId.current || requested !== paramsRef.current) return;
      setItems((xs) => { const have = new Set(xs.map((x) => x.id)); return [...xs, ...(r.items || []).filter((x) => !have.has(x.id))]; });
      setTotal(r.total || 0); setPage(page + 1);
    } catch (e) { if (id === reqId.current && requested === paramsRef.current) setError(e instanceof Error ? e.message : "Couldn't load more."); }
    finally { if (id === reqId.current) setMore(false); }
  }

  const groups = useMemo(() => {
    const out: { day: string; rows: ActivityRow[] }[] = [];
    for (const r of items) {
      const d = istDay(r.createdAt);
      if (!out.length || out[out.length - 1].day !== d) out.push({ day: d, rows: [] });
      out[out.length - 1].rows.push(r);
    }
    return out;
  }, [items]);

  const set = (patch: Partial<Filters>) => setF((s) => ({ ...s, ...patch }));
  const active = Object.entries(f).filter(([, v]) => v).length;
  const toggle = (id: number) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="fw-workspace activity-workspace">
      <WorkspaceHero eyebrow="Workspace history" title="Activity log" description="A clear record of what changed, who changed it and when. Follow the detail behind your team's everyday work." actions={<><button type="button" className="sh-btn" disabled={loading} onClick={() => setRefresh(n => n + 1)}>Refresh history</button><ExportButton entity="activity" file="activity" sheet="Activity" params={() => params} label="Export to Excel" /></>} />
      <WorkspaceStats items={[
        { label: "Matching events", value: loading ? "—" : total.toLocaleString("en-IN"), detail: "Across the selected filters", accent: true },
        { label: "Events in view", value: loading ? "—" : items.length, detail: "Load more to explore earlier work" },
        { label: "People in view", value: loading ? "—" : new Set(items.map(r => r.userId).filter(Boolean)).size, detail: "Distinct members in loaded events" },
        { label: "Days in view", value: loading ? "—" : groups.length, detail: "Dates displayed in India time" },
      ]} />

      <div className="act-filters">
        <label className="adm-search act-q">
          <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} />
          <input placeholder="Search name, person, note…" value={qInput} onChange={(e) => setQInput(e.target.value)} aria-label="Search activity" />
          {qInput && <button type="button" className="act-x" aria-label="Clear search" onClick={() => setQInput("")}><HugeiconsIcon icon={Cancel01Icon} size={14} /></button>}
        </label>
        <button type="button" className={"adm-btn ghost act-ftoggle" + (showFilters ? " on" : "")} aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>
          Filters{active - (f.q ? 1 : 0) > 0 ? ` · ${active - (f.q ? 1 : 0)}` : ""}
          <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
        </button>
        <div className={"act-fgrid" + (showFilters ? " show" : "")}>
          <div className="act-f"><span>Type</span><Select value={f.type} onChange={(v) => set({ type: v })} ariaLabel="Type"
            options={[{ value: "", label: "Everything" }, ...ENTITY_GROUPS.map((g) => ({ value: g.value, label: g.label }))]} /></div>
          <div className="act-f"><span>Person</span><Select value={f.userId} onChange={(v) => set({ userId: v })} ariaLabel="Person"
            options={[{ value: "", label: "Anyone" }, ...users.map((u) => ({ value: String(u.id), label: u.name }))]} /></div>
          <div className="act-f"><span>Action</span><Select value={f.action} onChange={(v) => set({ action: v })} ariaLabel="Action" options={ACTIONS} /></div>
          <div className="act-f"><span>From</span><DatePicker value={f.from} onChange={(v) => set({ from: v })} placeholder="Any date" /></div>
          <div className="act-f"><span>To</span><DatePicker value={f.to} onChange={(v) => set({ to: v })} placeholder="Today" /></div>
          {active > 0 && <button type="button" className="act-clear" onClick={() => { setF(EMPTY); setQInput(""); }}>Clear filters</button>}
        </div>
      </div>

      {error && <div className="fw-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRefresh(n => n + 1)}>Retry / reload</button></div>}

      <div className="act-meta" aria-live="polite">
        {!loading && !error && (total ? <>Showing <b>{items.length.toLocaleString("en-IN")}</b> of {total.toLocaleString("en-IN")} change{total === 1 ? "" : "s"}</> : null)}
      </div>

      <div className="fw-section-title"><div><h2>The workspace trail</h2><p>Open a change to compare before and after. Date filters include the full day in India time.</p></div></div>
      {loading ? (
        <PageLoading label="Loading activity history…" variant="list" />
      ) : error && !items.length ? null : !items.length ? (
        <div className="act-empty">
          <span className="ic"><HugeiconsIcon icon={Activity01Icon} size={26} strokeWidth={1.6} /></span>
          <b>{active ? "Nothing matches these filters" : "No activity yet"}</b>
          <span>{active ? "Try a wider date range or clear the filters." : "Changes to leads, renewals, the website and the boards show up here as people make them."}</span>
        </div>
      ) : (
        <div className="act-timeline">
          {groups.map((g) => (
            <section key={g.day} className="act-day" aria-label={dayHeading(g.day)}>
              <h2 className="act-dayhead">{dayHeading(g.day)}<small>{g.rows.length}</small></h2>
              <ol>
                {g.rows.map((r) => {
                  const s = sentence(r);
                  const isOpen = open.has(r.id);
                  const canOpen = s.lines.length > 0 || (r.summary && r.action !== "other") || !!r.ip;
                  const href = itemHref(r);
                  return (
                    <li key={r.id} className={"act-row a-" + r.action + (isOpen ? " open" : "")}>
                      <span className="act-av" style={{ background: avatarColor(r.userName) }} aria-hidden>{initials(r.userName)}</span>
                      <div className="act-body">
                        <button type="button" className="act-sum" onClick={() => canOpen && toggle(r.id)} aria-expanded={canOpen ? isOpen : undefined} disabled={!canOpen}>
                          <span className="act-text">
                            <b>{s.who}</b> {s.verb}{s.verb ? " " : ""}{s.noun}{s.label ? <> <strong>{s.label}</strong></> : null}
                            {s.tail && <span className="act-tail"> — {s.tail}</span>}
                          </span>
                          <span className="act-sub">
                            <span className={"act-pill a-" + r.action}>{s.pill}</span>
                            <time dateTime={r.createdAt} title={whenOf(r.createdAt)}>{timeOf(r.createdAt)}</time>
                            {canOpen && <span className="act-chev" aria-hidden><HugeiconsIcon icon={ArrowDown01Icon} size={14} /></span>}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="act-detail">
                            {r.summary && r.action !== "other" && <p className="act-note">{r.summary}</p>}
                            {s.lines.length > 0 && (
                              <ul className="act-changes">
                                {s.lines.map((l) => (
                                  <li key={l.field}>
                                    <span className="f">{l.label}</span>
                                    {r.action === "create" ? <span className="to">{l.to}</span>
                                      : r.action === "delete" ? <span className="from">{l.from}</span>
                                      : <><span className="from">{l.from}</span><span className="arr" aria-label="changed to">→</span><span className="to">{l.to}</span></>}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="act-foot">
                              <span>{whenOf(r.createdAt)}{r.ip ? ` · from ${r.ip}` : ""}</span>
                              {href && <Link href={href} className="act-open">Open {s.noun} <HugeiconsIcon icon={ArrowUpRight01Icon} size={14} /></Link>}
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          {items.length < total && (
            <button type="button" className="act-more" onClick={loadMore} disabled={more}>
              {more ? <><span className="spin exp-spin" /> Loading…</> : `Load more (${(total - items.length).toLocaleString("en-IN")} older)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
