# Use the full width on large screens + roomier run grids

On wide displays the Studio content is capped at 1260px, so everything sits in a narrow band with large empty margins. The fix is to let the Studio (and Upscaler) content column grow with the viewport while keeping comfortable side gutters, and to give the picks grid more breathing room.

## What changes

1. **Wider content column on large screens**
   - The Studio page column stops being capped at 1260px. It grows with the window up to about 2000px, always keeping a clear gutter on each side (gutter grows a little on very wide screens).
   - Below ~1400px nothing changes — your current screen keeps the layout you already like.
   - Reading-only screens (Settings, Admin, Review board, Health) keep their existing narrow cap.

2. **More image columns per run**
   - Because the visual side of a run card gets much wider, the picks grid fits more tiles per row: 2 columns as today at current widths, 3 then 4 columns as the card widens. Compare (side-by-side) rows keep their 2-up shape per side.
   - Single-image runs stay a single large tile.

3. **More padding**
   - Larger gap between image tiles inside a run.
   - More padding between the images and the run card / dark panel edges, so tiles no longer touch the border.

## Technical notes

- `frank-create/src/App.tsx`: pass a wider `maxWidth` to `Shell` for the Studio/Upscaler view, e.g. `min(2000px, 100%)`; other screens untouched.
- `frank-create/src/ds/tokens/layout.css` / `navigation.css`: allow `--page-gutter` to step up at the `xl` breakpoint; no change to `--page-max-width` (still the default for other screens).
- `frank-create/src/app.css`:
  - `.output-grid` — drive column count from the card's own width using container queries on `.turn-visual` (2 / 3 / 4 columns), replacing the fixed `repeat(2, ...)` on `.turn-row-single`/`.compare-run-grid` where appropriate.
  - bump `.output-grid` `gap` and `.turn-card` padding; add inner padding to the rounds well so tiles clear the dark panel edge.
  - raise the `.turn-card-body` stacking breakpoint values only if needed; the 15% info column cap stays.
- No changes to generation logic, backend, or edge functions.
