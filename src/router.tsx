import { createRouter } from "@tanstack/react-router";
import { startOsFeedback } from "autosolutions-os/feedback-everywhere";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // The Feedback button on pages with no top bar: a 404, an error page, a "no access" screen.
  startOsFeedback({
    appKey: "frank_create",
    token: async () => {
      const { supabase } = await import("./lib/supabaseClient");
      return (await supabase.auth.getSession()).data.session?.access_token;
    },
  });

  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}