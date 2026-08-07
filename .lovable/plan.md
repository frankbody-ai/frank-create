# Centre the preview overlay + edit prompt inside the preview

## What's wrong today

The preview isn't a real overlay. A late skin rule in `frank-create/src/styles.css` (line 7010) sets
`position: relative` on every direct child of the studio shell, and because it loads after the
overlay rules it beats `.lightbox { position: fixed }`. The preview therefore becomes a normal grid
item in the shell layout — which is why it lands low and to the left, sized to its contents, with no
full-screen dark scrim.

## What changes

1. **Preview opens dead-centre**
   - The preview overlay is rendered into the page body instead of inside the studio shell layout, so
     no layout rule can pull it back into the grid.
   - Full-screen dark scrim, image/video centred both vertically and horizontally, media up to ~90%
     of viewport width and ~82% of height. Same fix applies to the reference preview, compare view
     and mask painter overlays so they can't drift either.
   - Backdrop click and Escape still close it.

2. **Edit the prompt from inside the preview**
   - "Edit this" no longer sends you back to the main composer. It expands a prompt box directly
     under the previewed image, pre-filled with that asset's prompt.
   - The box shows which reference the run will start from (the previewed asset is attached as a
     reference, exactly as "Edit this" does today), a Send button, and Cancel to collapse it.
   - Send (or Cmd/Ctrl+Enter) immediately kicks off a new run using the current model, aspect,
     quality and count settings — no extra clicks. The preview closes and the new round appears at
     the top of the thread with its loading skeletons.
   - While the run is submitting, the Send button is disabled with a short "Starting…" state; if the
     run fails to start, the error surfaces in the usual thread error card.

## Technical notes

- `frank-create/src/App.tsx`: wrap each overlay's JSX in a `createPortal(..., document.body)` so the
  shell's `> *` rule can't apply. Add local state for the in-preview edit box
  (`lightboxEditOpen`, `lightboxEditPrompt`) and reuse the existing `startEditFromAsset` +
  generation handler (`handleGenerate` / `handleVideoGenerate` depending on `mediaMode`) for Send.
  No changes to generation, approval or reference business logic — same handlers, same payloads.
- `frank-create/src/styles.css`: exclude overlay classes from the
  `.studio-shell.guided-studio > *:not(...)` positioning rule (defensive, in case an overlay is ever
  rendered inline again) and add `.lightbox-edit` styles (textarea + action row) matching the
  existing `.lightbox-actions` treatment.
- No backend, edge function or `lib/` changes.
