/**
 * On-brand preview placeholder shown when a project has no uploaded screenshot.
 * Reliable and intentional-looking (no flaky third-party screenshot service).
 * Upload a desktop/mobile image in the admin to show a real screenshot instead.
 */
export default function SiteShot({ url, kind }: { url: string; kind: "desktop" | "mobile"; alt?: string }) {
  const clean = url.replace(/\/$/, "");
  const host = (() => {
    try { return new URL(clean).host.replace(/^www\./, ""); }
    catch { return clean.replace(/^https?:\/\//, ""); }
  })();
  return (
    <div className={"shot-ph " + kind}>
      <div className="shot-ph-glow" />
      <span className="shot-ph-host">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></svg>
        {host}
      </span>
    </div>
  );
}
