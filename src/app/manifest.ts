import type { MetadataRoute } from "next";

/** PWA manifest – umožní přidat ELITEZ na plochu telefonu jako aplikaci. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ELITEZ",
    short_name: "ELITEZ",
    description: "Klub automobilové komunity / The car community club",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/pwa-icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/pwa-icons/maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
