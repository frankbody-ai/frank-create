# Image model cost badges + remove the pill frame behind inline reference thumbs

## 1. Cost badges on image models

Each image model gets a 1–3 dollar-sign badge reflecting its average cost per image at comparable quality. Shown directly in the Model (and Model B) dropdown after the model name.

Proposed tiers:

| Model | Badge |
| --- | --- |
| Nano Banana | $ |
| Seedream 4.5 | $ |
| Grok Imagine (image) | $ |
| Nano Banana 2 | $$ |
| gpt-image-2 | $$ |
| FLUX.2 Pro | $$ |
| Qwen Image 3 Pro | $$ |
| Krea 2 Large | $$ |
| MAI 2.5 Pro | $$ |
| Nano Banana Pro | $$$ |
| FLUX.2 Max | $$$ |
| Riverflow 2.5 Pro | $$$ |

Video models keep their existing per-second rate labels — no change there.

## 2. Remove the shape around the inline reference thumbnails

The round grey shape behind the mini thumbnails comes from a generic rule that pills every direct `<span>` in the run's meta row — it also applies to the thumbnail strip. Excluding the reference strip from that rule removes the pill background, border, fixed 24px height and padding, so the thumbnails sit clean and inline next to the tags.

## Technical notes

- `src/lib/presets.ts`: add a `cost_tier: 1 | 2 | 3` field to each image model entry (and to the model type).
- `src/components/StudioRail.tsx`: render `"$".repeat(cost_tier)` in both the Model and Model B `<option>` labels, alongside the existing rate/tier suffixes.
- `src/styles.css`: change the `.studio-shell.guided-studio .thread-surface .turn-meta > span` selector to `:not(.turn-ref-strip)` so the chip styling no longer wraps the thumbnail strip.
