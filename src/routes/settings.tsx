import { createFileRoute } from "@tanstack/react-router";
import { StudioRoot } from "../main";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Studio settings | frank body" },
      { name: "description", content: "Manage your frank body design studio preferences." },
      { property: "og:title", content: "Studio settings | frank body" },
      { property: "og:description", content: "Manage your frank body design studio preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioRoot,
});