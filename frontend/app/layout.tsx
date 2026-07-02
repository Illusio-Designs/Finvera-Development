import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Poppins, Anton, Fira_Code } from "next/font/google";
import LogoDefs from "@/components/LogoDefs";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const fira = Fira_Code({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-fira", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Finvera — Future-Driven SaaS & CRM Development",
    template: "%s — Finvera",
  },
  description:
    "Finvera builds high-quality SaaS platforms and CRM systems that help businesses grow, scale, and innovate in a fast-changing world.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#05060b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${anton.variable} ${fira.variable}`}>
      <body>
        <LogoDefs />
        {children}
      </body>
    </html>
  );
}
