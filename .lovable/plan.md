# Fix round loading state and preview quality

Right now a running round shows a single generic loading square regardless of how many images/videos were requested (the round card passes `pendingCount={1}`), it does not respect the round's aspect ratio, and there is a second separate "Generating" card for in-flight runs — so one round can appear twice. Finished tiles also load the full-resolution file in the grid, which is slow.

## What changes

1. **One card per round, one square per expected output**
   - A running round renders exactly as many placeholder squares as images/videos were requested (1, 2, 3, 4, …), each in the round's own aspect ratio (portrait, landscape, square, video), not a fixed 120px box.
   - Placeholders sit in the same grid as finished tiles, so as results arrive they replace squares one by one and the layout never jumps.

2. **No duplicate loading cards**
   - The separate in-flight "Generating" card is removed; the round card itself is the loading state. If a run has no round record yet, one placeholder round card is shown and is replaced (not joined) by the real round once it exists.
   - Side-by-side compare rounds keep their two-column shape, each side loading independently.

3. **Fast previews, full quality on click**
   - Finished images in the grid load a small, low-quality thumbnail (same transform helper already used by the reference picker), with a graceful fallback to the original when a transformed variant isn't available.
   - Videos in the grid show a lightweight poster/metadata preview instead of autoplaying the full file.
   - Clicking a tile opens the full-screen viewer, which loads the full-quality original.

## Technical notes

- `frank-create/src/App.tsx`
  - `OutputStrip`: accept the round's expected count and aspect; render `assets` then `max(0, expected - assets.length)` skeleton tiles inside one `.output-grid`, each with `--asset-aspect` set from the round aspect. Remove the `!assets.length && pending` early return.
  - Round card: pass real `pendingCount` (round count from `settings_json`, falling back to the in-flight record) and the aspect instead of `pendingCount={1}`.
  - Delete the `inflightGens` pending `article` block (lines ~3821-3864) and instead surface in-flight runs that have no turn row yet through the same round-card renderer, deduped by turn id so nothing renders twice.
  - `AssetPreviewMedia`: add a `variant="thumb" | "full"` prop; thumb uses `thumbnailUrl(url, 320, 40, "webp")` with `loading="lazy"`, `decoding="async"` and an onError fallback to the original; video thumb drops `autoPlay` and uses `preload="metadata"`. Grid passes `thumb`, lightbox passes `full`.
- `frank-create/src/styles.css`: make `.output-skeleton` aspect-ratio driven (`aspect-ratio: var(--asset-aspect, 1/1)`, drop `min-height: 120px`) so placeholders match the real tile shape; keep the existing shimmer/spinner animations and reduced-motion rule.
- No backend, edge function, or generation-logic changes.
