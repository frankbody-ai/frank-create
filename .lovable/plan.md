# Official company logos in the company dropdown

The company switcher's dropdown currently shows whatever logo image each company has stored in the backend. Those are the older marks. The attached design system ships the official company artwork, so the menu should use that instead.

## What changes

- Each row in the "Your companies" dropdown shows the official mark for that company, in the dark ("ink") version, which is the correct one for the white menu surface.
- Companies covered by the official set: al.ive body, Core iQ, enxgy, frank body, Ledgify, Senior Snouts, Strength Lab.
- Any company not in the official set keeps its current stored logo, and if it has none, its name is shown as today - so nothing goes blank.
- Row size, spacing, hover, tick mark and switching behaviour stay exactly as they are.
- The closed switcher in the top bar is left alone in this change.

## Technical notes

- In `src/os-chrome/os-chrome.tsx`, add a small map from company slug to the official ink mark, importing the images from `src/design-system/new-autosolutions-os-e87004/design-system/autosolutions/assets/companies/<slug>-ink.png` (read-only use, no design-system files edited).
- Match on the tenant's `slug`, falling back to a slugified `name`, using the existing `slugify` helper.
- In the dropdown's row rendering, prefer the mapped official mark; otherwise fall back to `logoPlainUrl ?? logoUrl` as now. Keep the existing `onError` name fallback.
- No CSS changes; `.osx-item__mark` sizing already fits the marks.
