import type { MetadataRoute } from "next";

/* Lets the team add the dashboard to their phone's Home Screen (or install
   it on desktop). Opens straight into the dashboard, full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Finvera Dashboard",
    short_name: "Finvera",
    description: "Finvera team dashboard: content calendar, project boards, leads and more.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7fc",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
