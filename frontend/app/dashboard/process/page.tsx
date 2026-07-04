import ResourceManager from "@/components/admin/ResourceManager";
const ICONS = ["search", "paint", "code", "rocket", "cloud", "team", "target", "award"];
export default function AdminProcess() {
  return <ResourceManager resource="process-steps" backHref="/dashboard/content" backLabel="Site content" title="Process steps" subtitle="The 'How we work' steps shown on Home and Services."
    columns={[{ name: "step", label: "#" }, { name: "title", label: "Title" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published", icon: "search" }}
    fields={[
      { name: "step", label: "Number", placeholder: "e.g. 01" },
      { name: "title", label: "Title" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "icon", label: "Icon", type: "select", options: ICONS },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
