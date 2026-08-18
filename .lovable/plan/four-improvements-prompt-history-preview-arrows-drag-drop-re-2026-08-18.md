# Four improvements: prompt history, preview arrows, drag-drop references, cleanup

## 1. Prompt generator chat history

Right now leaving the page wipes the conversation. It becomes a proper chat product:

- Every conversation is saved to your account as you go, so it survives page changes, refreshes, and other devices.
- A history list sits alongside the chat: each past conversation shows its first line and when it happened. Click one to reopen it read-and-continue.
- "New chat" starts a fresh conversation and files the old one into history instead of deleting it.
- Rename and delete a saved conversation from the list.
- Wizard answers and the final prompt are part of the saved thread, so reopening shows the whole flow.

## 2. Click through images inside the preview

- The full-screen preview gets left/right arrows plus keyboard arrow keys, stepping through every pick in that same run.
- A small "3 of 6" counter, and arrows hidden when the run has a single image.
- Escape still closes; the existing actions (edit this, save) stay.

## 3. Drag and drop onto the upload tile

- The first tile in "Add references" becomes a real drop target: drag files from Finder onto it and they upload immediately, then appear as the newest tiles beside it, pre-selected.
- Visual highlight while a file is hovering over the tile, and the whole picker panel accepts the drop too (not just the tile), so a near-miss still works.
- Non-image files are ignored with a short note.

## 4. Removals

Approvals, fully:
- No approve/reject buttons anywhere (run tiles, preview, review pages), no approved/rejected rings or status pills, no approval counts.
- The "Approved" and "Review board" nav entries and their pages go away.
- The reference library now offers all your generated images plus your uploads, newest first, instead of only approved ones.

Style presets, fully:
- The "Style preset" dropdown in the run settings rail goes away, along with preset text being appended to briefs.
- The "Presets" nav entry, the preset library column, and the preset creator go away.
- Brief Mix (close-up / editorial / candid remix) stays — that is separate from style presets.

## Technical notes

- New backend tables `prompt_chats` and `prompt_chat_messages`, keyed to the signed-in user with row-level policies plus grants; loaded and written through `frank-api` (or direct client reads) and wired into `components/PromptGenerator.tsx`, which currently keeps `messages` in component state only.
- `App.tsx`: lightbox gains run-scoped navigation (index within the turn's asset list) and key handling; `changeAssetStatus`, `startEditFromAsset` approval branches, and approval UI removed; reference library query drops the `approval_status = approved` filter.
- Drag events on `.reference-picker-upload` reuse the existing `handlePickerUpload` path.
- Deleted: `components/ApprovedScreen.tsx`, `components/ReviewBoardPage.tsx`, `components/PresetCreator.tsx`, the `approved`/`review`/`presets` screens in `nav.ts`, the `Style preset` block in `components/StudioRail.tsx`, and the now-dead preset/approval helpers in `lib/`, `lib/mcp/tools/set-asset-approval.ts`, and their CSS in `app.css`. `approval_status` stays in the database schema (history), it is simply no longer surfaced or written.
