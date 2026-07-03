import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nexo - Agente Financeiro",
    short_name: "Nexo",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
