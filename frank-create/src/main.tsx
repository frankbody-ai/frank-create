import React from "react";
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

// Route matching: prefer hash routes (work on any static host without SPA fallback),
// but keep pathname matching for backward compatibility where the host does fall back.
const pathname = window.location.pathname.replace(/\/$/, "");
const hashPath = window.location.hash.replace(/^#/, "").replace(/\/$/, "");
const isHealthRoute = hashPath === "/health" || pathname === "/health";
const isCliffRoute = hashPath === "/cliff-access" || pathname === "/cliff-access";
const reviewMatch =
  hashPath.match(/^\/review\/([^/]+)$/) ?? pathname.match(/^\/review\/([^/]+)$/);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StatusBanner />
    <ErrorToast />
    {isHealthRoute ? (
      <HealthPage />
    ) : reviewMatch ? (
      <AuthGate>
        <ReviewBoardPage sessionId={decodeURIComponent(reviewMatch[1])} />
      </AuthGate>
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </React.StrictMode>
);
