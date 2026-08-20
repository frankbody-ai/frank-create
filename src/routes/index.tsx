import { createFileRoute } from "@tanstack/react-router";
import { StudioRoot } from "../main";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "frank body design studio" },
      {
        name: "description",
        content: "Create, edit and upscale campaign imagery in the frank body design studio.",
      },
      { property: "og:title", content: "frank body design studio" },
      {
        property: "og:description",
        content: "Create, edit and upscale campaign imagery in the frank body design studio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioRoot,
});