# AutoSolutions OS — apply the real design system

The upload is the authoritative AutoSolutions OS design system export plus a full mock of this app (`Design Studio.dc.html`). The current skin was hand-approximated from the written brief, so tokens, fonts, logos and layout all drift from the real thing. This replaces the approximation with the shipped system.

## What changes

**1. Real tokens replace the hand-copied ones**
Drop in the eight token files verbatim (colors, typography, fonts, spacing, radius, elevation, motion, tenants) and delete the approximated `:root` block in `styles.css`. Key corrections this brings:
- Accent becomes neon magenta `#FE3CF6` with `--accent-glow #FF9CF4` (currently a pink/cream guess).
- Full 13-step paper scale, complete muted/ink alpha ramps, on-dark ramp, glass tokens, series 1–8 palette.
- `frank` tenant gets its real two-stop ambient ramp: `#F9C0B9` → `#FDEFE4` with `--tenant-accent #F9ABAA`.

**2. Real fonts**
Google Sans and Roboto variable fonts (roman + italic) become CDN assets and are wired through `@font-face`. Google Sans = interface voice (headings, buttons, tabs, nav, labels), Roboto = all reading copy at weight 300. No third face, no CDN fallback stack pretending to be them.

**3. Real logos**
- `autosolutions-os-md.png` in the top bar.
- `art-ificial-design-studio.svg` as the app wordmark in the left rail, replacing the current text lockup.
- `frank.svg` as the tenant mark.

**4. Shell layout matched to the mock**
The mock is the ground truth for this app specifically, so the shell is re-laid to match it:
- 56px white top bar: logo block, centred search field ("Search sessions and picks"), avatar/tenant chips, secondary "Sign out".
- Page background becomes the tenant ambient gradient with the organic blob riding over it (`base="transparent"`), replacing the current hand-drawn SVG blob.
- Left rail: app wordmark, "New session", nav (Workspace, Settings, Admin portal) on translucent rail glass with hairlines; `--muted` is illegal on the rail, so rows are `--ink` and eyebrows `--paper-700`.
- Centre column keeps its current Brief / Brief remix / Generate / rounds structure, re-skinned to the real card, radius and elevation tokens.
- Right column follows the mock's Review pane: pick preview, Approve/Reject, Provenance, Review notes, and the Compare / Use as ref / Upscale / Export action row.

**5. Accent discipline pass**
One accent moment per card. Accent is never a button, header or decoration — it marks the approved pick, the unread pip, the WRITE badge, the active spine. Buttons go back to ink/secondary tones.

## Not doing

The mock includes surfaces this app deliberately dropped — "Local Comfy / Open Comfy canvas" and "Paint mask / Masked edit". Those stay removed; I'll skin what exists rather than re-add retired features.

## Technical notes

- Token CSS and fonts are copied into the project (`src/styles/ds/`), fonts and logos uploaded via the assets CDN so no large binaries land in the repo.
- `styles.css` keeps its component layer; only the token layer is swapped, then high-specificity overrides added during the redesign are re-checked against the real values and removed where they were compensating for wrong tokens.
- `brandTheme.test.ts` is updated to assert the real token contract (magenta accent, Google Sans/Roboto stacks, tenant ramp).
- The DS ships an oxlint adherence config and a component bundle; those are reference only — no runtime dependency on `_ds_bundle.js`.
- Verification: full build plus a Playwright pass over Studio, Prompt Generator, Upscaler, Library and Admin portal to confirm no contrast or layout regressions.
