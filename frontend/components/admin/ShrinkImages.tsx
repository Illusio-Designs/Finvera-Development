"use client";
/* Settings card (admins): re-compress images uploaded before compression was
   added. Calls POST /uploads/optimize-existing in batches of 20 until nothing
   is left, with a progress bar and the space saved. */
import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ImageDownloadIcon } from "@hugeicons/core-free-icons";
import { api, trackApi } from "@/lib/adminApi";
import { userRoles } from "@/lib/permissions";

const mb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(0, Math.round(b / 1024))} KB`);
const NOT_INSTALLED = "Image compression isn't installed on the server yet — in cPanel open the Node.js app and click Run NPM Install.";

export default function ShrinkImages() {
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [left, setLeft] = useState<number | null>(null);
  const [saved, setSaved] = useState(0);
  const [failed, setFailed] = useState(0);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "warn"; text: string } | null>(null);
  const stop = useRef(false);

  useEffect(() => { api.me().then((r: any) => setAdmin(userRoles(r?.user ?? r).includes("admin"))).catch(() => {}); }, []);
  useEffect(() => () => { stop.current = true; }, []);
  if (!admin) return null;

  async function run() {
    setBusy(true); setMsg(null); setDone(0); setSaved(0); setFailed(0); setLeft(null);
    stop.current = false;
    let total = 0, bytes = 0, errs = 0;
    try {
      for (let round = 0; round < 500 && !stop.current; round++) {
        const r = await trackApi.optimizeImages(20);
        total += r.processed; bytes += r.savedBytes || 0; errs += r.errors?.length || 0;
        setDone(total); setSaved(bytes); setFailed(errs); setLeft(r.remaining);
        // Stop when nothing is left, or when a round made no progress (only files that fail).
        if (!r.remaining || (!r.processed && r.errors?.length)) break;
      }
      setMsg(stop.current ? { kind: "warn", text: "Stopped. Run it again any time to carry on." }
        : { kind: "ok", text: total ? `Done — ${total} image${total === 1 ? "" : "s"} shrunk, ${mb(bytes)} saved.` : "All images are already compressed." });
    } catch (e) {
      const status = (e as { status?: number })?.status;
      setMsg({ kind: "err", text: status === 503 ? NOT_INSTALLED : e instanceof Error ? e.message : "Something went wrong." });
    } finally { setBusy(false); }
  }

  const all = done + (left || 0);
  const pct = all ? Math.round((100 * done) / all) : 0;
  return (
    <section className="adm-group exp-shrink" aria-label="Shrink old images">
      <div className="exp-shrink-head">
        <span className="exp-shrink-ic"><HugeiconsIcon icon={ImageDownloadIcon} size={20} strokeWidth={1.8} /></span>
        <div>
          <h3>Shrink old images</h3>
          <p className="gsub">New uploads are compressed automatically. This shrinks images uploaded before that, so pages load faster and the server has more space. Pictures keep their look and their links.</p>
        </div>
      </div>
      {(busy || left !== null) && (
        <div className="exp-progress" aria-live="polite">
          <div className="exp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={busy && left === null ? undefined : pct}>
            <span style={{ width: busy && left === null ? "8%" : `${pct}%` }} className={busy && left === null ? "pulse" : ""} />
          </div>
          <div className="exp-stats">
            <span><b>{done}</b> done{left ? ` · ${left} to go` : ""}{failed ? ` · ${failed} skipped` : ""}</span>
            <span>Saved <b>{mb(saved)}</b></span>
          </div>
        </div>
      )}
      {msg && <div className={"adm-msg " + (msg.kind === "ok" ? "ok" : "err")}>{msg.text}</div>}
      <div className="exp-shrink-actions">
        <button type="button" className="adm-btn primary" onClick={run} disabled={busy}>
          {busy ? <><span className="spin" /> Shrinking…</> : left ? "Carry on" : "Shrink old images"}
        </button>
        {busy && <button type="button" className="adm-btn ghost" onClick={() => { stop.current = true; }}>Stop</button>}
      </div>
    </section>
  );
}
