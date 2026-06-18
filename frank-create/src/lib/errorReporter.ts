// Lightweight client-side error reporter.
// Captures runtime errors, unhandled rejections, fetch failures (502/504),
// and WebSocket failures into an in-memory ring buffer, and dispatches
// custom DOM events so UI surfaces (banner + toast) can react.

export type ErrorEntry = {
  kind: "error" | "rejection" | "net" | "ws";
  message: string;
  url?: string;
  status?: number;
  timestamp: number;
  stack?: string;
};

const BUFFER_MAX = 50;
const buffer: ErrorEntry[] = [];
let installed = false;

export function getErrorBuffer(): ErrorEntry[] {
  return buffer.slice();
}

export function pushEntry(entry: ErrorEntry) {
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.splice(0, buffer.length - BUFFER_MAX);
  try {
    window.dispatchEvent(
      new CustomEvent(`frank:${entry.kind}-error`, { detail: entry })
    );
    window.dispatchEvent(new CustomEvent("frank:error", { detail: entry }));
  } catch {
    /* noop */
  }
}

export function installErrorReporter() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    pushEntry({
      kind: "error",
      message: e.message || "Unknown error",
      url: (e.filename as string) || undefined,
      stack: e.error?.stack,
      timestamp: Date.now(),
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: any = e.reason;
    pushEntry({
      kind: "rejection",
      message:
        (reason && (reason.message || String(reason))) || "Unhandled rejection",
      stack: reason?.stack,
      timestamp: Date.now(),
    });
  });

  // Patch fetch to flag 502/503/504.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      const res = await originalFetch(...args);
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : (args[0] as Request)?.url ?? "";
        pushEntry({
          kind: "net",
          message: `Bad gateway (${res.status})`,
          url,
          status: res.status,
          timestamp: Date.now(),
        });
      }
      return res;
    } catch (err: any) {
      const url =
        typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url ?? "";
      pushEntry({
        kind: "net",
        message: err?.message || "Network request failed",
        url,
        timestamp: Date.now(),
      });
      throw err;
    }
  };

  // Patch WebSocket to detect connection failures.
  const NativeWS = window.WebSocket;
  if (NativeWS) {
    const Patched = function (this: any, url: string | URL, protocols?: any) {
      const ws = new NativeWS(url as any, protocols);
      ws.addEventListener("error", () => {
        pushEntry({
          kind: "ws",
          message: "WebSocket connection error",
          url: String(url),
          timestamp: Date.now(),
        });
      });
      ws.addEventListener("close", (ev: CloseEvent) => {
        if (!ev.wasClean && ev.code !== 1000 && ev.code !== 1001) {
          pushEntry({
            kind: "ws",
            message: `WebSocket closed (code ${ev.code})`,
            url: String(url),
            status: ev.code,
            timestamp: Date.now(),
          });
        }
      });
      return ws;
    } as unknown as typeof WebSocket;
    Patched.prototype = NativeWS.prototype;
    (Patched as any).CONNECTING = NativeWS.CONNECTING;
    (Patched as any).OPEN = NativeWS.OPEN;
    (Patched as any).CLOSING = NativeWS.CLOSING;
    (Patched as any).CLOSED = NativeWS.CLOSED;
    window.WebSocket = Patched;
  }
}

export function formatBufferForCopy(): string {
  const lines = buffer.map((e) => {
    const time = new Date(e.timestamp).toISOString();
    const parts = [time, `[${e.kind}]`, e.message];
    if (e.status) parts.push(`status=${e.status}`);
    if (e.url) parts.push(e.url);
    return parts.join(" ");
  });
  return [
    `frank-create error report`,
    `generated: ${new Date().toISOString()}`,
    `userAgent: ${navigator.userAgent}`,
    `url: ${location.href}`,
    `online: ${navigator.onLine}`,
    "",
    ...lines,
  ].join("\n");
}
