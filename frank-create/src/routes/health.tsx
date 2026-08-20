import { createFileRoute } from "@tanstack/react-router";
import { StudioRoot } from "../main";

export const Route = createFileRoute("/health")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Studio health | frank body" },
      { name: "description", content: "Current service status for the frank body design studio." },
      { property: "og:title", content: "Studio health | frank body" },
      { property: "og:description", content: "Current service status for the frank body design studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioRoot,
});