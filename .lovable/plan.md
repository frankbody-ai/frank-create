# Add ByteDance Seedance 2.5 as a video model

Verified live against OpenRouter's `/api/v1/videos/models` this turn, so the settings match exactly what the model accepts:

| Capability | Seedance 2.5 (`bytedance/seedance-2.5`) |
| --- | --- |
| Resolutions | 480p, 720p (no 1080p / 4K — unlike Seedance 2.0) |
| Aspect ratios | 16:9, 4:3, 1:1, 3:4, 9:16, 21:9 (no 9:21) |
| Durations | 4–30s (long-form; every integer second) |
| Frame control | first_frame and last_frame |
| Audio | supported |
| Seed | supported |
| References | multimodal reference-based generation |
| Pricing | token-metered: $0.0000107 / video token ($0.0000064 with video input) |

Notable difference vs the Seedance 2.0 entry already in the roster: 2.5 trades top resolution for length (up to 30s) and reference/editing/extension strength, so it lands as the "long-form storytelling" option.

## What gets added

- New Studio video model **Seedance 2.5 (ByteDance)**, selectable in the Image/Video/Compare rail exactly like the existing six.
- Duration chips for 4–30s, quality chips for 480p / 720p, and the six supported aspect ratios only.
- First/last-frame behaviour: with one reference it runs image-to-video, with two it uses first + last frame (the existing Swap control applies). Text-to-video with no reference also works.
- Cost badge and per-second estimate. Because ByteDance bills this model per video token rather than per second, the rail will show an approximate rate (~$0.12/s at 480p, ~$0.27/s at 720p, scaled from the token price) and label the estimate as approximate rather than showing a false exact figure.

## Technical notes

`frank-create/src/lib/presets.ts`
- New video entry after `dreamina-seedance-2`: `id: "seedance-2-5"`, `provider: "openrouter"`, `provider_model: "bytedance/seedance-2.5"`, `media: "video"`, `badge: "720p"`, `allowed_resolutions: ["480p","720p"]`, `allowed_aspect_ratios: ["16:9","4:3","1:1","3:4","9:16","21:9"]`, `allowed_durations: [4,6,8,10,12,15,20,25,30]`, `supports_last_frame: true`, `reference_image_limit: 9`, `max_count: 1`, `price_per_second_by_resolution: { "480p": 0.12, "720p": 0.27 }`, `price_tier: "standard"`, `cost_tier` set so the dropdown shows the right `$$` badge alongside the other video models.

`supabase/functions/frank-api/index.ts`
- New `OPENROUTER_VIDEO_MAP["seedance-2-5"]` entry: `model: "bytedance/seedance-2.5"`, `resolutions: ["480p","720p"]`, `defaultResolution: "720p"`, the six aspects above with `defaultAspect: "16:9"`, `minDuration: 4`, `maxDuration: 30`, `defaultDuration: 5`. Everything else — `clampVideoSettings`, the `/api/v1/videos` submit + poll path, `frame_images` with `frame_type`, `input_references`, `generate_audio`, request-JSON capture, and error mapping — already handles the model generically, so no other backend change is needed.

`frank-create/src/lib/studio.ts`
- `estimateVideoCost` picks up `price_per_second_by_resolution` automatically; add the "approx." qualifier for this token-metered model so the number is not presented as exact.

After the edit I'll run one real 480p generation through the live API to confirm the payload is accepted, and report the result.
