import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { getPage } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("privacy");
  return {
    title: page?.title || "Privacy Policy",
    description: "How Finvera collects, uses and protects your information.",
  };
}

export default function Privacy() {
  return <LegalPage slug="privacy" fallbackTitle="Privacy Policy" />;
}
