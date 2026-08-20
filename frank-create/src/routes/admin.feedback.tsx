import { createFileRoute } from "@tanstack/react-router";
import { StudioRoot } from "../main";

export const Route = createFileRoute("/admin/feedback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Feedback admin | frank body" },
      { name: "description", content: "Review design studio feedback and issue reports." },
      { property: "og:title", content: "Feedback admin | frank body" },
      { property: "og:description", content: "Review design studio feedback and issue reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StudioRoot,
});