# Restyle the Studio centre pane (Leonardo-style run cards)

Keep both side menus exactly as they are. Only the middle column changes: it gets breathing room on each side, and each run's metadata moves from above the images to a column on the right of the images.

## What changes

1. **Centred, inset content column**
   - The composer, the thread, and the run cards stop stretching edge to edge. They sit in a centred content band with a max width (~1180px) and consistent side gutters, so there is visible blush background on both sides.
   - Vertical rhythm stays as-is; only the horizontal framing changes.

2. **Run card becomes a two-column layout**
   - Left (large): the generated images grid — the visual hero of the card.
   - Right (fixed ~240px): the run's data, in this order — kind/eyebrow + status dot, model name, prompt text (clamped to ~4 lines with expand on click), then the chip stack (short id, timestamp, status, aspect, count, references, partial-failure chip, "Retry missing", Copy prompt, error copy).
   - The top-right icon buttons (Copy ID, Retry, Delete, New badge) stay where they are, floating over the card.
   - Compare (side-by-side) rows and pending/generating cards use the same shape, so a loading card already shows skeletons on the left with its metadata panel on the right.

3. **Image grid sizing**
   - Because the images now own most of the card width, the grid shows fewer, larger tiles (up to 3 across for multi-image rounds, single large tile for one-image rounds), each preserving the round's aspect ratio.

4. **Responsive fallback**
   - Below ~1000px of centre-column width, the card stacks back to metadata-on-top / images-below (current behaviour), and the gutters shrink so nothing is cramped on tablet/mobile.

## Technical notes

- `frank-create/src/App.tsx`: restructure the `<article className="turn-card">` markup (and the pending `turn-card-pending` variant) into `.turn-card-body` > `.turn-visual` (holding `OutputStrip`) + `.turn-side` (holding the existing `turn-copy` / `turn-meta` content). No changes to generation, approval, retry, or reference logic — same handlers, same data.
- `frank-create/src/styles.css`: add `.turn-card-body` grid rules (`minmax(0,1fr) 240px`), a `.conversation-column` inner max-width/margin band under `.studio-shell.guided-studio`, adjust `.output-grid` column counts for the wider visual area, and add the stacking media query. Inline styles currently on the meta chips stay; only layout containers move.
- No backend, edge function, or `lib/` changes.
