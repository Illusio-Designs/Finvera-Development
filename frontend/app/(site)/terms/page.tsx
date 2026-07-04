import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { getPage } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("terms");
  return {
    title: page?.title || "Terms & Conditions",
    description: "The terms that govern use of the Finvera website and services.",
  };
}

export default function Terms() {
  return <LegalPage slug="terms" fallbackTitle="Terms & Conditions" />;
}
