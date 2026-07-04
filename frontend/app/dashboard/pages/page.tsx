import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminPages() {
  return (
    <ResourceManager
      resource="pages"
      title="Pages"
      subtitle="Content pages like Privacy Policy and Terms — edited here, shown on the site."
      columns={[
        { name: "title", label: "Title" },
        { name: "slug", label: "Slug" },
        { name: "status", label: "Status", type: "status" },
      ]}
      defaults={{ status: "published" }}
      fields={[
        { name: "title", label: "Title", placeholder: "e.g. Privacy Policy" },
        { name: "slug", label: "Slug (URL)", placeholder: "e.g. privacy — used at /privacy" },
        { name: "content", label: "Content", type: "richtext" },
        { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
      ]}
    />
  );
}
