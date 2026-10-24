"use client";
import { useEffect, useState } from "react";
import ResourceManager from "@/components/admin/ResourceManager";
import { api } from "@/lib/adminApi";

export default function AdminUsers() {
  // Social media brands an admin can grant per user (stored as SocialClient ids).
  const [brands, setBrands] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    api.list("social-clients")
      .then((cs) => setBrands((Array.isArray(cs) ? cs : []).map((c: { id: number; name: string }) => ({ value: String(c.id), label: c.name }))))
      .catch(() => {});
  }, []);

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
        { name: "roles", label: "Roles", type: "roles" },
      ]}
      defaults={{ roles: ["admin"], active: true, socialClients: [] }}
      fields={[
        { name: "avatar", label: "Avatar", type: "avatar" },
        { name: "name", label: "Full name" },
        { name: "email", label: "Email", type: "text", placeholder: "name@finvera.solutions" },
        { name: "title", label: "Job title", type: "text", placeholder: "e.g. Head of Design" },
        { name: "roles", label: "Roles (assign one or more — controls what they can access)", type: "multiselect", options: [
          { value: "admin", label: "Admin — full access" },
          { value: "content", label: "Content — site content, blog, projects, team…" },
          { value: "projects", label: "Project board — kanban only" },
          { value: "leads", label: "Leads — pipeline + contact inbox" },
          { value: "seo", label: "SEO — SEO + settings & pixels" },
          { value: "social", label: "Social media — posts content (gets posts at Ready to post)" },
          { value: "marketer", label: "Marketer — plans & shoots reels (gets reels at Planned / Need from client)" },
          { value: "video", label: "Video editor — edits reels (gets reels at In production)" },
          { value: "graphic", label: "Graphic designer — makes posts & carousels (gets them to design)" },
        ] },
        { name: "socialClients", label: "Social media brands (tick every brand this person can see in the content planner — none ticked = no access; admins see all)", type: "multiselect",
          options: brands.length ? brands : [] },
        { name: "password", label: "Password", type: "password", placeholder: "Set / change password" },
        { name: "active", label: "Active", type: "boolean", placeholder: "Account can sign in" },
      ]}
    />
  );
}
