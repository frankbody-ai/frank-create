## Diagnosis (unconfirmed root cause — verify first)

Your request bodies look correct per each model's published schema (Reve = `prompt` + `aspect_ratio` + optional `reference_images`; Seedream / Nano Banana Pro / Nano Banana 2 = `prompt` + `aspect_ratio` + `resolution`/`size` + `image_input`/`reference_images` + `output_format`; gpt-image-2 = `prompt` + `aspect_ratio` (ratio OR pixel preset) + `quality` + `number_of_images`). The 502 is almost certainly not a schema issue — Replicate's gateway itself returns 502 when it can't reach the upstream worker in time.

The most likely culprit in our current code is **`Prefer: wait=60`** on the create call. That header asks Replicate's edge to hold the HTTP connection open for up to 60s waiting for the prediction to complete. When the model is under load or cold-starting (Reve/Seedream frequently do), the upstream proxy times out on that held connection and returns **502 Bad Gateway** — even though the prediction itself would have succeeded had we just polled normally.

## Plan

### 1. Confirm cause via logs
Read the last 30 min of `frank-generate` logs and look at `replicate:create:status` entries. If the 502s come from the **create** call (not poll), `Prefer: wait=60` is the cause. If they come from **poll**, it's a different path.

### 2. Remove the long "wait" prefer
In `supabase/functions/frank-generate/index.ts` `runReplicate()`:
- Drop `"Prefer": "wait=60"` from the create headers. POST returns immediately with `status: "starting"`; existing poll loop already handles that.

### 3. Add transient-5xx retry on create
Wrap the create fetch in a small retry helper (max 2 retries, 1.5s → 3s backoff with jitter) that retries only on `502/503/504` or network errors. Do **not** retry on 4xx, 402, or 401.

### 4. Poll: same retry treatment on transient failures
Currently a single 5xx during poll throws immediately. Allow up to 3 consecutive transient poll failures before giving up — Replicate's proxy occasionally 502s a single poll while the prediction is fine.

### 5. Parallelize per-image loop (small win)
For `count > 1`, replace the sequential `for` loop with `Promise.allSettled` so a single slow model doesn't multiply latency. Keep abort-signal wiring.

### 6. Surface a clearer message
When the mapped error is `provider_unavailable` from a 502, message becomes: *"Replicate upstream is overloaded (502). We retried automatically — try again in a moment, or switch model (Seedream / Nano Banana 2 usually recover fastest)."* This is what your "Retry safely" button already handles.

### Files touched
- `supabase/functions/frank-generate/index.ts` (only)
- Deploy `frank-generate` after edits

### Not changing
- Per-model input builders (`buildReplicateInput`) — schemas are correct.
- `frank-api` — same runReplicate isn't the code path for /generate.
- Client UI.

### Verification
After deploy, run one Reve 2.1 16:9 and one Seedream 4:3 request via `curl_edge_functions`; confirm create returns 201 quickly, poll drives to `succeeded`, and no 502 bubbles up.