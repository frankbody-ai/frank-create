# Plan: Health & Error Visibility

Add three small frontend-only features to `frank-create/` to improve troubleshooting visibility. No backend changes.

## 1. Connection status banner

New component `src/components/StatusBanner.tsx` mounted in `main.tsx` above `<App />`.

- Tracks browser `online`/`offline` events.
- Pings backend `GET /health` (via existing `fetchHealth()` in `src/lib/api.ts`) every 20s.
- Listens for `window` `error` and `unhandledrejection` events plus a custom `frank:ws-error` event (dispatched from feature 3).
- States: `healthy` (hidden), `reconnecting` (yellow, "Reconnecting to preview…"), `offline` (red, "Connection lost").
- Slim bar pinned to top, dismissible per-session.

## 2. `/health` diagnostic page

Since the app is a single-page Vite SPA (no router), gate on `window.location.pathname === "/health"` inside `main.tsx` and render `<HealthPage />` instead of `<App />` (no auth gate so it's reachable when broken).

New `src/components/HealthPage.tsx` runs checks on mount and shows pass/fail rows:

- Backend `/health` endpoint (uses `fetchHealth`)
- Backend `/models` endpoint (uses `fetchModels`)
- Supabase auth session (`supabase.auth.getSession()`)
- Browser online status
- LocalStorage read/write

Each row: name, status icon, latency ms, error text if any. Includes a "Re-run checks" button and a "Copy report" button that copies a JSON summary to clipboard.

## 3. Error logging + toast with copy details

New `src/lib/errorReporter.ts`:

- Installs global `window.onerror`, `unhandledrejection`, and `console.error` wrapper handlers.
- Detects WebSocket failures and 502/504 responses by patching `WebSocket` constructor and `fetch` to dispatch a `frank:ws-error` / `frank:net-error` custom event with `{ message, url, status, timestamp }`.
- Keeps a rolling in-memory buffer (last 50 entries) exposed as `getErrorBuffer()`.

Toast surface uses existing `sonner` (already a dep — verify; if not, fall back to a minimal inline toast component). On a 502 or WS failure, show:

> "Preview connection issue — retrying"
> [Copy details] button → copies the last buffered error entry + buffer tail as text.

Debounced so repeated identical errors only toast once every 10s.

Initialized once from `main.tsx` before render.

## Files

- New: `src/components/StatusBanner.tsx`
- New: `src/components/HealthPage.tsx`
- New: `src/lib/errorReporter.ts`
- Edited: `src/main.tsx` (mount banner, init reporter, route `/health`)
- Edited: `src/styles.css` (banner + health page styles)

## Out of scope

- No server route changes; `/health` is a client page that calls existing backend endpoints.
- No persistent error log (in-memory only).
