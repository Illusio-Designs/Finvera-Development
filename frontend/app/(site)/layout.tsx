import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Chrome from "@/components/Chrome";
import SmoothScroll from "@/components/SmoothScroll";
import PageTransition from "@/components/PageTransition";
import Analytics from "@/components/Analytics";
import ConsultPanel from "@/components/ConsultPanel";
import { getSettings } from "@/lib/api";

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
      <Footer />
      <ConsultPanel />
      <Analytics settings={settings} />
    </>
  );
}
