import { useEffect, useRef, useState } from "react";
import { Icon } from "../ds";
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
        // A successful request outranks navigator.onLine, which reports false
        // negatives behind VPNs and after network interface changes.
        setStatus("healthy");
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
    // The flag alone never forces offline: confirm with a real request first.
    const onOffline = () => {
      setStatus((s) => (s === "healthy" ? "reconnecting" : s));
      ping();
    };

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
      ? "You're offline. The studio can't reach the backend until the connection is back."
      : "Reconnecting to the studio backend.";

  return (
    <div className={`status-bar status-bar--${status}`} role="status">
      <Icon
        source={status === "offline" ? "exclamation-circle" : "arrow-path"}
        size={16}
        tone="inherit"
      />
      <span className="status-bar__label">{label}</span>
      <a href="#/health" className="status-bar__link">
        Run diagnostics
      </a>
      <button
        type="button"
        className="status-bar__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        <Icon source="x-mark" size={16} tone="inherit" />
      </button>
    </div>
  );
}
