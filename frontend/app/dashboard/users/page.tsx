import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminUsers() {
  return (
    <ResourceManager
      resource="users"
      title="Users"
      subtitle="Admin accounts that can sign in and manage content."
      columns={[
        { name: "name", label: "Name" },
        { name: "email", label: "Email" },
        { name: "role", label: "Role" },
      ]}
      defaults={{ role: "admin", active: true }}
      fields={[
        { name: "name", label: "Full name" },
        { name: "email", label: "Email", type: "text", placeholder: "name@finvera.solutions" },
        { name: "role", label: "Role", type: "select", options: ["admin", "editor"] },
        { name: "password", label: "Password", type: "text", placeholder: "Set / change password" },
        { name: "active", label: "Active", type: "boolean", placeholder: "Account can sign in" },
      ]}
    />
  );
}
