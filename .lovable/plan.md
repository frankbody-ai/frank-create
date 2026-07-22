## Goal
Remove the now-duplicate Model & output section from the right sidebar, since model selection + aspect/size/count already live in the center generator card.

## Change
- **`frank-create/src/App.tsx`** (lines 3233–3401): delete the entire right-sidebar `<section className="context-section model-summary inspector-model-strip">` block, including its "Change model" toggle button and the `modelSettingsExpanded` drawer (model list, aspect/size/count inputs, AspectPreview, thinking-mode row).
- Keep the `<aside className="context-panel">` wrapper and the Review section (3403+) intact.
- Leave `modelSettingsExpanded` state and `showModelSettings` handler in place for now (harmless; safer than a wider refactor). Can prune in a follow-up if desired.

## Out of scope
- No changes to the center composer or to `studio.ts` validation.
- No changes to the mobile/tour data-attributes flow — the center card already carries the settings.

## Verification
- Right sidebar shows only Review + downstream sections; no "Change model" button or model list on the right.
- Center generator still shows Model / Aspect / Size / Count / preview and generates normally.
