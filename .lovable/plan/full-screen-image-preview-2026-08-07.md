# Full-screen image preview

Clicking an image currently opens a small white card that shrinks to fit its contents, with the action buttons stacked in a narrow column. The fix: turn the preview into a true full-screen viewer where the media dominates the screen and the actions sit in one horizontal bar.

## What changes

- The preview opens centred and large: the image (or video) scales up to roughly 90% of the viewport width and 82% of the viewport height, keeping its aspect ratio, so portrait and landscape assets both fill the screen properly.
- The white card no longer sizes to the buttons — the media defines the width, the surrounding chrome stays minimal on the dark scrim.
- Edit this / Save / Approve / Reject move into a single horizontal action bar under the image (wrapping only on narrow screens), instead of the current vertical stack.
- Close button stays top-right, positioned relative to the viewer.
- Clicking the dark backdrop or pressing Escape closes it.
- If an asset has no loadable preview URL, show a proper large placeholder panel with the asset title instead of a bare small icon, so the viewer never collapses to a tiny box.

## Technical notes

- `src/styles.css`: rewrite `.lightbox-inner`, `.lightbox-inner img/video`, `.lightbox-actions`, and `.lightbox-close`. Remove the width-limiting `min(980px, 94vw)` cap in favour of `min(1440px, 92vw)` / `max-height: 82vh` on the media, and drop the conflicting `.lightbox img, .lightbox video { width: 100%; height: 100% }` rule at ~line 2842 that fights the max-height sizing. Set `.lightbox-actions` to `flex-direction: row`.
- `src/App.tsx`: give the asset lightbox its own wrapper class (e.g. `lightbox-inner is-viewer`) so reference-preview and compare modals keep their current geometry; add an Escape key handler for `lightboxAsset`.
- `AssetPreviewMedia`: when `preview_url` is missing, render a sized placeholder block (icon + title) rather than only the icon.
