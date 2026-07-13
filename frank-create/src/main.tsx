import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthGate } from "./AuthGate";
import { StatusBanner } from "./components/StatusBanner";
import { ErrorToast } from "./components/ErrorToast";
import { HealthPage } from "./components/HealthPage";
import { ReviewBoardPage } from "./components/ReviewBoardPage";
import { CliffAccessPage } from "./components/CliffAccessPage";
import { installErrorReporter } from "./lib/errorReporter";
import "./styles.css";

installErrorReporter();

function resolveRoute() {
  const pathname = window.location.pathname.replace(/\/$/, "");
  const hashPath = window.location.hash.replace(/^#/, "").replace(/\/$/, "");
  const isHealth = hashPath === "/health" || pathname === "/health";
  const isCliff = hashPath === "/cliff-access" || pathname === "/cliff-access";
  const reviewMatch =
    hashPath.match(/^\/review\/([^/]+)$/) ?? pathname.match(/^\/review\/([^/]+)$/);
  return { isHealth, isCliff, reviewSessionId: reviewMatch ? decodeURIComponent(reviewMatch[1]) : null };
}

function Router() {
  const [route, setRoute] = useState(resolveRoute);
  useEffect(() => {
    const onChange = () => setRoute(resolveRoute());
    window.addEventListener("hashchange", onChange);
    window.addEventListener("popstate", onChange);
    return () => {
      window.removeEventListener("hashchange", onChange);
      window.removeEventListener("popstate", onChange);
    };
  }, []);

  if (route.isHealth) return <HealthPage />;
  if (route.isCliff) return <AuthGate><CliffAccessPage /></AuthGate>;
  if (route.reviewSessionId)
    return <AuthGate><ReviewBoardPage sessionId={route.reviewSessionId} /></AuthGate>;
  return <AuthGate><App /></AuthGate>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StatusBanner />
    <ErrorToast />
    <Router />
  </React.StrictMode>
);
