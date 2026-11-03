import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Chrome from "@/components/Chrome";
import SmoothScroll from "@/components/SmoothScroll";
import PageTransition from "@/components/PageTransition";
import Analytics from "@/components/Analytics";
import ConsultPanel from "@/components/ConsultPanel";
import type { Metadata } from "next";
import { getSettings } from "@/lib/api";

/* Google Search Console verification code from Settings & pixels. */
export async function generateMetadata(): Promise<Metadata> {
  const code = (await getSettings()).google_site_verification?.trim();
  return code && /^[\w-]{10,100}$/.test(code) ? { verification: { google: code } } : {};
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const gtm = settings.google_tag_manager_id?.trim();
  return (
    <>
      {gtm && (
        <noscript>
          <iframe src={`https://www.googletagmanager.com/ns.html?id=${gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} />
        </noscript>
      )}
      <Chrome />
      <SmoothScroll />
      <PageTransition />
      <Nav />
      <main>{children}</main>
      <Footer settings={settings} />
      <ConsultPanel />
      <Analytics settings={settings} />
    </>
  );
}
