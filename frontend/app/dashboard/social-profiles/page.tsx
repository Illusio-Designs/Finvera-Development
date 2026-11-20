import { redirect } from "next/navigation";

export default async function SocialProfilesPage({ searchParams }: {
  searchParams: Promise<{ brand?: string; platform?: string }>;
}) {
  const { brand, platform } = await searchParams;
  const query = new URLSearchParams({ tab: "profiles" });
  if (typeof brand === "string") query.set("brand", brand);
  if (platform === "facebook" || platform === "instagram") query.set("platform", platform);
  redirect(`/dashboard/social-studio?${query}`);
}
