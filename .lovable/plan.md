# AutoSolutions OS re-skin — appearance only

Goal: apply the AutoSolutions OS visual language across the app with zero behaviour change. No new routes, no new rail rows, no data/state/model/generation edits, no copy changes, and every `aria-label` / `role` / `name` / `data-*` attribute preserved so the vitest suites keep passing.

## Files touched

Tokens and stylesheet
- `frank-create/src/styles/ds/typography.css` — confirm/lock the three family vars exactly as specified; no third face.
- `frank-create/src/styles/ds/fonts.css` — two `@font-face` blocks only (Google Sans `wght 400 700`, Roboto `wght 100 900`), both pointing at the already-bundled local `.ttf` files. Remove any Jura / Founders Grotesk face.
- `frank-create/src/styles/ds/colors.css` — add the paper ramp (`--paper-350/400/600/700`), the four `--muted-*` alphas, the three `--on-dark-*` alphas, and `--tenant-tint / --tenant-border / --tenant-blob`. Existing keys the test asserts (`--brand-magenta`, `--accent`, `--ink`, `--muted`, `--canvas`, `--surface`, `--series-1`) stay byte-identical.
- `frank-create/src/styles/ds/radius.css` — the seven radii verbatim.
- `frank-create/src/styles/ds/elevation.css` — `--shadow-card-glow:0 0 10px rgba(0,0,0,0.10)`; cards get no border.
- `frank-create/src/styles/ds/base.css` — body face/size defaults, `font-variant-numeric: tabular-nums` on metrics and count/timestamp classes.
- `frank-create/src/styles.css` — the bulk of the work: shell ambient field, top bar, left rail voices, main panel cards, stat cluster, brief card, ink Rounds panel, right-panel controls, overlays. Existing `@import "./styles/ds/*.css"` lines and the `var(--tenant-blob-bottom), var(--tenant-blob-top)` ramp string stay (asserted by tests).

Markup (class names and presentational wrappers only)
- `frank-create/src/App.tsx` — top bar layout (216px logo column / centre search / right cluster), shell wrapper for the base ramp, replace the current two-ellipse ambient SVG with the specified single-path blurred blob, left-rail structure (lockup as two live text spans, mono eyebrows, 34px pill nav rows, `margin-top:auto` footer with hairline), main-panel header + stat cluster + brief card + one ink Rounds panel with rounds/empty as internal sections.
- `frank-create/src/components/StudioRail.tsx` — restyle in place: mode segmented pill (wired to the existing three `mediaKind` values only), `MODEL` eyebrow + existing control, tenant-tint model note with badge pills, 3-column aspect tile grid, quality pills, brand toggle. The ratio glyph reuses/extends `components/AspectPreview.tsx` sizing logic rather than a new component; non-drawable options render a square.
- Inspector/settings markup inside `App.tsx` only — same treatment, no restructure.

Untouched: `src/lib/**`, `src/integrations/**`, `supabase/**`, `vite.config.ts`, `package.json` (fonts are already local files, so no dependency change at all).

## Ambient field

Three ingredients, per spec: base `linear-gradient(to top, …)` on the 100vh shell wrapper; one fixed full-viewport blob SVG (`viewBox 0 0 1280 832`, `xMidYMid slice`, `z-index:0`, transparent rect, one organic `#F9C0B9` path, `feGaussianBlur stdDeviation=250`, anchored lower-left ~1.05 scale); both rail and panel `background:transparent`, rail separated only by a 1px `border-right`.

Verification: render the app headless and sample pixels at mid-height — x≈100 (under rail) must be visibly deeper pink than x≈50% at the same y, with no colour step across the rail border; top-right ≈ `#FDEFE4`, bottom-left ≈ `#F9C0B9`. I'll report the sampled values.

## Notes / possible skips

- The left rail today carries a logo image lockup (`art-ificial` SVG) plus a second `frank body` logo image. §5 asks for the top lockup as two live text spans. I'll do that for the `art-ificial studio` lockup; the `frank body` tenant mark stays as an image (removing it would change what the rail communicates, and it has an `alt` string that is user-facing copy).
- Stat cluster cells keep their existing readable "N rounds" accessible name; the visual metric/label split is added inside without touching the name.
- Aspect options are read from the existing allowed-ratios source already used by `StudioRail`; nothing hardcoded.
- Anything in §6/§7 that would require a new control or a new mode is skipped — the mode switch binds only to `image` / `video` / `compare`, which already exist.
- Weight expectations: Google Sans clamps 300→400, so headings will read at 400; the light register appears only on Roboto copy and label roles. That is per spec, not a defect.

## Done when

- No diff under `src/lib/`, `src/integrations/`, `supabase/`; no dependency change.
- `npm test` passes unchanged (including `brandTheme.test.ts`'s token contract).
- Ambient sampling confirms rail-deeper-than-panel with a single hairline edge.
