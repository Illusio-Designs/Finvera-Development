"use client";
/* Lead follow-ups on the Leads page:
   - FollowUpStrip: Overdue / Today / This week counts that filter the list.
   - LeadTouchPanel (inside the lead drawer): call / WhatsApp / email the lead,
     log a touch with a note and the next follow-up date, and the touches so far. */
import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Call02Icon, WhatsappIcon, Mail01Icon, Video01Icon, Note01Icon, Alert02Icon, Clock01Icon, Calendar03Icon, Link04Icon } from "@hugeicons/core-free-icons";
import { trackApi, type LeadTouch } from "@/lib/adminApi";
import DatePicker from "@/components/ui/DatePicker";
import { toast } from "@/lib/toast";
import { addDays, istToday, relative, whenOf, initials, avatarColor } from "@/lib/activityText";

export type FollowRange = "" | "overdue" | "today" | "week";
const OPEN = (l: any) => !["won", "lost"].includes(String(l.stage || ""));
const dayOf = (l: any) => String(l.nextFollowUpAt || l.nextFollowUp || "").slice(0, 10);

/** Does this lead fall in the follow-up range? (India dates, like the server.) */
export function inRange(l: any, range: FollowRange, today = istToday()) {
  if (!range) return true;
  const d = dayOf(l);
  if (!OPEN(l) || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if (range === "overdue") return d < today;
  if (range === "today") return d === today;
  return d >= today && d <= addDays(today, 6);
}

export function FollowUpStrip({ rows, value, onChange }: { rows: any[]; value: FollowRange; onChange: (v: FollowRange) => void }) {
  const today = istToday();
  const n = (r: FollowRange) => rows.filter((l) => inRange(l, r, today)).length;
  const items: { k: FollowRange; label: string; sub: string; tone: string; icon: typeof Alert02Icon }[] = [
    { k: "overdue", label: "Overdue", sub: "Follow-up date has passed", tone: "red", icon: Alert02Icon },
    { k: "today", label: "Today", sub: "Follow up today", tone: "amber", icon: Clock01Icon },
    { k: "week", label: "This week", sub: "Next 7 days", tone: "blue", icon: Calendar03Icon },
  ];
  return (
    <div className="fu-strip" role="group" aria-label="Follow-ups">
      <span className="fu-strip-title">Follow-ups</span>
      {items.map((it) => {
        const count = n(it.k);
        const on = value === it.k;
        return (
          <button key={it.k} type="button" className={`fu-tile ${it.tone}${on ? " on" : ""}${count ? "" : " zero"}`} aria-pressed={on}
            onClick={() => onChange(on ? "" : it.k)} title={on ? "Show all leads" : `Show only: ${it.label.toLowerCase()}`}>
            <span className="ic"><HugeiconsIcon icon={it.icon} size={16} strokeWidth={1.8} /></span>
            <span className="tx"><b>{count}</b><span>{it.label}</span></span>
          </button>
        );
      })}
      {value && <button type="button" className="fu-showall" onClick={() => onChange("")}>Show all leads</button>}
    </div>
  );
}

/* "+91 98200 11223" → "919820011223"; a bare 10-digit Indian mobile gets 91. */
export function waDigits(phone?: string | null) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10 && /^[6-9]/.test(d)) d = "91" + d;
  return d.length >= 8 ? d : "";
}

type TouchType = LeadTouch["type"];
const TYPES: { k: TouchType; label: string; icon: typeof Call02Icon }[] = [
  { k: "call", label: "Call", icon: Call02Icon },
  { k: "whatsapp", label: "WhatsApp", icon: WhatsappIcon },
  { k: "email", label: "Email", icon: Mail01Icon },
  { k: "meeting", label: "Meeting", icon: Video01Icon },
  { k: "note", label: "Note", icon: Note01Icon },
];
const TYPE_WORD: Record<string, string> = { call: "Call", whatsapp: "WhatsApp", email: "Email", meeting: "Meeting", note: "Note" };
const ICON_OF: Record<string, typeof Call02Icon> = Object.fromEntries(TYPES.map((t) => [t.k, t.icon]));
type Pick = "keep" | "tomorrow" | "3d" | "week" | "date" | "none";
const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export function LeadTouchPanel({ lead, patch, reload, showContact = true, preset }: {
  lead: Record<string, any>; patch: (v: Record<string, any>) => void; reload: () => Promise<void>;
  /* The Call / WhatsApp / Email row (off when the page shows those itself). */
  showContact?: boolean;
  /* Pre-pick the touch type, e.g. after the Call button elsewhere was used; `at` makes a repeat count. */
  preset?: { type: TouchType; at: number } | null;
}) {
  const [type, setType] = useState<TouchType>(preset?.type || "call");
  useEffect(() => { if (preset) setType(preset.type); }, [preset]);
  const [note, setNote] = useState("");
  const [pick, setPick] = useState<Pick>("keep");
  const [date, setDate] = useState("");
  const [fuNote, setFuNote] = useState("");
  const [meetAt, setMeetAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [touches, setTouches] = useState<LeadTouch[] | null>(null);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setTouches(null);
    trackApi.touches(lead.id).then((t) => { if (alive) setTouches(Array.isArray(t) ? t : []); }).catch(() => alive && setTouches([]));
    return () => { alive = false; };
  }, [lead.id]);

  const today = istToday();
  const current = dayOf(lead);
  const nextDate = pick === "tomorrow" ? addDays(today, 1) : pick === "3d" ? addDays(today, 3) : pick === "week" ? addDays(today, 7) : pick === "date" ? date : null;
  const wa = waDigits(lead.phone);
  const tel = String(lead.phone || "").replace(/[^\d+]/g, "");

  async function save() {
    if (pick === "date" && !date) { toast("Pick the follow-up date", "warn"); return; }
    setBusy(true);
    try {
      const body: Parameters<typeof trackApi.logTouch>[1] = { type };
      if (note.trim()) body.note = note.trim();
      if (pick !== "keep") {
        body.nextFollowUpAt = pick === "none" ? null : nextDate;
        if (fuNote.trim()) body.followUpNote = fuNote.trim();
      }
      if (type === "meeting" && meetAt) body.meetingAt = new Date(meetAt).toISOString();
      const r = await trackApi.logTouch(lead.id, body);
      const l = r.lead || {};
      patch({
        lastContactedAt: l.lastContactedAt ?? lead.lastContactedAt ?? null,
        nextFollowUpAt: l.nextFollowUpAt ?? null, nextFollowUp: l.nextFollowUp ?? l.nextFollowUpAt ?? null,
        followUpNote: l.followUpNote ?? null, meetingAt: l.meetingAt ?? null,
      });
      setTouches((t) => [r.touch, ...(t || [])]);
      setNote(""); setFuNote(""); setMeetAt(""); setPick("keep"); setDate("");
      toast(`${TYPE_WORD[type]} logged`, "ok", {
        description: body.nextFollowUpAt ? `Next follow-up ${fmtDay(body.nextFollowUpAt)}` : body.nextFollowUpAt === null ? "Follow-up cleared" : String(lead.name || ""),
      });
      window.dispatchEvent(new Event("fv-badges"));
      reload();
    } catch (e) {
      toast("Couldn't log it", "err", { description: e instanceof Error ? e.message : "Try again." });
    } finally { setBusy(false); }
  }

  const list = touches || [];
  const shown = all ? list : list.slice(0, 3);
  const PICKS: { k: Pick; label: string }[] = [
    { k: "keep", label: current ? `Keep ${fmtDay(current)}` : "Not now" },
    { k: "tomorrow", label: "Tomorrow" }, { k: "3d", label: "In 3 days" }, { k: "week", label: "Next week" }, { k: "date", label: "Pick date" },
    ...(current ? [{ k: "none" as Pick, label: "No follow-up" }] : []),
  ];

  return (
    <section className="fu-panel" aria-label="Follow-up">
      {showContact && <div className="fu-contact">
        {tel ? <a className="fu-cbtn" href={`tel:${tel}`} onClick={() => setType("call")}><HugeiconsIcon icon={Call02Icon} size={16} />Call</a>
          : <span className="fu-cbtn off" title="Add a phone number first"><HugeiconsIcon icon={Call02Icon} size={16} />Call</span>}
        {wa ? <a className="fu-cbtn wa" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" onClick={() => setType("whatsapp")}><HugeiconsIcon icon={WhatsappIcon} size={16} />WhatsApp</a>
          : <span className="fu-cbtn off" title="Add a phone number first"><HugeiconsIcon icon={WhatsappIcon} size={16} />WhatsApp</span>}
        {lead.email ? <a className="fu-cbtn" href={`mailto:${lead.email}`} onClick={() => setType("email")}><HugeiconsIcon icon={Mail01Icon} size={16} />Email</a>
          : <span className="fu-cbtn off" title="Add an email first"><HugeiconsIcon icon={Mail01Icon} size={16} />Email</span>}
        {/^https?:\/\//i.test(String(lead.meetingUrl || "")) && <a className="fu-cbtn" href={String(lead.meetingUrl)} target="_blank" rel="noopener noreferrer"><HugeiconsIcon icon={Link04Icon} size={16} />Join meeting</a>}
      </div>}

      <div className="fu-log">
        <div className="fu-log-head"><b>Log a touch</b>{lead.lastContactedAt && <span>Last contacted {relative(lead.lastContactedAt)}</span>}</div>
        <div className="fu-types" role="radiogroup" aria-label="What did you do?">
          {TYPES.map((t) => (
            <button key={t.k} type="button" role="radio" aria-checked={type === t.k} className={"fu-type" + (type === t.k ? " on" : "")} onClick={() => setType(t.k)}>
              <HugeiconsIcon icon={t.icon} size={16} strokeWidth={1.8} /><span>{t.label}</span>
            </button>
          ))}
        </div>
        <textarea className="fu-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="Note"
          placeholder={type === "note" ? "Write a note…" : type === "meeting" ? "What was agreed? (optional)" : "What happened? (optional)"} />
        {type === "meeting" && (
          <label className="fu-inline"><span>Meeting time</span><input type="datetime-local" value={meetAt} onChange={(e) => setMeetAt(e.target.value)} /></label>
        )}
        <div className="fu-next">
          <span className="fu-next-label">Next follow-up</span>
          <div className="fu-picks">
            {PICKS.map((p) => (
              <button key={p.k} type="button" aria-pressed={pick === p.k} className={"fu-pick" + (pick === p.k ? " on" : "")} onClick={() => setPick(p.k)}>{p.label}</button>
            ))}
          </div>
          {pick === "date" && <div className="fu-date"><DatePicker value={date} onChange={setDate} placeholder="Choose a date" /></div>}
          {pick !== "keep" && pick !== "none" && (
            <input className="fu-fnote" value={fuNote} onChange={(e) => setFuNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} placeholder="What to do next? e.g. Send the revised quote" aria-label="Follow-up note" />
          )}
          {nextDate && <small className="fu-hint">Follow up on <b>{fmtDay(nextDate)}</b></small>}
        </div>
        <button type="button" className="adm-btn primary fu-save" onClick={save} disabled={busy}>
          {busy ? <><span className="spin" /> Saving…</> : type === "note" ? "Save note" : `Log ${type === "whatsapp" ? "WhatsApp" : TYPE_WORD[type].toLowerCase()}`}
        </button>
      </div>

      <div className="fu-touches">
        <div className="fu-log-head"><b>Touches</b>{list.length > 0 && <span>{list.length}</span>}</div>
        {!touches ? <div className="fu-empty">Loading…</div>
          : !list.length ? <div className="fu-empty">No calls or notes yet. Log the first one above.</div>
          : (
            <ol className="fu-tlist">
              {shown.map((t) => (
                <li key={t.id} className={"fu-t t-" + t.type}>
                  <span className="fu-t-ic"><HugeiconsIcon icon={ICON_OF[t.type] || Note01Icon} size={15} strokeWidth={1.8} /></span>
                  <div>
                    <div className="fu-t-line"><b>{TYPE_WORD[t.type] || t.type}</b>
                      <span className="act-av xs" style={{ background: avatarColor(t.userName) }} aria-hidden>{initials(t.userName)}</span>
                      <span>{t.userName || "Someone"}</span>
                      <time dateTime={t.createdAt} title={whenOf(t.createdAt)}>{relative(t.createdAt)}</time></div>
                    {t.note && <p>{t.note}</p>}
                    {t.nextFollowUpAt && <small>Next follow-up set: {fmtDay(String(t.nextFollowUpAt).slice(0, 10))}</small>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        {list.length > 3 && !all && <button type="button" className="act-more sm" onClick={() => setAll(true)}>Show all {list.length}</button>}
      </div>
    </section>
  );
}
