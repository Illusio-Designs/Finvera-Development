import ResourceManager from "@/components/admin/ResourceManager";
export default function AdminLogos() {
  return <ResourceManager resource="logos" title="Trusted-by logos" subtitle="The company names in the 'Trusted by' marquee on the home page."
    columns={[{ name: "name", label: "Name" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published" }}
    fields={[
      { name: "name", label: "Company name" },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
