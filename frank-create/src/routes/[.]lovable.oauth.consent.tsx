import { createFileRoute } from "@tanstack/react-router";
import { OAuthConsentPage } from "../components/OAuthConsentPage";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search.authorization_id === "string" ? search.authorization_id : "",
  }),
  head: () => ({
    meta: [
      { title: "Approve Claude connection | frank body" },
      { name: "description", content: "Approve secure access to the frank body design studio." },
      { property: "og:title", content: "Approve Claude connection | frank body" },
      { property: "og:description", content: "Approve secure access to the frank body design studio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OAuthConsentPage,
});