import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminBlog() {
  return (
    <ResourceManager
      resource="blog"
      title="Blog posts"
      subtitle="Articles shown on the Blog page."
      columns={[
        { name: "coverImage", label: "Cover", type: "image" },
        { name: "title", label: "Title" },
        { name: "category", label: "Category" },
        { name: "status", label: "Status", type: "status" },
      ]}
      defaults={{ status: "draft", author: "Finvera", tags: [] }}
      fields={[
        { name: "title", label: "Title" },
        { name: "category", label: "Category", placeholder: "CRM" },
        { name: "excerpt", label: "Excerpt", type: "textarea" },
        { name: "content", label: "Content (HTML)", type: "textarea" },
        { name: "coverImage", label: "Cover image", type: "image" },
        { name: "author", label: "Author" },
        { name: "tags", label: "Tags", type: "tags" },
        { name: "publishedAt", label: "Publish date", type: "date" },
        { name: "status", label: "Status", type: "select", options: ["draft", "published"] },
        { name: "seoTitle", label: "SEO title", type: "text" },
        { name: "seoDescription", label: "SEO description", type: "textarea" },
        { name: "seoKeywords", label: "SEO keywords", type: "text" },
      ]}
    />
  );
}
