## Scope

Three related enhancements to the Review Board (`frank-create/src/components/ReviewBoardPage.tsx`) and the handoff endpoint (`supabase/functions/frank-api/index.ts` + `handoff.ts`).

### 1. Stepped progress indicator for handoff packaging

Show the user which stage of packaging is running: `Building manifest → Generating JSON → Generating CSV → Validating schema → Ready`.

- **Backend (`frank-api`):** Change `POST /sessions/:id/handoff` into a Server-Sent Events (SSE) stream when the client sends `Accept: text/event-stream`. Emit one JSON event per stage: `{ step: "build_manifest" | "generate_json" | "generate_csv" | "validate" | "done", progress: 0..1, message }`. Final event carries the full `metadata` payload (same shape as today). Non-SSE callers keep the existing JSON response for backwards compatibility.
- **API client (`frank-create/src/lib/api.ts`):** Add `createSessionHandoffStream(sessionId, { signal, onStep })` that uses `fetch` + `ReadableStream` to parse SSE lines and forwards each step to `onStep`. Keeps the existing `AbortSignal` wiring so cancel already works end-to-end.
- **UI (`ReviewBoardPage.tsx`):** Replace the current single "Packaging handoff…" toast with a stepped progress toast:
  - Ordered list of the 4 steps with a check / spinner / pending dot per row.
  - A thin progress bar reflecting `progress`.
  - Existing elapsed-time counter and **Cancel** button stay in the same toast (Cancel already calls `ctrl.abort()`).
  - On failure, keep the existing Retry action.

### 2. Cancel for handoff packaging and file downloads

Cancel during packaging already works via `AbortController`. Extend it so the user can also cancel the **client-side file save** once packaging finishes:

- When the "Download JSON" / "Download CSV" buttons are clicked, wrap the blob creation + `a.click()` in a short-lived task that shows a "Downloading `handoff-<id>.json`…" progress toast with a Cancel button. For blobs assembled in-memory the "cancel" simply aborts before `a.click()` runs and revokes the object URL; this covers the case where a user clicks download and immediately changes their mind while a large CSV is being serialized (we'll `JSON.stringify` / assemble in a `queueMicrotask` chain that checks an `aborted` flag between steps).
- The packaging-phase Cancel button already exists — keep it, and make sure aborting mid-stream also closes the SSE reader cleanly (call `reader.cancel()` on abort in the new stream helper).

### 3. Audit trail filters and sorting

The audit trail today is a per-asset `<details>` list. Add a dedicated **Audit trail** section at the bottom of the review board with:

- **Filters:**
  - Status transition: All / Approved / Rejected / Reverted-to-pending (multi-select chips).
  - Actor (user_id): dropdown populated from distinct `user_id`s present in `events`; shows short user id (and email if available from `auth.users` via the existing `/sessions/:id/approval-history` endpoint — extend the endpoint to join `auth.users` for `email` when the caller is the session owner).
  - Asset: dropdown of assets in the session.
  - Date range: two `<input type="date">` fields (from / to).
  - Free-text search over asset title and note.
- **Sorting:** column headers for `Time`, `Asset`, `Actor`, `Transition`; click to toggle asc/desc. Default: newest first.
- **Rendering:** simple table (Time · Asset · Actor · Prev → New · Note). Row count + "Clear filters" link.
- All filtering/sorting is client-side over the already-fetched `events` array — no extra requests, no schema changes.

## Files touched

- `supabase/functions/frank-api/index.ts` — SSE branch on the handoff route; optional `email` join on approval-history.
- `supabase/functions/frank-api/handoff.ts` — expose the build/JSON/CSV/validate steps as discrete functions the route can await between SSE emits.
- `supabase/functions/frank-api/handoff_test.ts` — add a test for the stepped builder (each step returns expected shape).
- `frank-create/src/lib/api.ts` — new `createSessionHandoffStream` helper; keep `createSessionHandoff` as fallback.
- `frank-create/src/components/ReviewBoardPage.tsx` — stepped progress toast, download-phase cancel, new Audit Trail section with filters + sorting.

## Out of scope

- No DB schema changes (audit events table already has everything needed).
- No changes to approve/reject flow, video export toast, or manifest schema version.
- No new dependencies.

## Acceptance checks

- Clicking "Generate handoff" shows a toast that walks through all 4 named steps, with a live progress bar and elapsed timer.
- Cancel during any packaging step aborts the request within ~1s and shows "Handoff canceled."
- Cancel during a download dismisses the file save and shows "Download canceled."
- Audit Trail section renders all events, and every filter + sort control narrows/reorders the visible rows without a network call.
- Existing JSON/CSV download, schema validation, retry, and per-asset audit `<details>` still work unchanged.
