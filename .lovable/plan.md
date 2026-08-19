# Auto-clear composer + edit-from-preview

## 1. Clear the prompt box after each run

Today the prompt text stays in the Studio composer after Generate, so the next round starts with the old text still there (references already get cleared at dispatch — `clearReferenceDock()`).

Change: clear the composer text at the same moment the references are cleared — right after the request snapshot is built and the round is queued. This applies to all three paths: image, video, and compare runs.

The text is not lost: the queued round card and the saved turn keep the prompt, and existing "Reuse prompt" / round-retry controls still re-run it. Validation failures (no model, bad settings, missing references) return before dispatch, so the text is kept in those cases.

## 2. Edit directly from the image preview (ChatGPT-style)

The full-screen lightbox currently has "Edit this" (which closes the lightbox and just arms the composer back in Studio) and "Save".

New behaviour: add an inline edit composer at the bottom of the lightbox.

```text
+--------------------------------------------+
|  [x]                                       |
|   <   [    full-size image    ]   >        |
|  1024x1024 · 1:1 · Nano Banana 2 · 2/4     |
|  [ Describe the change...            ][->] |
|  Save                                      |
+--------------------------------------------+
```

- A single-line text field plus a send button (Enter sends, Shift+Enter newline).
- Sending starts a new round in the current session using the previewed image as the edit source and the typed text as the prompt, with the currently selected model and settings.
- While the round runs, the field is disabled and shows a small spinner/status; the lightbox stays open.
- When the new images land, the lightbox switches to the first new result, so the arrows walk the new round — repeated edits chain naturally.
- If the selected model cannot edit images, the composer shows that inline instead of failing silently.
- The existing "Save" stays; "Edit this" is replaced by this inline flow (the hand-off to the main composer is no longer needed).

## Technical notes

- `frank-create/src/App.tsx`: add `setPrompt("")` alongside `clearReferenceDock()` in `handleGenerate`, `handleVideoGenerate`, and `handleCompareGenerate`.
- Refactor the round-dispatch body of `handleGenerate` so it can be called with an explicit `{ prompt, editSourceAsset }` override, then use that from the lightbox composer instead of duplicating request building.
- Lightbox state additions: `lightboxEditText`, `lightboxEditBusy`; after the run resolves, point `lightboxAsset` at the first asset of the new turn.
- New styles for `.lightbox-edit` in `frank-create/src/app.css`, matching the existing lightbox action styling.
- No backend or schema changes — this reuses the existing edit-mode turn request.
