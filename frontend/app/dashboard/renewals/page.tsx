"use client";
import ResourceManager from "@/components/admin/ResourceManager";
import { api } from "@/lib/adminApi";
import { dialog } from "@/lib/dialog";
import { toast } from "@/lib/toast";

const CYCLE_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, "half-yearly": 6, yearly: 12 };
const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
/* Same rule as the server: one billing cycle on from the date it was due. */
function nextDate(row: any) {
  const from = row.renewalDate ? String(row.renewalDate).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const [y, m, d] = from.split("-").map(Number);
  const n = CYCLE_MONTHS[row.cycle] || 12;
  const last = new Date(y, m - 1 + n + 1, 0).getDate();
  const t = new Date(y, m - 1 + n, Math.min(d, last));
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}
const label = (row: any) => (row.project ? `${row.client} — ${row.project}` : row.client);

function Actions({ row, reload }: { row: any; reload: () => Promise<void> }) {
  if (row.status === "cancelled") return <span className="adm-renew-ended">Terminated</span>;
  async function renew() {
    const next = nextDate(row);
    const remark = await dialog.prompt({
      title: `Renewed: ${label(row)}?`,
      message: `The next renewal date moves to ${fmt(next)} (${row.cycle || "yearly"}). Add a remark if you like: invoice number, amount received, anything to remember.`,
      placeholder: "e.g. Invoice #214 paid by NEFT",
      confirmText: "Mark as renewed",
      multiline: true,
    });
    if (remark === null) return;
    try { await api.renewRenewal(row.id, remark.trim()); await reload(); toast(`Renewed · next ${fmt(next)}`, "ok", { description: label(row) }); }
    catch (e: any) { toast("Couldn't mark it renewed", "err", { description: e.message }); }
  }
  async function terminate() {
    const remark = await dialog.prompt({
      title: `Terminate ${label(row)}?`,
      message: "It stops renewing and no more reminders are sent. You can make it active again from Edit. Why is it ending?",
      placeholder: "e.g. Client moved to another agency",
      confirmText: "Terminate",
      danger: true,
      multiline: true,
    });
    if (remark === null) return;
    try { await api.terminateRenewal(row.id, remark.trim()); await reload(); toast("Renewal terminated", "ok", { description: label(row) }); }
    catch (e: any) { toast("Couldn't terminate it", "err", { description: e.message }); }
  }
  return (
    <div className="adm-renew-acts">
      <button type="button" className="adm-renew-btn ok" onClick={renew}>Renewed</button>
      <button type="button" className="adm-renew-btn end" onClick={terminate}>Terminate</button>
    </div>
  );
}

export default function AdminRenewals() {
  return (
    <ResourceManager
      resource="renewals"
      title="Renewals"
      subtitle="Maintenance & renewal invoices for completed projects. Click Renewed when it's paid and the next date is set automatically, or Terminate when a client stops."
      columns={[
        { name: "client", label: "Client" },
        { name: "project", label: "Project / service" },
        { name: "amount", label: "Amount", type: "money" },
        { name: "cycle", label: "Cycle", type: "status" },
        { name: "renewalDate", label: "Next renewal", type: "renewal" },
        { name: "owner", label: "Owner" },
        { name: "status", label: "Status", type: "status" },
        { name: "notes", label: "Latest remark", type: "note" },
      ]}
      defaults={{ cycle: "yearly", status: "active", amount: 0, position: 0 }}
      rowActions={(row, reload) => <Actions row={row} reload={reload} />}
      fields={[
        { name: "client", label: "Client / company", placeholder: "e.g. Crosscoin" },
        { name: "project", label: "Project / service", type: "text", placeholder: "e.g. Website maintenance, Hosting, Domain" },
        { name: "amount", label: "Renewal amount (₹)", type: "number", placeholder: "e.g. 15000" },
        { name: "cycle", label: "Billing cycle", type: "select", options: ["monthly", "quarterly", "half-yearly", "yearly"] },
        { name: "renewalDate", label: "Next renewal date", type: "date" },
        { name: "lastInvoiced", label: "Last renewed on", type: "date" },
        { name: "owner", label: "Owner", type: "userselect", placeholder: "Assign a team member" },
        { name: "email", label: "Billing email", type: "text", placeholder: "accounts@client.com" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "status", label: "Status", type: "select", options: ["active", "paused", "cancelled"] },
        { name: "notes", label: "Remarks", type: "textarea", placeholder: "Scope, invoice terms, anything to remember. Renewed / Terminate add a dated line here." },
        { name: "position", label: "Order", type: "number" },
      ]}
    />
  );
}
