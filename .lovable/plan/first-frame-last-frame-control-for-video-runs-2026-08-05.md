# First frame + last frame control for video runs

## Which models actually support it

Schemas pulled live from Replicate this turn:

| Studio model | First frame field | Last frame field | Supported? |
| --- | --- | --- | --- |
| Dreamina Seedance 2.0 | `image` | `last_frame_image` (needs first frame) | Yes |
| Wan 2.7 (image-to-video) | `first_frame` | `last_frame` (needs first frame) | Yes |
| Grok Imagine Video | `image` | — | No |
| Grok Imagine Video 1.5 | `image` (required) | — | No |
| Happy Horse 1.0 | `image` | — | No |
| Minimax Hailuo 2.3 | `first_frame_image` | — | No |

So the feature lights up for Seedance 2.0 and Wan 2.7 only; the other four keep a single source frame.

## What changes in the UI

Today the video path guesses frames: it grabs the first non-video reference (or the newest thumbnail) as the source and silently uses a second reference as the last frame. That becomes explicit.

In the Studio rail, when the media tab is Video and the selected model supports it, a **Frames** block appears:

```text
┌──────────────────────────────┐
│ Frames                       │
│ ┌────────┐  ┌────────┐       │
│ │ first  │  │ last   │       │
│ │ frame  │  │ frame  │       │
│ │  [x]   │  │  [+]   │       │
│ └────────┘  └────────┘       │
│ optional — last needs first  │
└──────────────────────────────┘
```

- Each slot is a thumbnail well with an X to clear. Empty slots show "pick a frame".
- Filling a slot: click it to arm it, then click any image in the thread or the reference dock; drag-and-drop onto a slot also works (same drag source already used by the dock).
- Last frame stays disabled until a first frame is set, matching both schemas.
- Models without last-frame support show a single **Source frame** slot (same component, second slot hidden), so behaviour there is unchanged apart from now being explicit.
- Any image asset card gains a small "Use as first frame / last frame" action next to the existing "Use as video source".
- The video run's frames are shown in the run card metadata ("first + last frame").

The old implicit rules are removed: no more auto-picking the newest still, and no more treating reference #2 as the last frame. If a model requires a source frame and the slot is empty, Generate stays blocked with the existing inline warning.

## Technical notes

- `frank-create/src/lib/presets.ts` / `types.ts`: add `supports_last_frame?: boolean` to the model type, true for `dreamina-seedance-2` and `wan-2-7-i2v`.
- `frank-create/src/App.tsx`: replace the implicit source pick in `handleVideoGenerate` with new `videoFirstFrameId` / `videoLastFrameId` state; send `source_asset_id` (first) and a new `last_frame_asset_id`. Clear both after a run in line with the existing reference-dock clearing. Add the frame-slot arming state and the asset-card actions.
- New `frank-create/src/components/FrameSlots.tsx` for the two thumbnail wells, rendered by `StudioRail.tsx`.
- `frank-create/src/lib/api.ts`: add `last_frame_asset_id` to the `/videos` request type.
- `supabase/functions/frank-api/index.ts`: read `body.last_frame_asset_id` explicitly instead of `sourceUrls[1]`; pass it to `buildVideoInput` only for Seedance (`last_frame_image`) and Wan 2.7 (`last_frame`), and drop it when no first frame is present. Redeploy `frank-api`.
- `frank-create/src/styles.css`: styles for the frames block and slots, on-brand blush/ink.
