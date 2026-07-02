import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminTestimonials() {
  return (
    <ResourceManager
      resource="testimonials"
      title="Testimonials"
      subtitle="Client quotes shown on the site."
      columns={[
        { name: "name", label: "Name" },
        { name: "company", label: "Company" },
        { name: "status", label: "Status", type: "status" },
      ]}
      defaults={{ status: "published", rating: 5 }}
      fields={[
        { name: "name", label: "Name" },
        { name: "role", label: "Role", placeholder: "CEO" },
        { name: "company", label: "Company" },
        { name: "avatar", label: "Avatar initials", placeholder: "AK" },
        { name: "quote", label: "Quote", type: "textarea" },
        { name: "rating", label: "Rating (1-5)", type: "number" },
        { name: "position", label: "Order", type: "number" },
        { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
      ]}
    />
  );
}
