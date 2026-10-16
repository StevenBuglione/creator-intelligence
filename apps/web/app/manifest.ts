import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Creator Intelligence",
    short_name: "Creator Intel",
    description: "Private local research and production planning",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#1c1b18",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
