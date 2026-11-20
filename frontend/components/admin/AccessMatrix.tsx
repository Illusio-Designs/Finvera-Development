"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Shield01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { workspaceApi } from "@/lib/adminApi";
import { ROLE_LABELS, type Area } from "@/lib/permissions";
import { LoadingRegion, Shimmer } from "./PageLoading";
import "./access-matrix.css";

const areas: { id: Area; label: string }[] = [
  { id: "content", label: "Content" }, { id: "leads", label: "Leads" }, { id: "contact", label: "Contact" },
  { id: "seo", label: "SEO" }, { id: "settings", label: "Settings" }, { id: "users", label: "Users" },
  { id: "renewals", label: "Renewals" }, { id: "social", label: "Social media" },
];

type RoleAccess = { role: string; areas: Area[] };
const roleLabel = (role: string) => role === "editor" ? "Content editor (legacy)" : ROLE_LABELS[role] || role;

export default function AccessMatrix() {
  const [roles, setRoles] = useState<RoleAccess[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    workspaceApi.access().then((data: { roles: RoleAccess[] }) => {
      if (active) setRoles(data.roles);
    }).catch((error: Error) => {
      if (active) setError(error.message || "Could not load role permissions.");
    });
    return () => { active = false; };
  }, [attempt]);

  return <details className="sys-card access-matrix">
    <summary>
      <span className="access-matrix-icon"><HugeiconsIcon icon={Shield01Icon} size={20} aria-hidden="true" /></span>
      <span className="access-matrix-heading"><strong>Access by role</strong><small>Workspace permissions</small></span>
      <HugeiconsIcon className="access-matrix-chevron" icon={ArrowDown01Icon} size={18} aria-hidden="true" />
    </summary>
    <div className="access-matrix-content">
      <p className="fw-caption">Permissions combine across roles. Social media access also depends on assigned brands.</p>
      {error ? <div className="access-matrix-error" role="alert">
        <p>{error}</p><button type="button" className="adm-btn ghost"
          onClick={() => { setError(""); setAttempt(value => value + 1); }}>Try again</button>
      </div> : !roles ? <LoadingRegion label="Loading role permissions…">
        <div className="access-matrix-shimmer">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(index => <Shimmer key={index} height={38} />)}</div>
      </LoadingRegion> : roles.length ? <>
        <div className="access-matrix-table">
          <table aria-label="Workspace permissions by role">
            <thead><tr><th scope="col">Role</th>{areas.map(area => <th key={area.id} scope="col">{area.label}</th>)}</tr></thead>
            <tbody>{roles.map(row => <tr key={row.role}>
              <th scope="row">{roleLabel(row.role)}</th>
              {areas.map(area => <td key={area.id}>{row.areas.includes(area.id)
                ? <span className="access-matrix-granted"><HugeiconsIcon icon={Tick02Icon} size={15} aria-hidden="true" /><span className="access-matrix-sr-only">Allowed</span></span>
                : <><span className="access-matrix-denied" aria-hidden="true">—</span><span className="access-matrix-sr-only">No access</span></>}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
        <ul className="access-matrix-roles" aria-label="Granted areas by role">
          {roles.map(row => <li key={row.role}><strong>{roleLabel(row.role)}</strong>
            <div>{areas.filter(area => row.areas.includes(area.id)).map(area => <span key={area.id}>{area.label}</span>)}
              {!row.areas.length && <small>No areas granted</small>}
            </div>
          </li>)}
        </ul>
      </> : <p className="fw-caption">No permissions were returned.</p>}
    </div>
  </details>;
}
