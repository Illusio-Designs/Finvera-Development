import ResourceManager from "@/components/admin/ResourceManager";
export default function AdminFeatures() {
  return <ResourceManager resource="features" title="Solution features" subtitle="The feature list in the 'run your revenue' section on the home page."
    columns={[{ name: "title", label: "Title" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published" }}
    fields={[
      { name: "title", label: "Title" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
