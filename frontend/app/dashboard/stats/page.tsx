import ResourceManager from "@/components/admin/ResourceManager";
export default function AdminStats() {
  return <ResourceManager resource="stats" title="Stats" subtitle="The stats band on the home page."
    columns={[{ name: "value", label: "Value" }, { name: "label", label: "Label" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published" }}
    fields={[
      { name: "value", label: "Value", placeholder: "e.g. 250+ or 99% or 4min" },
      { name: "label", label: "Label", placeholder: "e.g. Projects delivered" },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
