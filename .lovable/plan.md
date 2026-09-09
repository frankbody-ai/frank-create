# Extra controls for GPT Image 2.5 Sunburst & Flare

Both new OpenAI models accept settings the other models don't. Today the studio only shows aspect ratio, resolution and picks per run, so those extras are unreachable. This adds them — and only shows them when one of the two new models is selected.

## New controls (appear only for Sunburst / Flare)

- **Quality** — Auto, Low, Medium, High, X-High, Max. Default: Auto.
- **Background** — Auto or Opaque. Default: Auto.
- **File compression** — slider 0–100 for the returned file size. Default: 100 (best quality).
- **Moderation** — Standard or Relaxed. Default: Standard.
- **Picks per run** — already goes up to 10 for these two models; unchanged.
- **Reference images** — already up to 16; unchanged.

When the user switches to a model that doesn't support these, the extra controls disappear and their values are dropped from the run so nothing invalid is sent.

## Behaviour details

- Every new control is saved with the run, shown in the run summary line, and reused when a past run is re-run.
- Higher quality tiers cost more per image. The cost line under the controls will reflect the chosen quality instead of resolution alone, so the estimate stays honest.
- "Reset run settings" returns all of these to their defaults.

## Technical notes

- `src/lib/types.ts`: extend `StudioModel` with capability fields (`allowed_qualities`, `allowed_backgrounds`, `supports_output_compression`, `allowed_moderation`) and `StudioSettings` with `quality`, `background`, `output_compression`, `moderation`.
- `src/lib/presets.ts`: declare the new capability arrays on `openai-gpt-image-2-5-sunburst` and `openai-gpt-image-2-5-flare` only; all other models leave them undefined.
- `src/lib/studio.ts`: normalise/validate the new fields against the selected model (drop unsupported values on model switch, same pattern as `image_size`), and add a quality multiplier to `estimateImageCost`.
- `src/components/StudioRail.tsx`: render the new fields conditionally from the model capability arrays (chips for quality/background/moderation, range input for compression).
- `src/App.tsx`: include the new fields in the default settings object, the model-switch reconciliation effect, reset, and the run summary chip line.
- `supabase/functions/frank-api/index.ts`: `openrouterImage` already forwards `quality`; add `background`, `output_compression` and `moderation` to the payload, gated on the model being one of the two GPT Image 2.5 slugs so other providers are unaffected. No route paths or response fields change.
- `src/lib/studio.test.ts`: cover capability gating and settings normalisation; typecheck plus tests before deploying `frank-api`.
- Add a `RELEASES` entry in `src/lib/releaseNotes.ts`.
