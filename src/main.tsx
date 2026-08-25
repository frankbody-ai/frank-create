import React, { Suspense, lazy, useEffect, useState } from "react";

import App from "./App";
import { AuthGate } from "./AuthGate";
import { StatusBanner } from "./components/StatusBanner";
import { ErrorToast } from "./components/ErrorToast";
import { SmallScreenNotice } from "./components/SmallScreenNotice";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
// Eager: routes/__root.tsx already imports this for its notFoundComponent,
// so a lazy chunk here would only add a Suspense boundary for nothing.
import { NotFoundPage } from "./components/NotFoundPage";
import { installErrorReporter } from "./lib/errorReporter";
import { initTenantBrand } from "./lib/tenantBrand";
import { applyTheme, storedTheme } from "./ds";
import { resolveScreen } from "./nav";
import "./app.css";

// Studio is where everyone lands, so it is the only screen in the first bundle.
// The rest arrive when someone actually navigates to them.
const HealthPage = lazy(() => import("./components/HealthPage").then((m) => ({ default: m.HealthPage })));
const AdminPortal = lazy(() => import("./components/AdminPortal").then((m) => ({ default: m.AdminPortal })));
const SettingsPage = lazy(() => import("./components/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const OAuthConsentPage = lazy(() =>
  import("./components/OAuthConsentPage").then((m) => ({ default: m.OAuthConsentPage }))
);

// The remembered theme has to land before first paint or the page flashes ink,
// so this stays at module scope rather than in an effect. Guarded because
// TanStack Start pulls this module into the server graph, where there is no
// localStorage to read the theme from.
if (typeof window !== "undefined") {
  applyTheme(storedTheme());
  // Same reasoning as the theme: the company mark has to be right before
  // first paint, or people see another brand's logo flash past.
  initTenantBrand();
  installErrorReporter();
}

function Router() {
  const [route, setRoute] = useState(resolveScreen);
  useEffect(() => {
    const onChange = () => setRoute(resolveScreen());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  switch (route.screen) {
    case "oauth":
      return <OAuthConsentPage />;
    case "health":
      return <HealthPage />;
    case "notfound":
      return <NotFoundPage />;
    case "admin":
      return (
        <AuthGate>
          <AdminPortal />
        </AuthGate>
      );
    case "settings":
      return (
        <AuthGate>
          <SettingsPage />
        </AuthGate>
      );
    default:
      return (
        <AuthGate>
          <App />
        </AuthGate>
      );
  }
}

/** Mounted by `routes/index.tsx` — TanStack Start owns the actual root render. */
export function StudioRoot() {
  return (
    <React.StrictMode>
      <SmallScreenNotice />
      <StatusBanner />
      <ErrorToast />
      <AppErrorBoundary>
        <Suspense fallback={<div className="screen-loading" />}>
          <Router />
        </Suspense>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
