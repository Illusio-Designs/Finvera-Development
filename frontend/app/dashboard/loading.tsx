"use client";

import { usePathname } from "next/navigation";
import PageLoading from "@/components/admin/PageLoading";

export default function DashboardLoading() {
  const page = usePathname()?.split("/")[2] || "";
  if (page === "social" || page === "leads") return <PageLoading label="Loading workspace…" variant="board" toolbar />;
  if (page === "account" || page === "settings" || page === "social-profiles") return <PageLoading label="Loading workspace…" variant="form" />;
  if (page === "blog" || page === "projects" || page === "team") return <PageLoading label="Loading workspace…" variant="media" toolbar />;
  return <PageLoading label="Loading workspace…" variant="list" />;
}
