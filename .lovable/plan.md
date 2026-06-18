## Goal
Add a "+" affordance to the Prompt Presets library so a new preset can be created in one click, without leaving the page.

## Where it goes
`frank-create/src/App.tsx`, the `preset-library-section` block (~line 3233) that renders `config.promptPresets` as `preset-library-card` buttons.

A new card-shaped tile labelled "+ New preset" is appended at the end of `preset-library-list`. Clicking it opens a tiny inline form (inside the same card slot) with two fields — **Label** and **Prompt** — plus Save / Cancel. Saving appends the preset to the library and selects it immediately.

User-added presets also get a small × on hover to remove them. Built-in presets (those from `config.promptPresets` loaded from backend / `fallbackConfig`) are not deletable.

## Persistence
Stored locally in `localStorage` under `frank.customPromptPresets` (array of `{ key, label, prompt }`). On mount we read them and merge into `config.promptPresets`. No backend changes — keeps scope tight and works offline.

Key generation: slugify label + short random suffix to avoid collisions.

## Changes
1. **`frank-create/src/App.tsx`**
   - Add `customPresets` state, hydrated from `localStorage` on mount, persisted on change.
   - Build `mergedPromptPresets = [...config.promptPresets, ...customPresets]` and use it in the two render sites (lines ~3240 and ~4171) and the lookups at lines 525, 628, 2262.
   - In the preset library list, append a "+ New preset" tile. When clicked, swap it for an inline `<form>` with Label + Prompt inputs and Save/Cancel.
   - On Save: push to `customPresets`, call `setSelectedPresetKey(newKey)`, set status text, collapse form.
   - For cards whose key exists in `customPresets`, render a small × button (stopPropagation) that removes it; if it was selected, fall back to the first preset.

2. **`frank-create/src/index.css`** (or wherever `.preset-library-card` lives — will locate during build)
   - Add `.preset-library-card.add-new` style (dashed border, centered "+ New preset" label).
   - Add `.preset-library-card .remove-btn` hover-visible style.
   - Style the inline new-preset form to match existing card metrics.

No schema, backend, or auth changes.

## Verification
- Click "+ New preset" → inline form appears in place of the tile.
- Enter label + prompt, Save → new card appears at end, becomes selected, prompt loads into the brief.
- Reload page → custom preset still present.
- Hover a custom preset → × appears, click removes it. Hover a built-in preset → no × shown.
