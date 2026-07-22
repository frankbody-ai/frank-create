## Goal
Fix Reve 2.1 "Provider returned no image" and surface the real Replicate failure instead of the generic UI label.

## Diagnosis (needs log confirmation)
Reve is routed through `runReplicate` in `supabase/functions/frank-api/index.ts`. Two likely causes for a silent "no image" outcome:
1. `runReplicate` extracts `output` only as `string | string[]`. If Reve returns `output` as an object (`{ image }`, `{ url }`, or `{ images: [...] }`) or as `null` on a `succeeded` prediction with `content_violation` / policy failure, `url` becomes `undefined` and the outer catch surfaces the generic UI fallback.
2. The `Prefer: wait=60` create call can return the prediction still pending; the polling loop is fine, but any non-JSON error body or `output: null` on succeed drops us into the empty-URL branch without the real reason.

## Steps
1. `supabase/functions/frank-api/index.ts` — harden `runReplicate`:
   - `console.log` the final Replicate prediction (id, status, error, output shape) whenever `output` can't be resolved to a URL.
   - Accept `output` as `string`, `string[]`, or object with any of `image`, `url`, `images[0]`, `output`.
   - On `succeeded` with no URL, throw a specific error including the raw output JSON slice; on `content_violation` / policy fields in the prediction, throw a distinct classified message.
2. `supabase/functions/frank-api/index.ts` — in the generate handler's outer catch for Replicate, propagate the thrown message into the turn's error snapshot so the client shows it verbatim instead of "Provider returned no image".
3. `frank-create/src/App.tsx` — update the `turnEmptyLabel` fallback so if the turn carries an error message, that message is shown instead of the generic string.
4. Deploy `frank-api` with `supabase--deploy_edge_functions`.
5. Verify: run a Reve 2.1 generation from the running preview via Playwright (auth session is injected), then read `frank-api` logs via `supabase--edge_function_logs` to confirm either success or a specific classified error surfaces to the UI.

## Out of scope
- No changes to model schemas, aspect/size validation, or Seedream/Nano Banana paths.
- No new tables or migrations.