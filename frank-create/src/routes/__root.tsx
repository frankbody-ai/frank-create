import type { ReactNode } from "react";
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import "../app.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
    ],
    links: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  }),
  component: RootDocument,
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