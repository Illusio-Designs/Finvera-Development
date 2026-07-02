import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Chrome from "@/components/Chrome";
import Analytics from "@/components/Analytics";
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
      <Nav />
      <main>{children}</main>
      <Footer />
      <Analytics settings={settings} />
    </>
  );
}
