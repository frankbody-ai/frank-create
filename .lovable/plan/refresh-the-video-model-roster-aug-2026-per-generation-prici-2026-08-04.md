# Refresh the video model roster (Aug 2026) + per-generation pricing

Replace the obsolete video models with the current top-ranked ones, wire each to its real Replicate schema, show a live price estimate per generation, and fix the text overflow on the rail cards.

## Model roster

Verified live on Replicate this turn (schemas pulled from the API):

| Studio label | Replicate model | Aspect | Duration | Quality | Source image | Price |
| --- | --- | --- | --- | --- | --- | --- |
| Grok Imagine Video (Cheapest) | `xai/grok-imagine-video` | auto, 16:9, 4:3, 1:1, 9:16, 3:4, 3:2, 2:3 | 1–15s | 720p, 480p | optional | $0.05/s |
| Dreamina Seedance 2.0 | `bytedance/seedance-2.0` | 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, 9:21, adaptive | 5–15s (or auto) | 480p, 720p, 1080p, 4k | optional (+ up to 9 refs) | $0.05/s |
| Grok Imagine Video 1.5 | `xai/grok-imagine-video-1.5` | auto, 16:9, 4:3, 1:1, 9:16, 3:4, 3:2, 2:3 | 1–15s | 720p, 480p | required | $0.08/s |
| Happy Horse 1.0 | `alibaba/happyhorse-1.0` | 16:9, 9:16, 1:1, 4:3, 3:4 | 3–15s | 720p, 1080p | optional | $0.05–0.11/s |
| Wan 2.7 (image-to-video) | `wan-video/wan-2.7-i2v` | match input image | 2–15s | 720p, 1080p | required (`first_frame`) | $0.05–0.11/s |
| Minimax Hailuo 2.3 (Most expensive) | `minimax/hailuo-2.3` | per model schema | per model schema | per model schema | optional | verify from Replicate, then label as premium |

Two models from your table are not published on Replicate (confirmed 404 on the API): `minimax-h3` and `gemini-omni-flash`. Per your answer, `minimax-h3` is substituted with Minimax Hailuo 2.3 and `gemini-omni-flash` is left out. The five obsolete entries (Kling 2.5, Hailuo 02, Seedance 1 Pro, Veo 3 Fast, Wan 2.5 i2v) are removed.

## Pricing in the Studio rail

- Each video model carries its rate (per-second or flat) and a price band.
- The rail's model card shows a live estimate that recomputes when duration or quality changes, e.g. `~$0.40 · 5s @ 720p`, with a range shown for the variable-rate models.
- The cheapest model (Grok Imagine Video 720p) gets a green "Cheapest" badge; the most expensive gets a "Premium" badge. Both badges also appear in the model dropdown labels.
- Each model tile/option shows its rate so the comparison is visible before selecting.

## Overflow fix

The rail model description and badge row currently spill outside their card. Clamp the description to a fixed line count with an ellipsis, allow badges to wrap, and add `min-width: 0` / `word-break` so long model names and notes stay inside the card.

## Technical notes

- `frank-create/src/lib/presets.ts` — replace the video model block; add `price_per_second`, `price_flat`, `price_max_per_second`, and `price_tier` (`cheapest` | `standard` | `premium`) fields per model, plus the exact aspect/duration/resolution enums above. `match_input_image` is added as an aspect option for Wan 2.7.
- `frank-create/src/lib/types.ts` — extend `StudioModel` with the pricing fields.
- `frank-create/src/lib/studio.ts` — add `estimateVideoCost(model, settings)` returning a formatted string or range; keep existing aspect/size clamping working with the new enums.
- `frank-create/src/components/StudioRail.tsx` — render the estimate, the Cheapest/Premium badges, and per-option rates.
- `frank-create/src/styles.css` — line-clamp `.rail-model-desc`, wrap `.rail-model-badges`, add the badge/estimate styles.
- `supabase/functions/frank-api/index.ts` — replace the video slug map and the per-slug input builders with the verified field names: `image` (Grok, Seedance, Happy Horse), `first_frame` / `last_frame` (Wan 2.7), `resolution`, `aspect_ratio`, `duration`, `generate_audio` for Seedance. Keep the existing long-poll timeouts. Redeploy `frank-api` after the change.
- Verify Hailuo 2.3's schema and price through the Replicate API before finalising its entry.
