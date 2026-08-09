import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthGate } from "./AuthGate";
import { StatusBanner } from "./components/StatusBanner";
import { ErrorToast } from "./components/ErrorToast";
import { HealthPage } from "./components/HealthPage";
import { ReviewBoardPage } from "./components/ReviewBoardPage";
import { CliffAccessPage } from "./components/CliffAccessPage";
import { AdminFeedbackPage } from "./components/AdminFeedbackPage";
import { AdminPortal } from "./components/AdminPortal";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { SmallScreenNotice } from "./components/SmallScreenNotice";
import { OAuthConsentPage } from "./components/OAuthConsentPage";
import { installErrorReporter } from "./lib/errorReporter";
import "./styles.css";

document.documentElement.setAttribute("data-tenant", "frank");
installErrorReporter();

function resolveRoute() {
  const pathname = window.location.pathname.replace(/\/$/, "");
  const rawHash = window.location.hash.replace(/^#/, "");
  const hashPath = (rawHash.split("?")[0] || "").replace(/\/$/, "");
  const isHealth = hashPath === "/health" || pathname === "/health";
  const isCliff = hashPath === "/cliff-access" || pathname === "/cliff-access";
  const isAdminFeedback = hashPath === "/admin/feedback" || pathname === "/admin/feedback";
  const isAdmin = hashPath === "/admin" || pathname === "/admin";
  const isOAuthConsent =
    hashPath === "/.lovable/oauth/consent" || pathname === "/.lovable/oauth/consent";
  const reviewMatch =
    hashPath.match(/^\/review\/([^/]+)$/) ?? pathname.match(/^\/review\/([^/]+)$/);
  return {
    isHealth,
    isCliff,
    isAdmin,
    isAdminFeedback,
    isOAuthConsent,
    reviewSessionId: reviewMatch ? decodeURIComponent(reviewMatch[1]) : null,
  };
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

  if (route.isOAuthConsent) return <OAuthConsentPage />;
  if (route.isHealth)
    return (
      <>
        <HealthPage />
        <FeedbackWidget />
      </>
    );
  if (route.isCliff) return <AuthGate><CliffAccessPage /><FeedbackWidget /></AuthGate>;
  if (route.isAdmin)
    return <AuthGate><AdminPortal /><FeedbackWidget /></AuthGate>;
  if (route.isAdminFeedback)
    return <AuthGate><AdminFeedbackPage /><FeedbackWidget /></AuthGate>;
  if (route.reviewSessionId)
    return (
      <AuthGate>
        <ReviewBoardPage sessionId={route.reviewSessionId} />
        <FeedbackWidget />
      </AuthGate>
    );
  return <AuthGate><App /></AuthGate>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SmallScreenNotice />
    <StatusBanner />
    <ErrorToast />
    <Router />
  </React.StrictMode>
);
