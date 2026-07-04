import ResourceManager from "@/components/admin/ResourceManager";
const ICONS = ["rocket", "target", "award", "agreement", "paint", "calculator", "store", "megaphone", "code", "search", "cloud", "team", "ai"];
export default function AdminValues() {
  return <ResourceManager resource="values" backHref="/dashboard/content" backLabel="Site content" title="Values" subtitle="The 'Values we build by' cards on the About page."
    columns={[{ name: "title", label: "Title" }, { name: "icon", label: "Icon" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published", icon: "rocket" }}
    fields={[
      { name: "title", label: "Title" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "icon", label: "Icon", type: "select", options: ICONS },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
