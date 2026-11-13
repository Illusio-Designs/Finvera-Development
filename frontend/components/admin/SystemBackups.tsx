"use client";
import { useActivity } from "@/lib/useActivity";
/* Backups card (System page): list, back up now, download, check, delete,
   and how to restore. Admin only (the API answers 403 otherwise). */
import { useCallback, useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DatabaseBackupIcon, Download04Icon, Delete02Icon, CheckmarkCircle02Icon, Alert02Icon, ArrowDown01Icon,
  CloudServerIcon, InformationCircleIcon, ShieldUserIcon,
} from "@hugeicons/core-free-icons";
import PageLoading from "@/components/admin/PageLoading";
import { opsApi, type BackupCheck, type BackupList } from "@/lib/adminApi";
import { toast } from "@/lib/toast";
import { dialog } from "@/lib/dialog";
import { fmtBytes, fmtDateTime, timeAgo } from "@/lib/opsFormat";

const Ic = ({ i, size = 16 }: { i: any; size?: number }) => <HugeiconsIcon icon={i} size={size} strokeWidth={1.8} />;

function checkText(r: BackupCheck): { ok: boolean; text: string } {
  if (!r.ok) return { ok: false, text: r.error || "The file is damaged." };
  if (!r.complete) return { ok: false, text: "The file is incomplete — it stops part way. Make a new backup." };
  const counts = `${r.tables ?? "?"} tables, ${(r.rows ?? 0).toLocaleString("en-IN")} rows`;
  if (r.expected && r.matches === false) {
    return { ok: false, text: `Readable, but the counts don't match: ${counts} found, ${r.expected.tables} tables, ${r.expected.rows.toLocaleString("en-IN")} rows expected.` };
  }
  return { ok: true, text: `Complete — ${counts}${r.expected ? ", matches" : ""}` };
}

export default function SystemBackups({ offsiteEnabled, onChange, refreshKey }: { offsiteEnabled: boolean | null; onChange?: () => void; refreshKey?: number }) {
  const [list, setList] = useState<BackupList | null>(null);
  const [error, setError] = useState("");
  const [making, setMaking] = useActivity();
  const [busy, setBusy] = useState<Record<string, "check" | "download" | "delete" | undefined>>({});
  const [checks, setChecks] = useState<Record<string, { ok: boolean; text: string }>>({});
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try { setList(await opsApi.listBackups()); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load backups"); }
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  // While a backup runs on the server (e.g. the nightly one), check back every few seconds.
  useEffect(() => {
    if (poll.current) clearTimeout(poll.current);
    if (list?.running && !making) poll.current = setTimeout(load, 4000);
    return () => { if (poll.current) clearTimeout(poll.current); };
  }, [list, making, load]);

  async function backUpNow() {
    setMaking(true);
    try {
      const b = await opsApi.createBackup();
      toast("Backup made", "ok", { description: `${fmtBytes(b.size)} · ${b.tables ?? "?"} tables, ${(b.rows ?? 0).toLocaleString("en-IN")} rows` });
      await load(); onChange?.();
    } catch (e) {
      toast("Backup failed", "err", { description: e instanceof Error ? e.message : "" });
      await load();
    } finally { setMaking(false); }
  }
  const setB = (name: string, v: "check" | "download" | "delete" | undefined) => setBusy((b) => ({ ...b, [name]: v }));
  async function check(name: string) {
    setB(name, "check");
    try {
      const r = await opsApi.verifyBackup(name);
      setChecks((c) => ({ ...c, [name]: checkText(r) }));
    } catch (e) {
      setChecks((c) => ({ ...c, [name]: { ok: false, text: e instanceof Error ? e.message : "Couldn't check it" } }));
    } finally { setB(name, undefined); }
  }
  async function download(name: string) {
    setB(name, "download");
    try { await opsApi.downloadBackup(name); }
    catch (e) { toast("Couldn't download", "err", { description: e instanceof Error ? e.message : "" }); }
    finally { setB(name, undefined); }
  }
  async function remove(name: string, label: string) {
    if (!(await dialog.confirm({ title: "Delete this backup?", message: `${label} will be removed from the server. This can't be undone.`, danger: true, confirmText: "Delete" }))) return;
    setB(name, "delete");
    try { await opsApi.deleteBackup(name); toast("Backup deleted", "ok", { description: label }); await load(); onChange?.(); }
    catch (e) { toast("Couldn't delete", "err", { description: e instanceof Error ? e.message : "" }); }
    finally { setB(name, undefined); }
  }

  const running = making || !!list?.running;
  const last = list?.lastResult;

  return (
    <section className="sys-card" id="backups" aria-labelledby="sys-backups-h">
      <div className="sys-card-h">
        <span className="sys-ic"><Ic i={DatabaseBackupIcon} size={20} /></span>
        <div>
          <h2 id="sys-backups-h">Backups</h2>
          <p>A full copy of the database is made every night. The newest {list?.keep ?? 14} are kept on the server.</p>
        </div>
        <button type="button" className="sys-btn primary" onClick={backUpNow} disabled={running || !list}>
          {running ? <><span className="sys-spin" aria-hidden="true" />Backing up…</> : <><Ic i={DatabaseBackupIcon} />Back up now</>}
        </button>
      </div>

      {error && <div className="sys-note bad" role="alert"><Ic i={Alert02Icon} /><span>{error}</span><button type="button" className="sys-btn" onClick={load}>Retry</button></div>}
      {last && last.ok === false && (
        <div className="sys-note bad" role="status"><Ic i={Alert02Icon} />
          <span><b>The last backup failed</b> ({timeAgo(last.at)}, {last.kind}): {last.error}</span>
        </div>
      )}

      {!list ? error ? null : <PageLoading label="Loading backups…" variant="list" />
        : list.items.length === 0 ? <div className="sys-empty">No backups yet. Click “Back up now” to make the first one.</div>
        : (
          <ul className="sys-bk">
            {list.items.map((b) => {
              const label = fmtDateTime(b.createdAt);
              const r = checks[b.name];
              const bz = busy[b.name];
              return (
                <li key={b.name}>
                  <div className="sys-bk-i">
                    <b>{label}<span className={"sys-kind " + b.kind}>{b.kind === "auto" ? "Auto" : "Manual"}</span></b>
                    <small>{fmtBytes(b.size)}{b.tables != null && ` · ${b.tables} tables, ${(b.rows ?? 0).toLocaleString("en-IN")} rows`} · {timeAgo(b.createdAt)}</small>
                  </div>
                  <div className="sys-bk-a">
                    <button type="button" className="sys-btn" onClick={() => download(b.name)} disabled={!!bz} aria-label={`Download backup from ${label}`}>
                      {bz === "download" ? <span className="sys-spin" aria-hidden="true" /> : <Ic i={Download04Icon} />}Download
                    </button>
                    <button type="button" className="sys-btn" onClick={() => check(b.name)} disabled={!!bz} aria-label={`Check backup from ${label}`}>
                      {bz === "check" ? <span className="sys-spin" aria-hidden="true" /> : <Ic i={CheckmarkCircle02Icon} />}Check
                    </button>
                    <button type="button" className="sys-btn danger" onClick={() => remove(b.name, label)} disabled={!!bz} aria-label={`Delete backup from ${label}`}>
                      {bz === "delete" ? <span className="sys-spin" aria-hidden="true" /> : <Ic i={Delete02Icon} />}Delete
                    </button>
                  </div>
                  {bz === "check" && <div className="sys-bk-r" role="status" style={{ background: "var(--bg-2)", color: "var(--muted)" }}>Reading the whole file… this can take a few seconds.</div>}
                  {r && bz !== "check" && (
                    <div className={"sys-bk-r " + (r.ok ? "ok" : "bad")} role="status">
                      <Ic i={r.ok ? CheckmarkCircle02Icon : Alert02Icon} />{r.text}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

      {offsiteEnabled != null && (offsiteEnabled ? (
        <div className="sys-note ok" style={{ marginTop: 14 }}><Ic i={CloudServerIcon} />
          <span><b>Off-server downloads are configured.</b> The server allows protected backup downloads. Check the “db-backup” workflow in GitHub Actions to confirm that recent off-server copies were saved successfully.</span>
        </div>
      ) : (
        <div className="sys-note warn" style={{ marginTop: 14 }}><Ic i={CloudServerIcon} />
          <span><b>Off-server copy is off.</b> Backups are only on this server. To also keep a daily copy outside it: pick a long random password, add it as <code>BACKUP_TOKEN=…</code> in the server’s <code>.env</code> (cPanel, then restart the app), and add the same value as a GitHub secret named <code>BACKUP_TOKEN</code> (repository → Settings → Secrets and variables → Actions). The “db-backup” workflow then keeps a copy for 30 days.</span>
        </div>
      ))}

      <details className="sys-details">
        <summary><Ic i={InformationCircleIcon} />How to restore a backup<span style={{ flex: 1 }} /><Ic i={ArrowDown01Icon} /></summary>
        <ol>
          <li>Click <b>Download</b> on the backup you want. You get a <b>.sql.gz</b> file — don’t unzip it.</li>
          <li>Open <b>cPanel</b> and go to <b>phpMyAdmin</b>.</li>
          <li>On the left, click the Finvera <b>database</b>.</li>
          <li>Open the <b>Import</b> tab and <b>choose the .sql.gz file</b>.</li>
          <li>Click <b>Import</b> (or Go) and wait until it says it finished.</li>
        </ol>
        <div className="sys-note warn" style={{ margin: "0 14px 14px" }}><Ic i={ShieldUserIcon} />
          <span><b>This replaces everything.</b> Every table is dropped and recreated from the file, so anything saved after the backup is lost. Click <b>Back up now</b> first if you might need today’s data.</span>
        </div>
      </details>
    </section>
  );
}
