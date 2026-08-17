# Round cards: hard-left images, narrow info column, remembered model

Three focused changes — layout of generated rounds, prompt text truncation, and which model the composer starts on.

## 1. Images left, info right, info capped at 20%

- The round card body becomes a two-column grid: images take all remaining width on the left, the info column sits on the far right and is fixed at 20% of the card width (with a sensible minimum so chips don't wrap into slivers).
- DOM order in the card changes so images come first and the info column second, matching the visual order for keyboard and screen-reader users.
- Applies to normal rounds, pending/generating rounds, and compare (side-by-side) rows.
- Below ~1000px the card stacks back to images on top, info underneath.

## 2. Prompt text: one point smaller, 4-sentence cap, click to expand

- Prompt text in the info column drops one step on the type ramp.
- The prompt is truncated to its first 4 sentences; if it was cut, a subtle "more" affordance shows and clicking the prompt expands it in place (clicking again collapses).
- Expansion is per round, so expanding one card doesn't affect others.

## 3. Model selector remembers the last used model

- The composer's model no longer hard-defaults to Nano Banana Pro. On load it uses the last model the user generated with, stored in this browser's run defaults.
- If that model is missing, unconfigured, or not valid for the current media kind, it falls back to the current default.
- The stored value updates whenever the user changes the model in the rail.

## Technical notes

- `frank-create/src/app.css`: replace the `.turn-card-body` flex rules with `grid-template-columns: minmax(0, 1fr) minmax(200px, 20%)`, drop the flex sizing on `.turn-visual` / `.turn-side`, add a `-webkit-line-clamp`-free sentence clamp via the new expand state, reduce `.turn-copy p` font size one step, and add the stacking media query.
- `frank-create/src/App.tsx`: swap the `turn-visual` / `turn-side` blocks so visual renders first in both the normal and pending card branches; add an `expandedPromptTurnIds` set plus a small `firstSentences(text, 4)` helper for the clamped prompt; change `preferredStudioModel` to accept a stored preferred id, seed state from `readRunDefaults().model_id`, and persist via `updateRunDefaults({ model_id })` on model change.
- No backend, edge function, or generation-logic changes.
