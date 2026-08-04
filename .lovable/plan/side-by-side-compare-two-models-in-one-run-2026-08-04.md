# Side-by-Side: compare two models in one run

Add a third mode next to Image and Video in the Studio rail. One prompt, one set of settings, two models — two API calls fired in one run, results rendered as a two-column comparison card.

## What the user gets

- A **Side-by-Side** tab in the Studio rail toggle (Image | Video | Side-by-Side).
- A media switch inside the mode (Images or Videos), then **Model A** and **Model B** pickers restricted to that media kind. B defaults to a different model than A.
- Shared prompt, aspect ratio, quality and preset — exactly 1 output per side.
- **Compatibility check before running.** When the shared aspect ratio or quality isn't in a model's accepted list, the rail proposes the closest supported value for that side and asks for approval:
  - "Model B (Seedream 5 Pro) doesn't support 21:9 — closest match is 16:9. Use it for side B?" with Approve / Change settings.
  - Same for quality/resolution and for video duration.
  - Generate stays blocked until every mismatch is approved or resolved.
- One click on Generate creates a single pending comparison card with two labelled slots; each slot fills in as its model returns. If one side fails, the other still shows, with a per-side Retry.
- Each side shows its model name and the effective settings actually used (so an auto-adjusted ratio is visible on the result, not just in the prompt).
- Both images/videos stay individually approvable, downloadable, expandable and copyable — same actions as today's cards.

## Behaviour details

- Reference images apply to both sides, clamped to each model's own reference limit; if a model accepts fewer, the extras are dropped for that side and flagged in the same approval list.
- Video side-by-side uses the same source-frame rule as today: if either model requires a source frame, the run is blocked until one is selected.
- Cost estimate in the rail shows A + B combined for video.
- Reference selection clears after the run, as it does now.
- Cancel/Stop aborts both in-flight calls.

## Technical notes

- `frank-create/src/lib/types.ts`: widen the studio media kind to include `"compare"`; add a `compare` block to studio settings (`model_a_id`, `model_b_id`, `media`), and an `effective_settings` note on turn/asset metadata so per-side adjustments are recorded.
- `frank-create/src/lib/studio.ts`: new `resolveForModel(model, settings)` returning `{ settings, adjustments[] }` — snaps aspect ratio to the nearest supported ratio by numeric closeness, snaps quality/resolution/duration to the nearest allowed value, and clamps reference count. Reused by both sides and by the rail's approval list.
- `frank-create/src/components/StudioRail.tsx`: third tab, dual model selects, and an "Adjustments needed" block listing each proposed snap with an approve control; existing aspect/quality/count/preset blocks stay shared (count is pinned to 1 in compare mode).
- `frank-create/src/App.tsx`: in `handleGenerate`, branch on compare mode — build two turn requests from the resolved per-side settings, run them with `Promise.allSettled`, and register two inflight entries under one comparison group id. Reuse the existing per-model image path and `handleVideoGenerate` internals rather than adding a new backend route.
- Comparison grouping is client-side metadata (`compare_group` on the turn's settings JSON), so no schema change and no edge-function change is required; the timeline renders two turns sharing a group id as one two-column card.
- `frank-create/src/styles.css`: `.compare-card` two-column grid collapsing to stacked on narrow widths, per-side header with model name and effective settings, and styling for the adjustment approval rows.
