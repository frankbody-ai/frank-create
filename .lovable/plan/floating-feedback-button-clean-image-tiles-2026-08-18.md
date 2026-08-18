# Floating feedback button + clean image tiles

## 1. Feedback button floats bottom-right

Today the feedback button only exists inside the top bar (`Shell.tsx` renders `<FeedbackWidget variant="inline" />` in the top-bar actions), so it moves and disappears with the header.

- Render the feedback widget once in the shell as a fixed floating control anchored to the bottom-right of the viewport, above the content but below modals.
- Remove it from the top-bar action cluster so there is only one entry point.
- Style the floating pill with the existing surface/shadow tokens (rounded pill, icon + "Feedback" label), sitting clear of the page gutter and staying visible on scroll on every screen (Studio, Upscaler, Prompt Generator, Approved, Settings, Admin).

## 2. Approved ring hugs the image, no grey frame

Current behaviour in `app.css`:

- `.output-tile` paints a light grey fill (`rgba(255,255,255,0.07)`) behind every pick, which shows through as the grey edge visible in the screenshots.
- The approved/rejected/selected state is a `box-shadow` ring on the tile box, while the image inside carries its own separate `border-radius`. When the tile box is taller than the picture (grid rows stretch to the tallest tile in the row), the ring traces the box, not the picture — the "empty space" and offset ring.

Changes:

- Let each tile size itself to the picture's real returned ratio instead of stretching to the row: stop tiles from filling the row's height so the box and the picture share the same rectangle.
- Move the status ring onto the media element itself (approved green, rejected red, selected white) so it always traces the picture's edge and corner radius exactly.
- Drop the grey placeholder fill on tiles that have loaded media, and keep a single shared corner radius between tile and image so no ring of background peeks out. Skeletons and placeholders keep their neutral fill while loading.
- Keep the resolution chip and hover approve/reject buttons positioned as they are.

## Technical notes

- Files: `frank-create/src/Shell.tsx` (feedback placement), `frank-create/src/components/FeedbackWidget.tsx` (fixed variant markup), `frank-create/src/app.css` (`.feedback-fab`, `.output-tile*`, `.asset-preview-media`).
- Presentation only — no changes to generation, approval, or feedback submission logic.
- Verify visually in the preview at a wide viewport with one approved pick and a mixed-ratio round.
