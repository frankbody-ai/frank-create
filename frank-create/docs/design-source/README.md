# Design source

The authority for the app's appearance. Diff against these, not against memory.

| File | What it is |
|---|---|
| `design-studio-os.dc.html` | Every screen of this app rebuilt on AutoSolutions OS. Component, prop and geometry for each surface. The target. |
| `design-system.readme.md` | The system itself — tokens, components, content rules, accessibility contract. |
| `screen-map.md` | Which repo source each screen was built from. |

The system's runtime lives in `src/ds/` (tokens, 34 components, 154 icons) and its
art in `public/{fonts,brand}/`. Deliberate deviations from the shipped source carry
a `PORT:` comment at the site of the change.
