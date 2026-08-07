# Drop the frame slots — infer video mode from references

## The rule

- References attached → image-to-video, using the attached reference(s).
- No references → text-to-video.
- No extra picker in the right-hand rail.

## What changes in the UI

The **Frames / Source frame** block is removed from the settings rail, along with slot arming, drag-to-slot, and the "Use as first/last frame" asset actions.

Below the brief box, where reference tags already show (`@ref1 @ref2 …`), the video path gets a short inline note:

- Model does **not** support an end frame:
  - refs attached → "Image-to-video from @ref1."
  - no refs, model requires one → "This model needs one reference image — add one to run."
  - no refs, model allows text-to-video → "No references — text-to-video."
- Model **does** support first + last frame (Dreamina Seedance 2.0, Wan 2.7):
  - 0 refs → "Add 1 reference to animate from it, or 2 to set a start and end frame."
  - 1 ref → "Starts on @ref1. Add a second reference to set the end frame."
  - 2+ refs → "Starts on @ref1, ends on @ref2." with a small **Swap** link that reverses the first two references so users control which is which.

That is the whole interaction: order in the reference dock decides first vs last, and one Swap control makes it explicit.

## Behaviour

- First frame = first attached reference; last frame = second attached reference, only when the model supports an end frame.
- Existing block on Generate stays for models that require a source image and have no references.
- Compare mode follows the same derivation per side.

## Technical notes

- `frank-create/src/components/FrameSlots.tsx`: delete.
- `frank-create/src/components/StudioRail.tsx`: remove the FrameSlots render, its props (`videoFirstFrame`, `videoLastFrame`, `armedFrameSlot`, `onArmFrameSlot`, `onClearFrameSlot`, `onDropFrameAsset`) and the frame-related inline error; keep the aspect preview section.
- `frank-create/src/App.tsx`: drop `videoFirstFrameId` / `videoLastFrameId` / `armedFrameSlot` state, `assignFrameSlot`, the armed-slot branch in the asset click handler, and the `canUseLastFrame` asset-card action. Derive `sourceAsset = referenceAssets[0]` and `lastFrameAsset = model.supports_last_frame ? referenceAssets[1] : undefined` in `handleVideoGenerate` and in the compare path. Add the inline note + Swap (reorders the first two reference assets) next to the existing reference-tag row. Keep `@first`/`@last` mention options mapped to the derived assets.
- `frank-create/src/styles.css`: remove frame-slot styles; add the note/Swap styling.
- No backend change: `source_asset_id` and `last_frame_asset_id` are still sent the same way, so `frank-api` stays as is.
