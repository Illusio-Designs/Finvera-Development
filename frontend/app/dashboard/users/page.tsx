import ResourceManager from "@/components/admin/ResourceManager";

export default function AdminUsers() {
  return (
    <ResourceManager
      resource="users"
      title="Users"
      subtitle="Admin accounts that can sign in and manage content."
      columns={[
        { name: "avatar", label: "", type: "avatar" },
        { name: "name", label: "Name" },
        { name: "email", label: "Email" },
        { name: "title", label: "Title" },
        { name: "role", label: "Role", type: "role" },
      ]}
      defaults={{ role: "admin", active: true }}
      fields={[
        { name: "avatar", label: "Avatar", type: "avatar" },
        { name: "name", label: "Full name" },
        { name: "email", label: "Email", type: "text", placeholder: "name@finvera.solutions" },
        { name: "title", label: "Job title", type: "text", placeholder: "e.g. Head of Design" },
        { name: "role", label: "Role (controls what they can access)", type: "select", options: [
          { value: "admin", label: "Admin — full access" },
          { value: "content", label: "Content — site content, blog, projects, team…" },
          { value: "projects", label: "Project board — kanban only" },
          { value: "leads", label: "Leads — pipeline + contact inbox" },
          { value: "seo", label: "SEO — SEO + settings & pixels" },
        ] },
        { name: "password", label: "Password", type: "password", placeholder: "Set / change password" },
        { name: "active", label: "Active", type: "boolean", placeholder: "Account can sign in" },
      ]}
    />
  );
}
