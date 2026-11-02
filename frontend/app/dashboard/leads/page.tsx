"use client";
import { Suspense, useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ResourceManager from "@/components/admin/ResourceManager";
import { FollowUpStrip, LeadTouchPanel, inRange, type FollowRange } from "@/components/admin/LeadFollowUps";
import { toast } from "@/lib/toast";

function Leads() {
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("lead"); // notification links: /dashboard/leads?lead=ID
  const [range, setRange] = useState<FollowRange>("");
  const rowFilter = useCallback((l: any) => inRange(l, range), [range]);

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
        { name: "nextFollowUpAt", label: "Follow-up", type: "followup" },
        { name: "progress", label: "Progress", type: "stageprogress" },
        { name: "stage", label: "Stage", type: "status" },
      ]}
      calendlyUrl={process.env.NEXT_PUBLIC_CALENDLY_URL}
      defaults={{ stage: "new", priority: "medium", source: "Website", value: 0, progress: 0 }}
      toolbar={(rows) => <FollowUpStrip rows={rows} value={range} onChange={setRange} />}
      rowFilter={range ? rowFilter : undefined}
      openId={openId}
      onOpened={(found) => {
        if (!found) toast("That lead isn't in the list any more", "warn", { description: "It may have been deleted." });
        router.replace("/dashboard/leads", { scroll: false });
      }}
      drawerExtra={({ editing, patch, reload }) => <LeadTouchPanel key={editing.id} lead={editing} patch={patch} reload={reload} />}
      // The older `nextFollowUp` column mirrors the new date; send both the same.
      beforeSave={(p) => ({ ...p, nextFollowUp: p.nextFollowUpAt ?? null })}
      exportParams={({ query }) => ({ q: query || undefined })}
      drawerTitle={(l) => ({
        title: l.name || "Edit lead",
        sub: [l.company, Number(l.value) ? `₹${Number(l.value).toLocaleString("en-IN")}` : "", `Lead #${l.id}`].filter(Boolean).join(" · "),
      })}
      fields={[
        { name: "_meeting", label: "Meeting", type: "calendly" },
        { name: "name", label: "Contact name", placeholder: "Full name" },
        { name: "company", label: "Company", type: "text" },
        { name: "purpose", label: "Purpose", type: "text", placeholder: "e.g. CRM Build, SaaS Revamp" },
        { name: "email", label: "Email", type: "text", placeholder: "name@company.com" },
        { name: "phone", label: "Phone", type: "text", placeholder: "+91 98200 11223" },
        { name: "source", label: "Source", type: "select", options: ["Website", "Referral", "LinkedIn", "Cold outreach", "Event", "Other"] },
        { name: "stage", label: "Stage (drives the progress score)", type: "select", options: ["new", "contacted", "qualified", "proposal", "won", "lost"] },
        { name: "lostReason", label: "Why was it lost?", type: "text", placeholder: "e.g. Budget, went with another agency", showIf: (v) => v.stage === "lost" },
        { name: "value", label: "Estimated value (₹)", type: "number", placeholder: "e.g. 25000" },
        { name: "owner", label: "Owner (BD)", type: "userselect", placeholder: "Assign a team member" },
        { name: "priority", label: "Priority", type: "select", options: ["low", "medium", "high"] },
        { name: "nextFollowUpAt", label: "Next follow-up date", type: "date" },
        { name: "followUpNote", label: "Follow-up note", type: "text", placeholder: "What to do next, e.g. Send the revised quote" },
        { name: "meetingUrl", label: "Meeting link", type: "link", placeholder: "https://meet.google.com/…" },
        { name: "meetingAt", label: "Meeting time", type: "datetime" },
        { name: "lastContactedAt", label: "Last contacted", type: "relative", placeholder: "Not contacted yet — log a call or message above" },
        { name: "notes", label: "Notes", type: "textarea", placeholder: "Context, next steps, objections…" },
        { name: "position", label: "Order", type: "number" },
      ]}
    />
  );
}

export default function AdminLeads() {
  return <Suspense fallback={null}><Leads /></Suspense>;
}
