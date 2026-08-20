import { createFileRoute } from "@tanstack/react-router";
import { StudioRoot } from "../main";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Studio admin | frank body" },
      { name: "description", content: "Administration for the frank body design studio." },
      { property: "og:title", content: "Studio admin | frank body" },
      { property: "og:description", content: "Administration for the frank body design studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioRoot,
});