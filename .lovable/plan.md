# Add GPT Image 2.5 Sunburst and Flare

Two new OpenAI image models, both live on OpenRouter (verified against OpenRouter's image-model catalogue this turn). They take exactly the same request shape as the gpt-image-2 entry the studio already uses, so they slot straight into the existing OpenRouter image path — no new provider code.

Verified capabilities (identical for both):

| | Value |
| --- | --- |
| Aspect ratios | 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9, auto |
| Quality | auto, low, medium, high, xhigh, max |
| Images per run | up to 10 native |
| Reference images | up to 16 |
| Price | $0.03 per 1M output image tokens, $0.008 input image, $0.005 input text |

Difference between the two: Sunburst is the precision tier (detailed work, editing accuracy), Flare is the speed tier (high-volume everyday generation).

## What changes

**Model roster** (`src/lib/presets.ts`) — two new entries modelled on the existing gpt-image-2 block:
- `openai-gpt-image-2-5-sunburst` — "GPT Image 2.5 Sunburst", cost label premium
- `openai-gpt-image-2-5-flare` — "GPT Image 2.5 Flare", cost label fast

Both: `provider: "openrouter"`, the aspect list above (dropping `auto` from the picker, keeping 21:9), sizes `1K`/`2K`, reference limit 16, max count 10, generation + edit + masked edit.

**Backend routing** (`supabase/functions/frank-api/index.ts`):
- `OPENROUTER_IMAGE_MAP`: map both ids to `openai/gpt-image-2.5-sunburst` / `openai/gpt-image-2.5-flare`.
- `OPENROUTER_NATIVE_N`: add both slugs, so a 4-image run is one call rather than four.
- `MAX_COUNT_BY_MODEL`: 10 each.
- `openrouterImage` quality allow-list: extend to accept `xhigh` and `max` so the new tiers aren't silently dropped (the existing four values are unaffected).

**Cost estimate** (`src/lib/studio.ts`) — add both to `IMAGE_PRICES` and the per-model reference-count map, so the studio shows a price before the run. Sunburst priced level with gpt-image-2 ($0.04 / 1K, $0.08 / 2K), Flare at roughly half.

**Release note** (`src/lib/releaseNotes.ts`) — one line at the top of `RELEASES` so the "What's new" pop-up announces the two models on next publish.

## Verification

After the edits I'll redeploy the backend function and run one real generation on each new model, then report which returned an image.
