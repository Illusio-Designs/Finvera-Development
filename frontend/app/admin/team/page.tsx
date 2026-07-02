import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminTeam() {
  return (
    <ResourceManager
      resource="team"
      title="Team"
      subtitle="Team members shown on the About page."
      columns={[
        { name: "photo", label: "Photo", type: "image" },
        { name: "name", label: "Name" },
        { name: "role", label: "Role" },
        { name: "status", label: "Status", type: "status" },
      ]}
      defaults={{ status: "published" }}
      fields={[
        { name: "name", label: "Name" },
        { name: "role", label: "Role", placeholder: "Head of Design" },
        { name: "initials", label: "Initials (fallback avatar)", placeholder: "MC" },
        { name: "bio", label: "Bio", type: "textarea" },
        { name: "photo", label: "Photo", type: "image" },
        { name: "position", label: "Order", type: "number" },
        { name: "status", label: "Status", type: "select", options: ["published", "draft"] },
      ]}
    />
  );
}
