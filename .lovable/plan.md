# Tagged reference images (@ref1, @ref2 …)

Today every loaded reference is sent as an anonymous list, so the prompt can't point at a specific image and models blend or ignore them. This adds a stable tag per reference and rewrites the prompt so the model knows exactly which attached image each tag means.

## What changes in the UI

- Each reference in the composer dock gets an auto-assigned tag shown on the thumbnail: `@ref1`, `@ref2`, `@ref3`… in dock order.
- Clicking the tag label (or the thumbnail's new "insert tag" affordance) inserts `@ref1` at the caret in the prompt box.
- Removing a reference re-numbers the remaining ones so tags always match the order actually sent to the model.
- Reference picker and the "loaded" line show tags too, plus a short hint: "Reference tags: @ref1 shampoo.jpg, @ref2 model.png — use them in the prompt."
- Hovering a tag highlights its thumbnail; the run card records which tags were used with which file names.

## What changes in the prompt sent to the model

Before sending, the prompt is expanded so tags become explicit, positional language the models understand:

- A reference manifest is prepended, one line per reference: `Reference image 1 (@ref1) = shampoo.jpg`, in the exact order the URLs are attached.
- Every `@refN` in the user's prompt is rewritten inline to `reference image N` (keeping the tag in brackets for clarity), so no model receives a bare `@` token.
- If the prompt uses tags, the identity-lock preamble switches to a per-tag instruction: each tagged image controls only the subject it is named for, and untagged references are treated as general style/context.
- Tags that don't match any loaded reference are flagged in the composer before the run instead of being silently sent.

This applies to normal Image runs, Video runs (including first/last frame slots, which get `@first` / `@last` aliases), Compare mode (both sides use the same manifest, trimmed to each model's reference limit), and Upscaler references.

## Technical notes

- Tag assignment and prompt expansion live in `frank-create/src/lib/studio.ts` as pure functions (`referenceTagFor(index)`, `buildReferenceManifest(assets)`, `expandReferenceTags(prompt, assets)`), with unit tests in `studio.test.ts`.
- `composeReferenceLockedPrompt` in `App.tsx` is replaced by a version that takes the ordered reference assets, emits the manifest, and expands tags; all generation call sites (single run, compare A/B, edit/masked edit) use it so the tag order and the `reference_images` URL order can never drift.
- Tags are derived from position, not stored in the database, so nothing needs a migration; the resolved manifest is stored in the existing turn request snapshot for the run card.
- No changes to the edge functions' reference field mapping — they already forward the ordered URL array per model.
