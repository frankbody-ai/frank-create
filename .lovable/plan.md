## Goal

Two things: (1) diagnose and fix the "sent count=3, got 1 image + 504" behavior for Reve (and any model), (2) run a full validation matrix across every model × supported aspect × supported quality × count so we know what actually works end-to-end.

## What I found so far

In `supabase/functions/frank-api/index.ts` (lines ~398–429), the Replicate branch runs `count` predictions via `Promise.allSettled(...)` in parallel and:

- Pushes only fulfilled results into `generatedImages`.
- Throws **only** if `generatedImages.length === 0`.
- Silently discards per-image errors when at least one succeeded — so a 3-request run where 2 fail returns 1 image with no warning to the UI.
- The 504 in the console is the Supabase Edge gateway timeout (~150s wall clock). Reve at count=3 in parallel can exceed that when the model is cold, which also explains why the request appears to "finish partially" — the client sees 504 while the function was still polling siblings.

`frank-generate/index.ts` has the same partial-swallow pattern. So this is a systemic issue affecting every Replicate model at count>1, most visibly on slower ones (Reve, 4K Nano Banana Pro, Seedream 2K).

## Plan

### 1. Fix partial-failure reporting (backend)

In both `frank-api` and `frank-generate` Replicate branches:

- Track `succeeded` and `failed` counts from `Promise.allSettled`.
- Return the successful images **plus** a `partial_errors: MappedError[]` array on the response, and stamp `settings_snapshot_json.partial_errors` on the turn so it persists.
- Keep current behavior of throwing only when zero images succeed.

### 2. Reduce 504s on multi-image runs

- Cap in-flight parallelism per request to 2 (chunked `allSettled`) so 3–4 image runs don't all cold-start Replicate at once and blow the 150s edge budget.
- Add a 120s per-prediction soft cap: if a single prediction is still `starting/processing` at 120s, mark it as `code: "timeout", retryable: true` in `partial_errors` and let the successful siblings return.
- Keep the existing 3-attempt create retry and transient-poll tolerance.

### 3. Surface partial results in the UI

In `frank-create/src/App.tsx`:

- When a turn returns `n < count` assets, show a small amber chip on the round header: "2 of 3 succeeded" with a details popover listing each `partial_errors[i].code` + `message` + `request_id`.
- Keep the existing **Retry safely** button; when partial errors exist and any are `retryable`, offer **Retry missing (N)** that re-runs only the failed count with the same inputs.

### 4. Full validation matrix (automated smoke test)

Add a Playwright-driven script under `/tmp/browser/` (not committed) that, against the live preview and signed-in session:

For each `modelId` in `{google-nb-pro, google-nb-2, openai-gpt-image-2, reve-2-1, seedream-5-pro}`:

- Pick the model's declared supported aspects and qualities from `presets.ts`.
- For each `(aspect, quality)` pair, run count=1 and count=3.
- Record: HTTP status, elapsed ms, images returned, `partial_errors`, `request_id`s.
- Emit a Markdown table to `/mnt/documents/frank-model-matrix.md`.

I'll run this once after the backend fix to confirm which combos are green, which are flaky (partial), and which are broken, and share the table back. No app code depends on it — it's a diagnostic.

### 5. Deliverables

- Patched `supabase/functions/frank-api/index.ts` and `supabase/functions/frank-generate/index.ts` (partial-error reporting, parallelism cap, per-prediction timeout).
- Patched `frank-create/src/App.tsx` + `styles.css` (partial-success chip, "Retry missing" button).
- Matrix results in `/mnt/documents/frank-model-matrix.md` posted back in chat.

## Technical notes

- `Promise.allSettled` chunking: process in batches of 2 with `for` over slices; preserves the "as fast as possible" behavior for count ≤ 2, avoids stampede for 3–4.
- Per-prediction timeout uses `Promise.race([runReplicate(...), sleep(120_000).then(() => { throw new ReplicateError("Timed out waiting for prediction", { code: "timeout", retryable: true }); })])` inside the branch.
- No schema/DB migration needed; `settings_snapshot_json` is already free-form JSON.
- No changes to auth/CORS/routing.

Not in scope: reworking the timeline layout, changing model schemas, or adding new models. Just partial-failure honesty + a matrix.
