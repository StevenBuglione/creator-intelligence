import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Creator Intelligence",
    short_name: "Creator Intel",
    description: "Private local research and production planning",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f4ee",
    theme_color: "#183d31",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
