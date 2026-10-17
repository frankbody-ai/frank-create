import type { ReactNode } from "react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { NotFoundPage } from "../components/NotFoundPage";
import "../app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [
      // Browser tab icon: the AutoSolutions colour square icon (Cliff Edit design,
      // assets/brand/app-icon-pink.png), resized into public/.
      { rel: "icon", href: "/favicon.ico?v=5", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { rel: "icon", href: "/favicon-32x32.png?v=5", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/favicon-192x192.png?v=5", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=5", sizes: "180x180" },
    ],
  }),
  component: RootDocument,
  // Unknown *paths* land here; unknown *hashes* are caught by `resolveScreen`
  // in nav.ts, since the hash router only ever runs at "/". Same component
  // either way — a dead link should say so, not quietly show the Studio.
  notFoundComponent: NotFoundPage,
});

function RootDocument() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

function Document({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}