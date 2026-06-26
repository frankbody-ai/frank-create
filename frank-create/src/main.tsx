import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthGate } from "./AuthGate";
import { StatusBanner } from "./components/StatusBanner";
import { ErrorToast } from "./components/ErrorToast";
import { HealthPage } from "./components/HealthPage";
import { ReviewBoardPage } from "./components/ReviewBoardPage";
import { installErrorReporter } from "./lib/errorReporter";
import "./styles.css";

installErrorReporter();

const pathname = window.location.pathname.replace(/\/$/, "");
const isHealthRoute = pathname === "/health";
const reviewMatch = pathname.match(/^\/review\/([^/]+)$/);

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
