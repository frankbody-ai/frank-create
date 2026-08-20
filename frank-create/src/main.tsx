import React, { Suspense, lazy, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthGate } from "./AuthGate";
import { StatusBanner } from "./components/StatusBanner";
import { ErrorToast } from "./components/ErrorToast";
import { SmallScreenNotice } from "./components/SmallScreenNotice";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { installErrorReporter } from "./lib/errorReporter";
import { applyTheme, storedTheme } from "./ds";
import { resolveScreen } from "./nav";
import "./app.css";

// Studio is where everyone lands, so it is the only screen in the first bundle.
// The rest arrive when someone actually navigates to them.
const HealthPage = lazy(() => import("./components/HealthPage").then((m) => ({ default: m.HealthPage })));
const AdminPortal = lazy(() => import("./components/AdminPortal").then((m) => ({ default: m.AdminPortal })));
const SettingsPage = lazy(() => import("./components/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const NotFoundPage = lazy(() => import("./components/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));
const OAuthConsentPage = lazy(() =>
  import("./components/OAuthConsentPage").then((m) => ({ default: m.OAuthConsentPage }))
);

// The remembered theme has to land before first paint, or the page flashes ink.
applyTheme(storedTheme());
installErrorReporter();

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

ReactDOM.createRoot(document.getElementById("root")!).render(
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

