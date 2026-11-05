import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPage from "@/components/LegalPage";
import { getPage } from "@/lib/api";
import { validPageSlug } from "@/lib/websitePages";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!validPageSlug(slug)) return {};
  const page = await getPage(slug);
  return { title: page?.title || "Page" };
}
export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!validPageSlug(slug)) notFound();
  return <LegalPage slug={slug} fallbackTitle="Page" />;
}
