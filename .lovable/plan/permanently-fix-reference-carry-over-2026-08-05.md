# Permanently fix reference carry-over

## Goal
Every image, video, and side-by-side run starts with an empty reference dock after Generate is clicked. Refreshing, session reconciliation, retries, and switching sessions must not preload old references.

## Confirmed cause
The visible dock is currently derived from every session asset whose `kind` is `reference`. Session bootstrap, session switching, and post-run reconciliation reload all saved assets, so historical reference records can become active-looking references again.

## Implementation
1. Introduce explicit state for the references currently attached to the next run instead of deriving the dock from all historical reference assets.
2. Add newly uploaded, pasted, or dropped references to that active dock only through the existing add-reference actions.
3. Snapshot the active references into the generation request, then clear the active dock immediately when Generate starts for image, video, and side-by-side runs.
4. Keep historical reference records available for run provenance without allowing bootstrap, refresh, reconciliation, or session switching to attach them automatically.
5. Ensure manual X removal clears the reference from the active dock and that retrying an old run does not silently restore its old references.

## Validation
- Upload a reference, generate an image, and confirm the dock clears immediately while loading.
- Repeat for video and side-by-side generation.
- Refresh during and after a run and confirm the dock remains empty.
- Switch away from and back to the session and confirm old references are not attached.
- Drag a previous output into Add references and confirm only that deliberate action attaches it.