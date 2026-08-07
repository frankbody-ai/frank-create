# Format, real resolution, and a JSON payload chip on every round

## What gets added

1. **Aspect chip** — each round's meta column gets a chip with the format that was chosen (`1:1`, `3:4`, `16:9`…), read from the round's saved settings. Video rounds also show the duration/resolution enum they were run at.

2. **Real returned resolution** — a per-image chip like `1536 × 2048` measured from the file the provider actually returned, not from what we requested.
   - Today the stored `width`/`height` are fake: `persistImageAssets` fills them with `requestedDimensions()`, which just parses the aspect ratio string, so an asset can literally be stored as 3 × 4.
   - Fix: after the image bytes are downloaded and before upload, read the true pixel dimensions out of the file header (PNG `IHDR`, JPEG `SOF`, WebP `VP8`/`VP8L`/`VP8X`) and persist those, alongside the byte size.
   - Videos: OpenRouter's job payload is used when it reports dimensions; otherwise the player reports the true `videoWidth × videoHeight` on load and that is what the chip shows.
   - Older assets with no real dimensions stored fall back to measuring the loaded media in the browser, so historical rounds show a correct number too instead of `3 × 4`.

3. **JSON chip** — a new `JSON` chip next to the existing chips on every image and video round. Clicking it opens a centred panel showing the exact request body that was sent to the provider (model, prompt, aspect ratio, resolution/size, quality, n, duration, reference/frame image entries), pretty-printed, with a Copy button.
   - The payload is captured server-side at send time and saved on the round, so it reflects exactly what went out — including the composed provider prompt with the `@ref` manifest.
   - Reference images are recorded as short descriptors (`ref1: image/png, 412 KB`) rather than inlined base64 so the panel stays readable and the record stays small.
   - Keys that look like credentials are stripped before saving; no headers or API keys are ever stored or shown.
   - Rounds generated before this change show the chip disabled with "not captured for this round".

## Technical notes

- `supabase/functions/frank-api/index.ts`:
  - New `imageDimensions(bytes, mime)` header reader; `persistImageAssets` stores real `width`, `height`, `bytes` in `metadata_json` and keeps `requested_*` fields separately for comparison.
  - `openrouterImage` / `openrouterVideo` return the payload they sent (or write it through a passed-in collector); the image/video handlers put a sanitized copy on the turn's `settings_snapshot_json` as `provider_request` (reuse the existing sensitive-key redaction pattern), and video assets record dimensions from the job payload when present.
  - Replicate path (upscaler) records its built input the same way, so the chip works there too.
- `frank-create/src/lib/types.ts`: extend `Asset` with optional `bytes`, and `StudioSettings`/turn parsing with `provider_request`.
- `frank-create/src/App.tsx`: add the aspect chip and `JSON` chip to `turn-meta`; add a resolution badge on output tiles and a line in the full-screen preview; add a `ProviderPayloadModal` (portal-rendered, centred, Escape/backdrop close, Copy button); measure `naturalWidth`/`videoWidth` on load as the fallback source.
- `frank-create/src/styles.css`: styles for the resolution badge, the `JSON` chip, and the payload panel (`pre` block, monospace, scrollable).
- No schema migration needed — everything rides in existing `metadata_json` / `settings_snapshot_json`.
