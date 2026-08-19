import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthGate } from "./AuthGate";
import { StatusBanner } from "./components/StatusBanner";
import { ErrorToast } from "./components/ErrorToast";
import { HealthPage } from "./components/HealthPage";
import { ReviewBoardPage } from "./components/ReviewBoardPage";
import { CliffAccessPage } from "./components/CliffAccessPage";
import { AdminPortal } from "./components/AdminPortal";
import { SettingsPage } from "./components/SettingsPage";
import { SmallScreenNotice } from "./components/SmallScreenNotice";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

import { OAuthConsentPage } from "./components/OAuthConsentPage";
import { installErrorReporter } from "./lib/errorReporter";
import { applyTheme, storedTheme } from "./ds";
import { resolveScreen } from "./nav";
import "./app.css";

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
      return (
<HealthPage />
      );
    case "cliff":
      return (
        <AuthGate>
          <CliffAccessPage />
        </AuthGate>
      );
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
    case "review":
      return (
        <AuthGate>
          <ReviewBoardPage sessionId={route.sessionId} />
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
      <Router />
    </AppErrorBoundary>
  </React.StrictMode>
);

