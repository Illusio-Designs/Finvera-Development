import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import LogoDefs from "@/components/LogoDefs";

// Premium 2-font system: Inter for text, Sora for display/headings.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-sora", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Finvera — Future-Driven SaaS & CRM Development",
    template: "%s — Finvera",
  },
  description:
    "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale, and innovate in a fast-changing world.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#05060b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <LogoDefs />
        {children}
      </body>
    </html>
  );
}
