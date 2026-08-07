# Move image and video generation onto OpenRouter's dedicated media APIs

You were right — I verified against the live OpenRouter API this turn. OpenRouter now serves 22 video models and ~40 image models through two purpose-built endpoints, not chat/completions:

- `POST /api/v1/images` — synchronous, real `aspect_ratio` / `resolution` / `n` / `input_references` / `quality` enums, returns base64.
- `POST /api/v1/videos` — asynchronous: submit, poll `polling_url`, download from `unsigned_urls[0]`. Supports `duration`, `resolution`, `aspect_ratio`, `frame_images` (with `frame_type: first_frame | last_frame`), `input_references`, `generate_audio`, `seed`.

Both are discoverable per-model with capability + pricing metadata at `/api/v1/images/models` and `/api/v1/videos/models`, so the Studio's dropdowns and price estimates can be sourced from what each model actually accepts.

## Image side — switch endpoint, and grow the roster

The three current OpenRouter models move off `chat/completions` onto `/v1/images`, which removes the prompt-text hack currently used to force aspect ratio:

| Studio model | OpenRouter id | Aspect ratios | Resolution | n |
| --- | --- | --- | --- | --- |
| Nano Banana Pro | `google/gemini-3-pro-image` | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 | 1K, 2K, 4K | 1 |
| Nano Banana 2 | `google/gemini-3.1-flash-image` | above + 1:4, 1:8, 4:1, 8:1 | 512, 1K, 2K, 4K | 1 |
| gpt-image-2 | `openai/gpt-image-2` | 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9, auto | quality: low/medium/high | 1–10 |

New models added (all verified live, with their real enums):

| Studio model | OpenRouter id | Notes |
| --- | --- | --- |
| Seedream 4.5 | `bytedance-seed/seedream-4.5` | 1K/2K/4K, 18 aspect ratios, n up to 10, 14 refs |
| Flux.2 Pro | `black-forest-labs/flux.2-pro` | 8 refs, png/jpeg, seed |
| Flux.2 Max | `black-forest-labs/flux.2-max` | highest-fidelity Flux |
| Riverflow 2.5 Pro | `sourceful/riverflow-v2.5-pro` | 1K/2K/4K, transparent background, 10 refs |
| Qwen Image 3 Pro | `qwen/qwen-image-3-pro` | strong small-text rendering, n up to 6 |
| Krea 2 Large | `krea/krea-2-large` | photographic look, 1K |
| MAI Image 2.5 Pro | `microsoft/mai-image-2.5-pro` | fast single-image |
| Grok Imagine Image | `x-ai/grok-imagine-image-quality` | wide ratio set incl. 2:1, 1:2 |

The Replicate-only leftovers (`reve-2-1`, `riverflow-2-pro`, `mai-image-2-5`, `seedream-5-pro`) are retired in favour of their OpenRouter equivalents above, so every image model in the roster runs on one provider.

## Video side — same six models, now on OpenRouter

Mapped one-to-one as you asked, with capabilities and per-second pricing taken from `/api/v1/videos/models`:

| Studio model | OpenRouter id | Resolutions | Aspect ratios | Price |
| --- | --- | --- | --- | --- |
| Grok Imagine Video | `x-ai/grok-imagine-video` | 480p, 720p | 16:9, 9:16, 1:1, 4:3, 3:4, 3:2, 2:3 | $0.05/s 480p, $0.07/s 720p |
| Grok Imagine Video 1.5 | `x-ai/grok-imagine-video-1.5` | 480p, 720p, 1080p | same as above | $0.08 / $0.14 / $0.25 per s |
| Seedance 2.0 | `bytedance/seedance-2.0` | 480p → 4K | 1:1, 3:4, 9:16, 4:3, 16:9, 21:9, 9:21 | token-metered |
| HappyHorse | `alibaba/happyhorse-1.1` (1.0 also available) | 720p, 1080p | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 9:21 | $0.099/s 720p, $0.128/s 1080p |
| Wan 2.7 | `alibaba/wan-2.7` | 720p, 1080p | 16:9, 9:16, 1:1, 4:3, 3:4 | $0.10/s |
| Hailuo 2.3 | `minimax/hailuo-2.3` | 1080p | 16:9 only | $0.0817/s |

Two roster corrections this brings: Wan 2.7 on OpenRouter takes explicit aspect ratios (it is no longer locked to `match_input_image`), and Hailuo 2.3 is 1080p / 16:9 only with a clean per-second rate replacing the current 6s/10s price table. The existing First/Last frame controls map directly onto `frame_images`; the reference dock maps onto `input_references`.

## Technical notes

`supabase/functions/frank-api/index.ts`
- Replace `openrouterImage` (chat/completions) with a `POST /api/v1/images` call: `{ model, prompt, aspect_ratio, resolution, n, input_references, quality }`, reading `data[].b64_json` + `media_type`. Keep the existing retry/backoff and 401/402/400/429 → `ProviderRunError` mapping. `n` is used natively where the model supports it, falling back to parallel calls for `n: 1` models.
- Add `openrouterVideo`: submit to `/api/v1/videos`, then poll `polling_url` on the existing async-job pattern already used for Replicate long-runs (10s interval, cap consistent with the current 12-minute client watchdog), and download `unsigned_urls[0]`. Send `frame_images` with `frame_type` for first/last frame, `input_references` for the dock, plus `duration`, `resolution`, `aspect_ratio`, `generate_audio`.
- Point `OPENROUTER_IMAGE_MAP` and a new `OPENROUTER_VIDEO_MAP` at the ids in the tables above; route `/videos` through OpenRouter instead of `runReplicatePrediction`. Prune the now-unused Replicate image/video slugs and `buildVideoInput` branches. Leave the whole upscaler path on Replicate untouched.
- Record `providerPayload: { provider: "openrouter", model }` for both media types.

`frank-create/src/lib/presets.ts`
- Rewrite the image and video blocks: `provider: "openrouter"`, correct `provider_model`, and `allowed_aspect_ratios` / `allowed_resolutions` / `allowed_image_sizes` / `max_count` / `reference_image_limit` copied from the verified enums. Set `price_per_second` / `price_per_second_by_resolution` from OpenRouter's `pricing_skus` and drop `price_table` for Hailuo.
- Retire the four Replicate image entries; keep `requires_source_image` on Grok 1.5 and `supports_last_frame` on Seedance and Wan.

`frank-create/src/lib/studio.ts`
- `estimateVideoCost` keeps working off `price_per_second_by_resolution`; add the Seedance token-metered case as an approximate range rather than a false exact figure. Aspect/size clamping picks up the new enums automatically.

`frank-create/src/lib/types.ts` — extend the provider union if `openrouter` isn't already accepted for video.

After the edits I'll smoke-test one real generation per new/changed model family (image + video) through the live API and report which returned successfully.
