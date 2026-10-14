import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Financeiro Clados e Casa",
    short_name: "Financeiro",
    description: "Financeiro da Clados e da Casa",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f2",
    theme_color: "#f4f5f2",
    lang: "pt-BR",
    icons: [
      { src: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
