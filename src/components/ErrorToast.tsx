import { useEffect, useState } from "react";
import { Button, Icon, Text } from "../ds";
import { formatBufferForCopy, type ErrorEntry } from "../lib/errorReporter";

type Toast = { id: number; entry: ErrorEntry };

const DEBOUNCE_MS = 10_000;
const AUTO_DISMISS_MS = 8_000;

export function ErrorToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let lastKey = "";
    let lastAt = 0;

    function onErr(e: Event) {
      const entry = (e as CustomEvent<ErrorEntry>).detail;
      if (!entry) return;
      // Only surface network / ws problems as toasts — runtime errors are loud enough.
      if (entry.kind !== "ws" && entry.kind !== "net") return;
      if (entry.status && ![502, 503, 504].includes(entry.status) && entry.kind === "net") {
        return;
      }
      const key = `${entry.kind}:${entry.message}`;
      const now = Date.now();
      if (key === lastKey && now - lastAt < DEBOUNCE_MS) return;
      lastKey = key;
      lastAt = now;
      const id = now + Math.random();
      setToasts((t) => [...t, { id, entry }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, AUTO_DISMISS_MS);
    }

    window.addEventListener("frank:error", onErr as EventListener);
    return () =>
      window.removeEventListener("frank:error", onErr as EventListener);
  }, []);

  async function copyDetails(entry: ErrorEntry) {
    const header = `Recent issue: [${entry.kind}] ${entry.message}${
      entry.status ? ` (status ${entry.status})` : ""
    }${entry.url ? `\nURL: ${entry.url}` : ""}\n\n`;
    const text = header + formatBufferForCopy();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className="toast toast--error" role="alert">
          <div className="toast__head">
            <Icon source="exclamation-circle" size={16} tone="critical" />
            <Text fontWeight="medium">The preview lost its connection</Text>
            <button
              type="button"
              className="toast__dismiss"
              onClick={() => setToasts((cur) => cur.filter((x) => x.id !== t.id))}
              aria-label="Dismiss"
            >
              <Icon source="x-mark" size={16} tone="inherit" />
            </button>
          </div>
          <p className="toast__text">{t.entry.message}</p>
          <div className="toast__foot toast__foot--end">
            <Button size="micro" icon="document-duplicate" onClick={() => copyDetails(t.entry)}>
              Copy details
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
