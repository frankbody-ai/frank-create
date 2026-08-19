# Upscaler: restore the simple drop/upload card

## Goal
Revert the upscaler source area so it always shows the single **"Drop here or upload file"** card instead of the full selected-image preview card.

## Current state
- The `upscaler-drop` component renders two states: an empty drop card and a filled card that displays the selected source image, title, dimensions, and Change/Remove actions.
- The user wants only the empty drop/upload card; they see the filled preview as an unwanted "whole image set preview".

## Proposed change
1. **Remove the filled state** from `frank-create/src/components/Enhancer.tsx`.
   - Delete the `upscaler-drop--filled` block and the helper markup (tick, meta, actions).
2. **Keep the empty card always visible** and make it the only source interaction target.
   - It already opens the reference picker on click and handles drag/drop/paste.
   - Add a small, non-invasive reminder that a source is selected so the user still knows what will be upscaled.
3. **Relocate the selected-source indicator** to the settings rail or the run button area as a compact chip/thumbnail, so the drop card stays clean.
4. **Clean up unused CSS** in `frank-create/src/app.css` for the removed filled preview.

## Files to edit
- `frank-create/src/components/Enhancer.tsx`
- `frank-create/src/app.css`

## Outcome
Upscaler shows a single, simple drop/upload card on the left and the settings rail on the right, with the selected source indicated compactly rather than as a large preview.
