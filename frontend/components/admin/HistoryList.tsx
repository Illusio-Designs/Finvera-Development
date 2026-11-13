"use client";
import { useDisclosure } from "@/lib/useDisclosure";
/* "History" for one item (lead, renewal, card, post, site content …):
   who changed what and when, newest first, from GET /activity/:entity/:id.
   Collapsed to a button by default so drawers stay light; `open` shows it
   straight away. Reloads when `refreshKey` changes (e.g. after a save). */
import { useEffect, useState } from "react";
import { trackApi, type ActivityRow } from "@/lib/adminApi";
import { changeLines, prettySummary, whenOf, relative, initials, avatarColor } from "@/lib/activityText";

const VERB: Record<string, string> = { create: "Created", update: "Updated", delete: "Deleted", other: "" };

function mediaLinks(value: unknown): { url: string; name?: string }[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  if (!Array.isArray(value)) return [];
  return value.filter((m) => m && typeof m.url === "string" && /^https?:\/\//i.test(m.url));
}

export default function HistoryList({ entity, id, open: startOpen = false, refreshKey = 0, title = "History" }: {
  entity: string; id: string | number | null | undefined; open?: boolean; refreshKey?: number | string; title?: string;
}) {
  const [open, setOpen] = useDisclosure(startOpen);
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [err, setErr] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!open || id == null || id === "") return;
    let alive = true;
    setErr("");
    trackApi.history(entity, id)
      .then((r) => { if (alive) setRows(Array.isArray(r) ? r : []); })
      .catch((e) => { if (alive) { setRows([]); setErr(e?.status === 403 ? "You can't see the history of this item." : e?.status === 404 ? "History isn't available on this server yet." : "Couldn't load the history."); } });
    return () => { alive = false; };
  }, [open, entity, id, refreshKey]);

  if (id == null || id === "") return null;
  const list = rows || [];
  const shown = showAll ? list : list.slice(0, 15);

  return (
    <section className="act-hist" aria-label={title}>
      <button type="button" className="act-hist-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
        <b>{title}</b>
        {rows && <span className="act-hist-n">{list.length}{list.length >= 200 ? "+" : ""}</span>}
        <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
      </button>
      {open && (
        <div className="act-hist-body">
          {!rows ? <div className="act-hist-empty">Loading…</div>
            : err ? <div className="act-hist-empty">{err}</div>
            : !list.length ? <div className="act-hist-empty">No changes yet.</div>
            : (
              <ol className="act-hist-list">
                {shown.map((r) => {
                  const lines = changeLines(r).filter((l) => r.action !== "create" || l.to !== "—");
                  const head = r.action === "other" ? prettySummary(r.summary) || "Updated" : VERB[r.action];
                  return (
                    <li key={r.id} className={"act-hist-item a-" + r.action}>
                      <span className="act-av sm" style={{ background: avatarColor(r.userName) }} aria-hidden>{initials(r.userName)}</span>
                      <div className="act-hist-main">
                        <div className="act-hist-line">
                          <b>{r.userName || "Someone"}</b> <span>{head}{r.action !== "other" && r.summary ? ` · ${r.summary}` : ""}</span>
                        </div>
                        <time dateTime={r.createdAt} title={whenOf(r.createdAt)}>{relative(r.createdAt)} · {whenOf(r.createdAt)}</time>
                        {entity === "social-post" && r.changes?.media && <details>
                          <summary>Artwork versions</summary>
                          {([0, 1] as const).map((index) => <div key={index}>
                            <small>{index === 0 ? "Previous artwork" : "Updated artwork"}</small>
                            <ul>{mediaLinks(r.changes!.media[index]).map((media, i) => <li key={media.url + i}><a href={media.url} target="_blank" rel="noopener noreferrer">{media.name || `Open file ${i + 1}`} ↗</a></li>)}</ul>
                          </div>)}
                        </details>}
                        {lines.length > 0 && r.action !== "delete" && (
                          <ul className="act-changes">
                            {lines.map((l) => (
                              <li key={l.field}>
                                <span className="f">{l.label}</span>
                                {r.action === "create" ? <span className="to">{l.to}</span> : <><span className="from">{l.from}</span><span className="arr" aria-label="changed to">→</span><span className="to">{l.to}</span></>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          {list.length > 15 && !showAll && <button type="button" className="act-more sm" onClick={() => setShowAll(true)}>Show all {list.length}</button>}
        </div>
      )}
    </section>
  );
}
