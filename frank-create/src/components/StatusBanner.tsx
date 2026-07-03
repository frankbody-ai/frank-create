import { useEffect, useRef, useState } from "react";
import { fetchHealth } from "../lib/api";

type Status = "healthy" | "reconnecting" | "offline";

const PING_INTERVAL_MS = 20_000;

export function StatusBanner() {
  const [status, setStatus] = useState<Status>("healthy");
  const [dismissed, setDismissed] = useState(false);
  const failuresRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function ping() {
      try {
        await fetchHealth();
        if (cancelled) return;
        failuresRef.current = 0;
        setStatus(navigator.onLine ? "healthy" : "offline");
      } catch {
        if (cancelled) return;
        failuresRef.current += 1;
        setStatus(navigator.onLine ? "reconnecting" : "offline");
      }
    }

    ping();
    const id = window.setInterval(ping, PING_INTERVAL_MS);

    const onOnline = () => {
      setStatus("reconnecting");
      ping();
    };
    const onOffline = () => setStatus("offline");
    const onWs = () => {
      setStatus((s) => (s === "healthy" ? "reconnecting" : s));
      // try to recover sooner
      window.setTimeout(ping, 1500);
    };
    const onNet = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.status === 502 || detail?.status === 504) {
        setStatus((s) => (s === "healthy" ? "reconnecting" : s));
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("frank:ws-error", onWs as EventListener);
    window.addEventListener("frank:net-error", onNet as EventListener);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("frank:ws-error", onWs as EventListener);
      window.removeEventListener("frank:net-error", onNet as EventListener);
    };
  }, []);

  if (status === "healthy" || dismissed) return null;

  const label =
    status === "offline"
      ? "Connection lost — you appear to be offline."
      : "Reconnecting to preview…";

  return (
    <div className={`frank-status-banner frank-status-${status}`} role="status">
      <span>{label}</span>
      <div className="frank-status-actions">
        <a href="#/health" className="frank-status-link">
          Diagnostics
        </a>
        <button
          type="button"
          className="frank-status-dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
