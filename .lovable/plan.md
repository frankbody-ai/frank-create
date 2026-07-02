## Goal

Make handoff packaging failures actionable: surface exact schema errors inline + in the toast, block downloads when invalid, and let users retry from the last successful step instead of restarting the whole pipeline.

## Changes

### 1. Edge function (`supabase/functions/frank-api/index.ts`)

- In the SSE handoff stream, when `validateManifest` returns issues:
  - Emit a `validate` step with `progress: 90`, `payload.issues: string[]`, and `payload.stage_snapshot` (the built manifest + generated JSON/CSV strings so a retry can resume).
  - Emit an `error` step with `message` = joined issues and `payload.issues` + `payload.resumable_from: "validate"`.
- Extend each step event to include a `stage` field (`fetch` | `build_manifest` | `generate_json` | `generate_csv` | `validate`) and, on failure, `payload.resumable_from` = the last successfully completed stage.
- Add `POST /sessions/:id/handoff/resume` accepting `{ from_stage, snapshot }` that reruns only the remaining stages (build → json → csv → validate) using the provided snapshot when present, otherwise refetches. Streams the same SSE shape.

### 2. API client (`frank-create/src/lib/api.ts`)

- Extend `HandoffStreamStep` with `stage?`, `payload.issues?: string[]`, `payload.resumable_from?`, `payload.snapshot?`.
- Add `resumeSessionHandoffStream(sessionId, { fromStage, snapshot, signal, onStep })` mirroring `createSessionHandoffStream` but hitting the resume endpoint.

### 3. Review board UI (`frank-create/src/components/ReviewBoardPage.tsx`)

- Track `lastSuccessfulStage`, `lastSnapshot`, and `validationIssues: string[]` while streaming.
- Toast:
  - On `error` step, show the failed stage + first 2 issues, plus:
    - **Retry from last step** button (calls `resumeSessionHandoffStream` with saved snapshot + stage).
    - **Restart** button (existing full retry).
    - **Copy errors** button.
- Inline panel below the handoff controls:
  - When `validationIssues.length > 0`, render a red card listing every issue (`<ul>`), the stage that failed, and both Retry/Restart buttons.
  - Persist until a successful run clears it.
- Gate the JSON/CSV download buttons: `disabled` while `validationIssues.length > 0` with a tooltip "Fix schema errors before downloading." The final payload is only assigned to `handoffPayload` when validation passes.

### 4. Tests (`supabase/functions/frank-api/handoff_test.ts`)

- Add cases: manifest missing `blueprint.provider` → issues include exact path; resume from `generate_csv` with a valid snapshot produces identical CSV; download gate helper returns false when issues present.

## Technical notes

- Snapshot payload is bounded (manifest JSON only; assets already summarized) so SSE size stays reasonable.
- Resume endpoint reuses the same `buildManifest` / `manifestToCsv` / `validateManifest` helpers — no logic duplication.
- Download-blocking is client-side; server still returns the invalid manifest in `stage_snapshot` so devs can inspect it.
