"use client";
/* "Export to Excel" — asks GET /export/:entity for the rows (with the page's
   current filters) and saves a real .xlsx built in the browser. */
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download04Icon } from "@hugeicons/core-free-icons";
import { trackApi } from "@/lib/adminApi";
import { downloadXlsx, exportFileName } from "@/lib/xlsxWrite";
import { toast } from "@/lib/toast";

type Q = Record<string, string | number | boolean | null | undefined>;

export async function exportToExcel(entity: string, params: Q = {}, opts: { file?: string; sheet?: string } = {}) {
  const data = await trackApi.exportRows(entity, params);
  const file = exportFileName(opts.file || entity);
  downloadXlsx(file, [{ name: opts.sheet || entity, columns: data.columns, rows: data.rows }]);
  return { ...data, file };
}

export default function ExportButton({ entity, params, file, sheet, label = "Export", className = "", compact = false }: {
  entity: string; params?: Q | (() => Q); file?: string; sheet?: string; label?: string; className?: string; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const q = typeof params === "function" ? params() : params || {};
      const r = await exportToExcel(entity, q, { file, sheet });
      if (!r.total) toast("Nothing to export", "info", { description: "No rows match the current filters — the file has only the headings." });
      else toast(`Exported ${r.total.toLocaleString("en-IN")} row${r.total === 1 ? "" : "s"}`, "ok", { description: r.truncated ? `${r.file} · only the first 20,000 rows — narrow the filters for the rest.` : r.file });
    } catch (e) {
      toast("Couldn't export", "err", { description: e instanceof Error ? e.message : "Try again in a moment." });
    } finally { setBusy(false); }
  }
  return (
    <button type="button" className={"adm-btn ghost exp-btn " + className + (compact ? " compact" : "")} onClick={go} disabled={busy}
      aria-label={compact ? `${label} to Excel` : undefined} title="Download as an Excel file">
      {busy ? <span className="spin exp-spin" aria-hidden /> : <HugeiconsIcon icon={Download04Icon} size={16} strokeWidth={1.8} />}
      {!compact && <span>{busy ? "Preparing…" : label}</span>}
    </button>
  );
}
