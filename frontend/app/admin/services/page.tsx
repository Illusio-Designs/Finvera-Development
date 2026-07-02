import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminServices() {
  return (
    <ResourceManager
      resource="services"
      title="Services"
      subtitle="The service cards shown across the site."
      columns={[
        { name: "title", label: "Title" },
        { name: "icon", label: "Icon" },
        { name: "status", label: "Status", type: "status" },
      ]}
      defaults={{ status: "published", icon: "saas" }}
      fields={[
        { name: "title", label: "Title" },
        { name: "icon", label: "Icon", type: "select", options: ["saas", "crm", "cloud", "api", "design", "ai"] },
        { name: "description", label: "Description", type: "textarea" },
        { name: "position", label: "Order", type: "number" },
        { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
      ]}
    />
  );
}
