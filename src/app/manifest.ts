import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Galla — Salon & Parlour Management",
    short_name: "Galla",
    description: "Salon & parlour operations, counter billing, orders & inventory management",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FAF8F9",
    theme_color: "#1E1217",
    icons: [
      {
        src: "/favicon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
