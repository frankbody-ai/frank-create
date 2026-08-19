# Upscaler rebuilt as a Studio-shaped screen

Drop the current two-card "Source grid + Output" preview layout entirely. The Upscaler becomes the same screen as Studio: a wide centre column of result cards, a simplified settings rail on the right, and — where Studio has the prompt box — a single empty drop tile.

## Layout

```text
┌ Upscaler ─────────────────────────────────┬ Rail ──────────┐
│ ┌───────────────────────────────────────┐ │ Mode Image|Video│
│ │  drop an image here, or browse        │ │ Model           │
│ │  (click → same picker as Studio)      │ │ model options   │
│ └───────────────────────────────────────┘ │ [ Upscale ]     │
│  newest result card on top                │                 │
│  older results below                      │                 │
└───────────────────────────────────────────┴─────────────────┘
```

## The drop tile (replaces the source grid)

- One empty tile at the top of the centre column: "Drop an image here, or click to browse".
- Clicking it opens the **same reference picker modal Studio uses** — the media grid of previous generations and uploads, newest first, with the upload tile — but in single-pick mode: choosing a tile picks it as the source and closes the modal.
- Drag-and-drop a file straight onto the tile, and clipboard paste, both work like Studio.
- Once a source is chosen the tile shows that thumbnail with a clear tick and a "Change" / "Remove" affordance, so it stays one tile rather than growing a grid.
- Video mode does the same with clips.

## Results, Studio-style

- Results render as Studio-style cards, newest on top: the media large and hard-left, a narrow info column with model, settings used, real resolution, elapsed time.
- Clicking a result opens the existing full-screen lightbox; before/after compare and Download stay on the card.
- While a run is going, the card shows the same generating treatment Studio uses (skeleton tile with shimmer + centre spinner, elapsed seconds, Stop), instead of a static status line.

## Simplified rail

The rail mirrors Studio's rail visually but only holds upscaler concerns: Image/Video mode toggle, model picker, that model's own options (Topaz enhance model / upscale factor / subject detection / output format / face enhancement + its two sliders; video target resolution / fps / scale factor), and the primary **Upscale** action with the circular action buttons Studio uses. No prompt, aspect, count or reference dock.

## The 502

The diagnostics you pasted are all green, so this is the intermittent backend gateway fault we've seen before, not a broken route. I'll pull the backend logs for that timestamp to confirm the origin, and make the Upscaler use the same retry-with-backoff path Studio's calls already use, so a 502 mid-run retries instead of surfacing as a failure. If the logs show a specific cause, I'll report it rather than only papering over it.

## Technical notes

- `frank-create/src/components/Enhancer.tsx`: remove the `Source` card and grid, add a `DropTile` (file input + `onDrop` + paste), take a new `onPickSource` prop that opens the shared picker; reuse Studio's `turn-card` / `output-skeleton` classes for results; move mode/model/options into a rail structured like `StudioRail`.
- `frank-create/src/App.tsx`: generalise the reference-picker state with a target (`"dock" | "upscaler"`) and a max-pick of 1 for the upscaler, so `confirmReferencePickerSelection` either fills the dock or returns the asset to the Upscaler; pass `onPickSource` and the download/expand handlers already wired.
- `frank-create/src/app.css`: delete `.source-tile*` / `.upscaler-columns` / `.upscaler-main` rules, add `.upscaler-drop` and reuse the existing studio card/rail classes.
- Backend: no schema or model changes; only wrap `createEnhancement` in the existing retry helper in `src/lib/api.ts`.
