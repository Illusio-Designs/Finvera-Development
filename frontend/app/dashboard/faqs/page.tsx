import ResourceManager from "@/components/admin/ResourceManager";
export default function AdminFaqs() {
  return <ResourceManager resource="faqs" backHref="/dashboard/content" backLabel="Site content" title="FAQ" subtitle="Questions shown on the home page."
    columns={[{ name: "question", label: "Question" }, { name: "status", label: "Status", type: "status" }]}
    defaults={{ status: "published" }}
    fields={[
      { name: "question", label: "Question" },
      { name: "answer", label: "Answer", type: "textarea" },
      { name: "position", label: "Order", type: "number" },
      { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
    ]} />;
}
