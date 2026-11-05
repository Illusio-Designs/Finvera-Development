"use client";
/* The two views of the renewals list — a month-by-month timeline and a
   compact table — plus the row "⋯" menu. Rows come searched / filtered from
   the page. On phones both views show cards. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon, MoreHorizontalIcon, PencilEdit02Icon, Call02Icon, WhatsappIcon, Mail01Icon, Delete02Icon, Refresh01Icon, Clock01Icon,
} from "@hugeicons/core-free-icons";
import type { RenewalRow } from "@/lib/adminApi";
import { initials, avatarColor } from "@/lib/activityText";
import { waDigits } from "@/components/admin/LeadFollowUps";
import { groupRows, dueChip, fmtDay, day10, cycleOf, statusOf, inr, latestRemark, sumAmount, byStatusThenDate, label, type Remark } from "./renewalKit";

export type RowHandlers = {
  onOpen: (r: RenewalRow) => void;
  onRenew: (r: RenewalRow) => void;
  onEnd: (r: RenewalRow) => void;
  onRestore: (r: RenewalRow) => void;
  onDelete: (r: RenewalRow) => void;
  busy: Set<number>;
};

export const contactLinks = (r: Pick<RenewalRow, "phone" | "email" | "client" | "project">) => {
  const tel = String(r.phone || "").replace(/[^\d+]/g, "");
  const wa = waDigits(r.phone);
  const mail = String(r.email || "").trim();
  const subject = encodeURIComponent(`Renewal: ${label(r as RenewalRow)}`);
  return { tel: tel ? `tel:${tel}` : "", wa: wa ? `https://wa.me/${wa}` : "", mail: mail ? `mailto:${mail}?subject=${subject}` : "" };
};

/* ── ⋯ menu ── */
function RowMenu({ r, h }: { r: RenewalRow; h: RowHandlers }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const b = btn.current.getBoundingClientRect();
    const w = 210, hgt = 236;
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, b.right - w));
    const top = b.bottom + 6 + hgt > window.innerHeight ? Math.max(8, b.top - hgt - 6) : b.bottom + 6;
    setPos({ top, left });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (e.type === "keydown" ? (e as KeyboardEvent).key === "Escape" : !menu.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    const off = () => setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close); window.addEventListener("scroll", off, true); window.addEventListener("resize", off);
    menu.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); window.removeEventListener("scroll", off, true); window.removeEventListener("resize", off); };
  }, [open, pos]);
  const c = contactLinks(r);
  const item = (href: string, icon: typeof Call02Icon, text: string, ext = false) => href
    ? <a role="menuitem" href={href} {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})} onClick={() => setOpen(false)}><HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} className="hgi" />{text}</a>
    : <button role="menuitem" type="button" disabled title={text === "Email" ? "Add a billing email first" : "Add a phone number first"}><HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} className="hgi" />{text}</button>;
  return (
    <>
      <button ref={btn} type="button" className="sh-icb sm rn-more" aria-haspopup="menu" aria-expanded={open} aria-label={`More for ${label(r)}`} onClick={() => setOpen((o) => !o)}>
        <HugeiconsIcon icon={MoreHorizontalIcon} size={17} strokeWidth={1.8} />
      </button>
      {open && pos && (
        <div ref={menu} className="rn-menu sh-pop" role="menu" style={{ top: pos.top, left: pos.left }}>
          <div className="sh-menu">
            <button role="menuitem" type="button" onClick={() => { setOpen(false); h.onOpen(r); }}><HugeiconsIcon icon={PencilEdit02Icon} size={17} strokeWidth={1.8} className="hgi" />Edit</button>
            {item(c.tel, Call02Icon, "Call")}
            {item(c.wa, WhatsappIcon, "WhatsApp", true)}
            {item(c.mail, Mail01Icon, "Email")}
            <hr />
            {r.status !== "cancelled" && <button role="menuitem" type="button" disabled={h.busy.has(r.id)} onClick={() => { setOpen(false); h.onEnd(r); }}>Terminate service</button>}
            <button role="menuitem" type="button" className="danger" onClick={() => { setOpen(false); h.onDelete(r); }}><HugeiconsIcon icon={Delete02Icon} size={17} strokeWidth={1.8} className="hgi" />Delete</button>
          </div>
        </div>
      )}
    </>
  );
}

function Actions({ r, h }: { r: RenewalRow; h: RowHandlers }) {
  const busy = h.busy.has(r.id);
  return (
    <div className="rn-acts">
      {r.status === "cancelled" ? (
        <button type="button" className="sh-btn sm" disabled={busy} onClick={() => h.onRestore(r)}><HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={1.8} />Restore</button>
      ) : (
        <>
          <button type="button" className="sh-btn sm rn-ok" disabled={busy} onClick={() => h.onRenew(r)}><HugeiconsIcon icon={Tick02Icon} size={15} strokeWidth={2} />Renewed</button>
          <button type="button" className="sh-btn sm rn-end" disabled={busy} onClick={() => h.onEnd(r)}>Terminate</button>
        </>
      )}
      <RowMenu r={r} h={h} />
    </div>
  );
}

function Owner({ name }: { name?: string | null }) {
  if (!name) return <span className="rn-muted">Unassigned</span>;
  return <span className="rn-owner"><i className="rn-av" style={{ background: avatarColor(name) }} aria-hidden>{initials(name)}</i><span>{name}</span></span>;
}

function RemarkLine({ m }: { m: Remark | null }) {
  if (!m) return <span className="rn-rm rn-muted">No remarks yet</span>;
  const head = m.text || m.what;
  return (
    <span className="rn-rm" title={[m.date, m.what, m.by, m.text].filter(Boolean).join(" · ")}>
      <span className={"rn-rm-dot " + m.kind} aria-hidden />
      <span className="rn-rm-tx">{head}</span>
      {m.date && <small>{m.date}{m.text && m.what ? ` · ${m.what.replace(/ till .*/, "")}` : ""}{m.by ? ` · ${m.by}` : ""}</small>}
    </span>
  );
}

function Chip({ r, today }: { r: RenewalRow; today: string }) {
  const c = dueChip(r, today);
  if (!c) return null;
  return <span className={"sh-pill nodot rn-chip " + c.tone}><HugeiconsIcon icon={Clock01Icon} size={12} strokeWidth={2} />{c.text}</span>;
}

/* One renewal: a row on desktop, a card on phones. */
export function RenewalItem({ r, h, today }: { r: RenewalRow; h: RowHandlers; today: string }) {
  const d = day10(r.renewalDate);
  const st = statusOf(r.status);
  const c = dueChip(r, today);
  return (
    <li className={"rn-row" + (r.status === "cancelled" ? " ended" : r.status === "paused" ? " paused" : "") + (c?.tone === "red" ? " late" : "")} data-id={r.id}>
      <div className={"rn-when " + (c?.tone || "grey")} aria-hidden>
        {d ? <><b>{Number(d.slice(8))}</b><small>{fmtDay(d).split(" ")[1]}{d.slice(0, 4) !== today.slice(0, 4) ? ` ’${d.slice(2, 4)}` : ""}</small></> : <small>—</small>}
      </div>
      <div className="rn-main">
        <button type="button" className="rn-open" onClick={() => h.onOpen(r)}><b>{r.client}</b></button>
        {r.project && <small className="rn-proj">{r.project}</small>}
        <RemarkLine m={latestRemark(r.notes)} />
      </div>
      <div className="rn-money"><b>{Number(r.amount) ? inr(r.amount) : "—"}</b><small>{cycleOf(r.cycle).name}</small></div>
      <div className="rn-due">
        <span className="rn-date">{d ? fmtDay(d) : "No date"}</span>
        <Chip r={r} today={today} />
      </div>
      <div className="rn-own"><Owner name={r.owner} /></div>
      <div className="rn-st"><span className={"sh-pill " + st.tone}>{st.name}</span></div>
      <Actions r={r} h={h} />
    </li>
  );
}

export function Timeline({ rows, h, today }: { rows: RenewalRow[]; h: RowHandlers; today: string }) {
  const groups = groupRows(rows, today);
  return (
    <div className="rn-timeline">
      {groups.map((g) => (
        <section key={g.key} className={"rn-group " + (g.tone || "")} aria-label={g.title}>
          <header className="rn-gh">
            <i className="rn-gdot" aria-hidden />
            <h2>{g.title}</h2>
            <span className="rn-gcount">{g.rows.length}</span>
            <span className="rn-gsum">{inr(sumAmount(g.rows))}</span>
          </header>
          <ul className="rn-rows">{g.rows.map((r) => <RenewalItem key={r.id} r={r} h={h} today={today} />)}</ul>
        </section>
      ))}
    </div>
  );
}

export function RenewalTable({ rows, h, today }: { rows: RenewalRow[]; h: RowHandlers; today: string }) {
  const sorted = [...rows].sort(byStatusThenDate);
  return (
    <div className="rn-tablewrap">
      <div className="rn-tbl-wrap">
        <table className="rn-tbl">
          <thead>
            <tr><th>Client · project</th><th className="num">Amount</th><th>Next renewal</th><th>Last renewed</th><th>Owner</th><th>Status</th><th>Latest remark</th><th><span className="sh-sr">Actions</span></th></tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const d = day10(r.renewalDate), st = statusOf(r.status);
              return (
                <tr key={r.id} className={r.status === "cancelled" ? "ended" : undefined} data-id={r.id}>
                  <td className="rn-tmain"><button type="button" className="rn-open" onClick={() => h.onOpen(r)}><b>{r.client}</b></button>{r.project && <small>{r.project}</small>}</td>
                  <td className="num"><b>{Number(r.amount) ? inr(r.amount) : "—"}</b><small className="rn-tsub">{cycleOf(r.cycle).name}</small></td>
                  <td><span className="rn-tdue">{d ? fmtDay(d) : <span className="rn-muted">No date</span>}<Chip r={r} today={today} /></span></td>
                  <td>{r.lastInvoiced ? fmtDay(r.lastInvoiced) : <span className="rn-muted">—</span>}</td>
                  <td><Owner name={r.owner} /></td>
                  <td><span className={"sh-pill " + st.tone}>{st.name}</span></td>
                  <td className="rn-trm"><RemarkLine m={latestRemark(r.notes)} /></td>
                  <td className="rn-tact"><Actions r={r} h={h} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Phones: cards instead of the wide table. */}
      <ul className="rn-rows rn-mcards">{sorted.map((r) => <RenewalItem key={r.id} r={r} h={h} today={today} />)}</ul>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="rn-timeline" aria-busy="true" aria-label="Loading renewals">
      {[3, 2].map((n, g) => (
        <section key={g} className="rn-group">
          <header className="rn-gh"><span className="skel skel-line" style={{ width: 120, height: 14 }} /></header>
          <ul className="rn-rows">
            {Array.from({ length: n }).map((_, i) => (
              <li key={i} className="rn-row rn-skelrow">
                <span className="skel" style={{ width: 46, height: 46, borderRadius: 12 }} />
                <span className="skel skel-line" style={{ width: "30%" }} />
                <span className="skel skel-line" style={{ width: "12%" }} />
                <span className="skel skel-line" style={{ width: "14%" }} />
                <span className="skel skel-line" style={{ width: "10%" }} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
