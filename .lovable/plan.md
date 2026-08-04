# Enhancer tab (image + video upscaling)

A new sidebar tab, **Enhancer**, that takes any image or video — picked from previous Studio runs, or uploaded fresh — and upscales it through dedicated Replicate upscale models.

## Models (schemas verified live on Replicate)

Image:
- **Recraft Crisp Upscale** (`recraft-ai/recraft-crisp-upscale`) — input: `image` only. No settings. Fast, cheap, sharpen/clean.
- **Topaz Image Upscale** (`topazlabs/image-upscale`) — input: `image`, plus
  - `enhance_model`: Standard V2 / Low Resolution V2 / CGI / High Fidelity V2 / Text Refine
  - `upscale_factor`: None / 2x / 4x / 6x
  - `subject_detection`: None / All / Foreground / Background
  - `output_format`: jpg / png
  - `face_enhancement` (bool) + `face_enhancement_strength` (0–1) + `face_enhancement_creativity` (0–1), both only shown when face enhancement is on

Video:
- **Topaz Video Upscale** (`topazlabs/video-upscale`) — input: `video`, `target_resolution` (720p / 1080p / 4k), `target_fps` (15–120, default 60).
- **Crystal Video Upscaler** (`philz1337x/crystal-video-upscaler`) — input: `video`, `scale_factor` (numeric ≥1, default 2, auto-capped at 4K output).

Only fields each model actually exposes are rendered — same "loyal to the model schema" rule the Studio rail already follows.

## UX

```text
Sidebar → Enhancer
 ┌─ Source ───────────────────────────┐  ┌─ Results ──────────────┐
 │ [From previous runs] [Upload]      │  │ newest job on top      │
 │ thumbnail grid of session assets   │  │ before / after pair    │
 │ (images for Image mode,            │  │ download + open        │
 │  videos for Video mode)            │  │ retry / delete         │
 ├─ Mode: ( Image | Video )           │  └────────────────────────┘
 ├─ Model picker (2 per mode)         │
 ├─ Model-specific settings           │
 └─ [Enhance]  est. runtime note      │
```

- Mode toggle (Image / Video) mirrors the Studio rail pattern; switching mode swaps model list and the eligible source assets.
- Source picker lists assets from the current session's previous runs (images or videos depending on mode) and supports selecting multiple — each selected asset becomes its own upscale job, run in parallel with a small concurrency cap.
- Upload path reuses the existing reference-upload flow (Supabase storage + signed URL) so uploads persist and are re-runnable.
- Result cards show before/after, the model + settings used, elapsed time, download button, and a retry that re-submits the same job.
- Video jobs are long (Topaz 4K can take several minutes), so jobs poll in the background with a visible progress/status state and survive tab switches within the session.

## Technical notes

- `presets.ts`: add a fifth capability flag (`upscale`) and four new model entries with `media: "image" | "video"`, exact enums above, `max_count: 1`, and no aspect/size fields (upscalers keep source geometry).
- `frank-generate/replicate_input.ts`: add builders for the four slugs, mapping the selected asset URL into `image` / `video` and passing only that slug's supported settings; extend `REFERENCE_FIELD_BY_SLUG` accordingly, with unit tests in `replicate_input_test.ts`.
- `frank-api/index.ts`: add an `enhance` action that creates a job per selected source, submits the prediction, polls, and writes the output back as a session asset tagged `kind: "upscale"` with `source_asset_id` so before/after pairing works. Long video polls use the existing async prediction polling path rather than a single blocking call.
- New `src/components/Enhancer.tsx` plus a `studioMode` value `"enhancer"` in `App.tsx` (nav button, hash route, `initialStudioMode`).
- Errors reuse the existing Replicate error mapping and `generation_errors` logging; failed jobs surface the same "Retry safely" affordance.
- Styling stays on the existing sidebar/rail/result-card classes in `styles.css` — no new visual language.

## Out of scope

- No batch cross-session queue or scheduled runs.
- No cost estimator for upscales in this pass (Crystal/Topaz bill per megapixel-second, which needs a probe of source dimensions); it can follow once the tab is live.
