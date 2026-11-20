"use client";

import { useEffect, useState } from "react";
import { LoadingRegion, Shimmer } from "@/components/admin/PageLoading";
import { apiErr, peopleApi } from "@/lib/adminApi";
import { employeeDocumentLabels, type EmployeeDocument, type EmployeeDocumentKind } from "@/lib/peopleTypes";

const kinds = Object.keys(employeeDocumentLabels) as EmployeeDocumentKind[];
const extensions: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export default function EmployeeDocuments({ employeeId }: { employeeId?: number }) {
  const [items, setItems] = useState<EmployeeDocument[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const [downloading, setDownloading] = useState<EmployeeDocumentKind | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    peopleApi.documents(employeeId)
      .then(rows => { if (active) setItems(rows); })
      .catch(error => { if (active) setLoadError(apiErr(error).message); });
    return () => { active = false; };
  }, [employeeId, attempt]);

  async function download(kind: EmployeeDocumentKind) {
    if (!employeeId || downloading) return;
    setDownloading(kind);
    setDownloadError("");
    try {
      const file = await peopleApi.downloadDocument(employeeId, kind);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}.${extensions[file.type] || "bin"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(apiErr(error).message);
    } finally {
      setDownloading(null);
    }
  }

  return <section className="people-documents people-wide" aria-label="Employee documents">
    <header><h3>Employee documents</h3><p className="fw-caption">Admin access only. PDF, JPG, or PNG up to 2 MB each.</p></header>
    {loadError && <div className="people-actions" role="alert"><p>{loadError}</p>
      <button type="button" className="sh-btn" onClick={() => { setLoadError(""); setAttempt(value => value + 1); }}>Retry</button>
    </div>}
    {downloadError && <p className="fw-error" role="alert">{downloadError}</p>}
    <div className="people-document-grid">{kinds.map(kind => {
      const label = employeeDocumentLabels[kind];
      const onFile = items?.some(item => item.kind === kind);
      return <div className="people-document" key={kind}>
        <div className="people-document-label">
          <label htmlFor={`employee-document-${kind}`}>{label}</label>
          {employeeId && (items ? <small>{onFile ? "On file" : "Missing"}</small> : !loadError &&
            <LoadingRegion label={`Checking ${label}`}><Shimmer width={45} height={13} /></LoadingRegion>)}
        </div>
        <input id={`employee-document-${kind}`} name={kind} type="file" accept=".pdf,.jpg,.jpeg,.png"
          onChange={event => {
            const input = event.currentTarget;
            input.setCustomValidity((input.files?.[0]?.size ?? 0) > 2 * 1024 * 1024 ? "Choose a file up to 2 MB." : "");
            input.reportValidity();
          }} />
        {onFile && <button type="button" className="sh-btn" aria-label={`Download ${label}`} disabled={downloading !== null}
          onClick={() => download(kind)}>{downloading === kind ? "Downloading…" : "Download"}</button>}
      </div>;
    })}</div>
  </section>;
}
