import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminProjects() {
  return (
    <ResourceManager
      resource="projects"
      title="Projects"
      subtitle="Portfolio items shown on the Work page."
      columns={[
        { name: "desktopImage", label: "Main image", type: "image" },
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
        { name: "client", label: "Client / company", type: "text", placeholder: "Defaults to the title" },
        { name: "industry", label: "Industry", type: "text", placeholder: "e.g. Fintech" },
        { name: "year", label: "Year", type: "text", placeholder: "e.g. 2025" },
        { name: "duration", label: "Timeline", type: "text", placeholder: "e.g. 6 weeks" },
        { name: "role", label: "Our role", type: "text", placeholder: "e.g. Design & Development" },
        { name: "challenge", label: "The challenge", type: "textarea", placeholder: "What problem were we solving?" },
        { name: "approach", label: "Our approach", type: "textarea", placeholder: "How we solved it" },
        { name: "results", label: "Results (VALUE — LABEL each)", type: "tags", placeholder: "+34% — Conversion,  6 wks — Delivery" },
        { name: "tech", label: "Tech stack", type: "tags", placeholder: "Next.js, Node, MySQL" },
        { name: "testimonialQuote", label: "Client quote", type: "textarea", placeholder: "A short testimonial from the client" },
        { name: "testimonialName", label: "Quote — name", type: "text" },
        { name: "testimonialRole", label: "Quote — role", type: "text" },
        { name: "content", label: "Case study (long)", type: "richtext" },
        { name: "desktopImage", label: "Main image (shown on Work + Home cards)", type: "image" },
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
