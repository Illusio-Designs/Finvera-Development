/* Turn a before/after pair into short, human change notes for notifications,
   e.g. "go-live moved to 5 Nov, 7:00 PM (was 2 Nov)". */

const day = (d) => (d ? String(d).slice(0, 10) : "");
const fmtDate = (d) => (d ? new Date(day(d) + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "no date");
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = String(t).split(":").map(Number);
  if (Number.isNaN(h)) return "";
  return `${h % 12 || 12}:${String(m || 0).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const when = (d, t) => [fmtDate(d), fmtTime(t)].filter(Boolean).join(", ");
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const asArr = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) { try { return JSON.parse(v); } catch { return []; } }
  return [];
};

const STAGES = { planned: "Planned", client: "Need from client", production: "In production", approval: "Pending approval", ready: "Ready to post", posted: "Posted" };
const POST_FIELDS = {
  theme: "post theme", topic: "topic", caption: "caption", requirements: "requirements", reference: "reference",
  format: "format", festive: "day/festival", driveLink: "drive link", tags: "tags", keywords: "keywords",
  channels: "post links", remarks: "remarks", poc: "client contact", dataStatus: "data status", estimateHours: "time estimate",
};

/* → { kind: "stage"|"date"|"edit"|null, notes: [..], stage } */
function postChanges(before, p) {
  const notes = [];
  let kind = null;
  if (before.status !== p.status) { notes.push(`moved to ${STAGES[p.status] || p.status}`); kind = "stage"; }
  if (day(before.postDate) !== day(p.postDate) || String(before.postTime || "") !== String(p.postTime || "")) {
    notes.push(`go-live moved to ${when(p.postDate, p.postTime)} (was ${when(before.postDate, before.postTime)})`);
    kind = kind || "date";
  }
  if (day(before.dueDate) !== day(p.dueDate)) { notes.push(`start work moved to ${fmtDate(p.dueDate)}`); kind = kind || "date"; }
  const edited = Object.keys(POST_FIELDS).filter((f) => !same(before[f], p[f])).map((f) => `${POST_FIELDS[f]} edited`);
  if (edited.length) { notes.push(...edited); kind = kind || "edit"; }
  return { kind, notes };
}

module.exports = { postChanges, fmtDate, fmtTime, when, STAGES, asArr, day };
