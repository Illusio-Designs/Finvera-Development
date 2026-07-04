import ResourceManager from "@/components/admin/ResourceManager";
export default function AdminLogos() {
  return <ResourceManager resource="logos" title="Trusted-by logos" subtitle="Real client / partner logos in the 'Trusted by' marquee on the home page. Upload a logo image (SVG or transparent PNG works best)."
    columns={[{ name: "image", label: "Logo", type: "image" }, { name: "name", label: "Name" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published" }}
    fields={[
      { name: "name", label: "Company name" },
      { name: "image", label: "Logo image", type: "image" },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
