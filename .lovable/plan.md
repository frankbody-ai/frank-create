# Upscaler polish: faster tiles, clearer selection, output on top, running animation

## 1. Source images load fast

The source picker currently loads every tile at full size — the same 4K PNGs the studio produces — which is why the grid crawls. Tiles will load the same small WebP thumbnails the studio grid already uses, so the picker fills in almost instantly, and each tile keeps a fixed box so the grid stops reflowing as images arrive.

- Small WebP thumbnail per tile, falling back to the original file if a thumbnail can't be made.
- Lazy loading and async decoding, plus a soft placeholder shade until each tile paints.
- Video sources keep their poster-frame preview.

## 2. Selected source is obvious

Selection today is only a thin border. It becomes unmistakable:

- A filled circle with a white tick in the top-right corner of the selected tile.
- Stronger accent outline and a slight dim on the unselected tiles' hover state.
- The tick is decorative only; the tile stays a proper pressed toggle for keyboard and screen readers.

## 3. Output sits at the top, on black

- The **Output** card moves above **Source**, so a finished upscale is the first thing on screen; the page scrolls to it when a run completes.
- The result stage gets a black backdrop with the image centred and contained inside it, so light and dark upscales both read correctly and the before/after handle stays visible.
- Caption, compare toggle and download stay where they are, below the black stage.

## 4. Running animation

While a run is going the Output card shows the same treatment as the image generator instead of a static status line:

- A skeleton tile in the black stage with the shimmer sweep and centre spinner used by generating rounds, sized to the source's aspect.
- "Upscaling with <model>" plus elapsed seconds, and the existing Stop control.
- On completion the skeleton is replaced by the real result at the top of the list; on failure the existing error banner shows.

## Technical notes

- `frank-create/src/components/Enhancer.tsx`: swap `source-tile` `<img src={preview}>` for a small thumbnail component using `thumbnailUrl(url, 320, 40, "webp")` from `src/lib/studio.ts` (same helper/fallback pattern as `AssetThumbImage` in `App.tsx`), add `loading="lazy" decoding="async"`; add a tick badge span inside the selected tile; reorder the two `Card`s so Output precedes Source; render a pending block in the Output card driven by the existing `running` state plus a new `startedAt` timestamp for the elapsed counter.
- `frank-create/src/app.css`: extend `.source-tile` / `.source-tile.is-selected` with the tick badge and stronger outline; give `.source-tile__media` a fixed aspect + placeholder background; add a `.upscaler-stage` black surface wrapping the result media (`object-fit: contain`), and reuse `.output-skeleton` / `.output-skeleton-shimmer` / `.output-skeleton-spinner` for the running tile so the animation matches the studio exactly.
- No backend or API changes; `createEnhancement` and the model roster stay as they are.
