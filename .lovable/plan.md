## Diagnosis (verified)

Reve 2.1 is down on the provider side. A control prediction sent straight through the Replicate gateway — plain text prompt, no reference images, `aspect_ratio: "1:1"` — failed in 0.5 seconds with the same `ModelError ... (E001)`. The live model schema confirms our request fields (`prompt`, `aspect_ratio`, `reference_images` up to 8) are correct. Nothing in FrankCreate is causing it, and no code change can make Reve generate images until Reve recovers.

## What to change

Right now this looks like an app bug: the card fails, the error text is cryptic, and "Retry" hammers a dead model. Proposal:

1. **Classify E001 as a provider outage** in `supabase/functions/frank-api/index.ts` (`classifyReplicateModelError`). Add an `E001` / `ModelError` branch returning a `provider_unavailable` code with a plain message: "Reve 2.1 is temporarily unavailable on the provider side. Try Nano Banana Pro, Seedream 5 Pro, or GPT-image-2." Keep it retryable but flagged.

2. **Show it as an outage in the UI**, not a validation failure — in the generation card error panel, `provider_unavailable` gets a distinct treatment (warning tone, no "fix your inputs" hint) plus a one-click "Switch model and retry" action that re-runs the same prompt/references on the currently selected fallback model.

3. **Mark Reve 2.1 as degraded in the model picker** (`presets.ts` + composer): a small "Provider issue" badge and a tooltip, so nobody burns a round on it. This is a manual flag I flip back once Reve is healthy — no automatic health polling, which would add cost and complexity for a transient outage.

## Alternative if you prefer minimal churn

Just grey out Reve 2.1 in the model dropdown (same treatment as Video Lab / Product Shot Lab), and re-enable it later. No error-mapping work. Say the word if you want this instead of the fuller version above.

## Technical notes

- Files: `supabase/functions/frank-api/index.ts` (error classification), `supabase/functions/frank-generate/index.ts` (same classifier for parity), `frank-create/src/lib/presets.ts` (degraded flag + fallback model hint), `frank-create/src/App.tsx` (error panel branch, switch-and-retry), `frank-create/src/styles.css` (outage badge styling).
- The existing `generation_errors` Supabase table already captures raw provider text, so outage frequency stays queryable — no schema change.
- Both edge functions get redeployed after the change.
