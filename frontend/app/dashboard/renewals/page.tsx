import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminRenewals() {
  return (
    <ResourceManager
      resource="renewals"
      title="Renewals"
      subtitle="Maintenance & renewal invoices for completed projects — track what's due and get reminded before each renewal date."
      columns={[
        { name: "client", label: "Client" },
        { name: "project", label: "Project / service" },
        { name: "amount", label: "Amount", type: "money" },
        { name: "cycle", label: "Cycle", type: "status" },
        { name: "renewalDate", label: "Next renewal", type: "renewal" },
        { name: "owner", label: "Owner" },
        { name: "status", label: "Status", type: "status" },
      ]}
      defaults={{ cycle: "yearly", status: "active", amount: 0, position: 0 }}
      fields={[
        { name: "client", label: "Client / company", placeholder: "e.g. Crosscoin" },
        { name: "project", label: "Project / service", type: "text", placeholder: "e.g. Website maintenance, Hosting, Domain" },
        { name: "amount", label: "Renewal amount (₹)", type: "number", placeholder: "e.g. 15000" },
        { name: "cycle", label: "Billing cycle", type: "select", options: ["monthly", "quarterly", "half-yearly", "yearly"] },
        { name: "renewalDate", label: "Next renewal date", type: "date" },
        { name: "lastInvoiced", label: "Last invoiced on", type: "date" },
        { name: "owner", label: "Owner", type: "userselect", placeholder: "Assign a team member" },
        { name: "email", label: "Billing email", type: "text", placeholder: "accounts@client.com" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "status", label: "Status", type: "select", options: ["active", "paused", "cancelled"] },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "Scope of maintenance, invoice terms, reminders…" },
        { name: "position", label: "Order", type: "number" },
      ]}
    />
  );
}
