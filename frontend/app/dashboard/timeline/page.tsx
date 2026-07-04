import ResourceManager from "@/components/admin/ResourceManager";
export default function AdminTimeline() {
  return <ResourceManager resource="milestones" title="Timeline" subtitle="The journey milestones on the About page."
    columns={[{ name: "year", label: "Year" }, { name: "title", label: "Title" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published" }}
    fields={[
      { name: "year", label: "Year", placeholder: "e.g. 2024 or Today" },
      { name: "title", label: "Title" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
