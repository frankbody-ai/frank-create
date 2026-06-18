import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { AuthGate } from "./AuthGate";
import { StatusBanner } from "./components/StatusBanner";
import { ErrorToast } from "./components/ErrorToast";
import { HealthPage } from "./components/HealthPage";
import { installErrorReporter } from "./lib/errorReporter";
import "./styles.css";

installErrorReporter();

const isHealthRoute = window.location.pathname.replace(/\/$/, "") === "/health";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StatusBanner />
    <ErrorToast />
    {isHealthRoute ? (
      <HealthPage />
    ) : (
      <AuthGate>
        <App />
      </AuthGate>
    )}
  </React.StrictMode>
);
