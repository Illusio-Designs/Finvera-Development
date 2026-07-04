import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminLeads() {
  return (
    <ResourceManager
      resource="leads"
      title="Leads"
      subtitle="Business-development pipeline — track prospects from first touch to won."
      columns={[
        { name: "name", label: "Lead" },
        { name: "company", label: "Company" },
        { name: "purpose", label: "Purpose" },
        { name: "value", label: "Amount", type: "money" },
        { name: "owner", label: "Owner" },
        { name: "progress", label: "Progress", type: "progress" },
        { name: "stage", label: "Stage", type: "status" },
      ]}
      calendlyUrl={process.env.NEXT_PUBLIC_CALENDLY_URL}
      defaults={{ stage: "new", priority: "medium", source: "Website", value: 0, progress: 0 }}
      fields={[
        { name: "_meeting", label: "Meeting", type: "calendly" },
        { name: "name", label: "Contact name", placeholder: "Full name" },
        { name: "company", label: "Company", type: "text" },
        { name: "purpose", label: "Purpose", type: "text", placeholder: "e.g. CRM Build, SaaS Revamp" },
        { name: "email", label: "Email", type: "text", placeholder: "name@company.com" },
        { name: "phone", label: "Phone", type: "text" },
        { name: "source", label: "Source", type: "select", options: ["Website", "Referral", "LinkedIn", "Cold outreach", "Event", "Other"] },
        { name: "stage", label: "Stage", type: "select", options: ["new", "contacted", "qualified", "proposal", "won", "lost"] },
        { name: "value", label: "Estimated value (₹)", type: "number", placeholder: "e.g. 25000" },
        { name: "progress", label: "Progress (%)", type: "number", placeholder: "0–100" },
        { name: "owner", label: "Owner (BD)", type: "text", placeholder: "Who owns this lead" },
        { name: "priority", label: "Priority", type: "select", options: ["low", "medium", "high"] },
        { name: "nextFollowUp", label: "Next follow-up", type: "date" },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "Context, next steps, objections…" },
        { name: "position", label: "Order", type: "number" },
      ]}
    />
  );
}
