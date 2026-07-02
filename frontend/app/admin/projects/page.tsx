import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminProjects() {
  return (
    <ResourceManager
      resource="projects"
      title="Projects"
      subtitle="Portfolio items shown on the Work page."
      columns={[
        { name: "desktopImage", label: "Preview", type: "image" },
        { name: "title", label: "Title" },
        { name: "category", label: "Category" },
        { name: "status", label: "Status", type: "status" },
      ]}
      defaults={{ status: "published", featured: false, tags: [] }}
      fields={[
        { name: "title", label: "Title", placeholder: "Project name" },
        { name: "category", label: "Category", placeholder: "e.g. AI · SaaS" },
        { name: "url", label: "Live URL", placeholder: "https://…" },
        { name: "tags", label: "Tags", type: "tags", placeholder: "Web Design, Development" },
        { name: "blurb", label: "Short description", type: "textarea" },
        { name: "content", label: "Case study", type: "richtext" },
        { name: "desktopImage", label: "Desktop screenshot", type: "image" },
        { name: "mobileImage", label: "Mobile screenshot", type: "image" },
        { name: "coverImage", label: "Cover image", type: "image" },
        { name: "featured", label: "Featured", type: "boolean", placeholder: "Show on the home page" },
        { name: "position", label: "Order", type: "number" },
        { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
        { name: "seoTitle", label: "SEO title", type: "text" },
        { name: "seoDescription", label: "SEO description", type: "textarea" },
      ]}
    />
  );
}
