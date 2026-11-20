import { redirect } from "next/navigation";
import SocialReports from "./SocialReports";

export default async function ReportsPage({ searchParams }: {
  searchParams: Promise<{ view?: string; brand?: string; month?: string }>;
}) {
  const { view, brand, month } = await searchParams;
  if (view === "team") return <SocialReports initialView="team" />;
  const query = new URLSearchParams({ tab: "report" });
  if (typeof brand === "string") query.set("brand", brand);
  if (typeof month === "string") query.set("month", month);
  redirect(`/dashboard/social-studio?${query}`);
}
