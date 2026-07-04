import ResourceManager from "@/components/admin/ResourceManager";
const ICONS = ["paint", "calculator", "store", "megaphone", "code", "cloud", "team", "ai", "rocket", "target"];
export default function AdminBrands() {
  return <ResourceManager resource="brands" title="Brands" subtitle="The brand-ecosystem cards on the About page."
    columns={[{ name: "name", label: "Name" }, { name: "category", label: "Category" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published", icon: "code" }}
    fields={[
      { name: "name", label: "Name" },
      { name: "category", label: "Category", placeholder: "e.g. Accounting SaaS" },
      { name: "url", label: "Website URL", type: "text", placeholder: "https://brand.com — card links here" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "icon", label: "Icon", type: "select", options: ICONS },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
