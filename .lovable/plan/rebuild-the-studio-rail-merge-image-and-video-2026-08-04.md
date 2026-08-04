# Rebuild the Studio rail + merge image and video

Rename **Image Studio** to **Studio**, throw away the current cramped setup rail, and rebuild it as a proper settings panel modelled on the reference: model card on top, tile pickers for dimensions, chip row for count, extras at the bottom. Then merge image and video into one session so a generated image can be reused as the source frame for a video without leaving the view.

## 1. The new Studio rail

Replaces the current `studio-settings-rail`. Same position (second column, right of the main nav), full height, scrolls independently, styled in the frank blush/ink brand palette — structure copied from the reference, look stays on-brand.

Top to bottom:

```text
┌────────────────────────────┐
│ [icon] Model               │  large card, dropdown
│        Nano Banana Pro   ▾ │
├────────────────────────────┤
│ Preset            Clear all│  card rows, like reference "Styles"
│ [icon] Preset              │
│        Clean Ecom        ▾ │
├────────────────────────────┤
│ Duration (video only)      │
│ [ 5s ] [ 10s ]             │
├────────────────────────────┤
│ Image / Video Dimensions ? │
│ [2:3] [1:1] [16:9] [9:16]  │  ratio tiles, drawn to shape
│ [1024x1024] [2K] [4K]      │  size chips, filtered by ratio
├────────────────────────────┤
│ Number of generations ?    │
│ [1] [2] [3] [4] [ ▾ ]      │  chips; ▾ opens rest up to model max
├────────────────────────────┤
│ Reference behaviour        │
│ clear after generate  [on] │
├────────────────────────────┤
│ ⟲ Reset to defaults        │
└────────────────────────────┘
```

Rules kept from today: ratio and size options come only from the selected model's real schema, sizes filter by the chosen ratio, count caps at the model's `max_count`, preflight warnings and field errors still render in the rail, aspect preview stays.

The centre column keeps only prompt box, reference dock, Generate, Refine Prompt, Brief remix — unchanged.

## 2. Image + Video in one session

A media toggle sits at the top of the centre composer: **Image | Video**. It swaps the model list and the rail's controls (duration and video ratios appear, size chips become video resolutions), but keeps the same session, same prompt box, same timeline. `Video Lab` is retired as a separate nav entry.

Any image already in the timeline can be sent to a video generation with a **Use as video source** action on the image card. Nothing is auto-attached — you pick the frame explicitly, and the chosen frame shows as a thumbnail in the rail with a remove button.

## 3. Five Replicate video models

Wired the same way as the image models — each with its own real schema, not a shared guess:

- Kling v2.5 Turbo Pro
- Minimax Hailuo 02
- ByteDance Seedance 1 Pro
- Google Veo 3 Fast
- Wan 2.5 image-to-video

For each one I fetch the live schema from Replicate first, then encode exactly its allowed aspect ratios, resolutions, duration values, whether it needs a start image, and its per-request output count. The UI only ever offers what that model accepts, so no request can be built with an invalid field. Video outputs are downloaded and stored in the project's storage bucket like images (Replicate URLs expire), and appear in the timeline as playable cards with download, approve/reject, copy prompt, and delete.

## Technical notes

- `frank-create/src/lib/presets.ts`: add a `media` field (`image` / `video`) to the model type and add the five video model entries with `allowed_aspect_ratios`, `allowed_resolutions`, `allowed_durations`, `requires_source_image`, `max_count` from each Replicate schema. Mirror the same list in `supabase/functions/frank-api` so server-side validation matches.
- `frank-create/src/App.tsx`: rename the nav entry and `studioMode` value `image-studio` → `studio`; delete the `video-lab` mode and its sidebar row; add `mediaKind` state driving model filtering and rail contents; replace the rail JSX with the new tile/chip components; add `videoSourceAssetId` state plus the "Use as video source" action on asset cards.
- New small components for `RatioTiles`, `SizeChips`, `CountChips` so the rail stays readable.
- `frank-create/src/lib/api.ts` + `frank-api`: extend the video path to Replicate (create prediction → poll → persist to storage → insert asset with `media_type: "video"`), replacing the ComfyUI-only route. Polling budget up to ~10 minutes with backoff, cancellable by the existing Stop control. Provider errors (402 no credit, model errors) surface with the same detailed error panel as images.
- `frank-create/src/styles.css`: rewrite the `.studio-settings-rail` block for the new layout; grid stays `256px 320px minmax(0,1fr)` and collapses to stacked on narrow screens.
- The Replicate connector is already linked, so no new keys are needed.
