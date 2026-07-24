## Goal

Kill the permanent right-hand column so the studio matches the standard frank app shell (left sidebar + single main canvas), and give the current visual pass a second, tighter run against `brand guidelines/frankhub-kit/design.md`.

## 1. Relocate the right panel

The right `aside.context-panel` in `src/App.tsx` (lines ~3515–4136) currently holds five sections:

- Review (selected asset inspector, approve/reject, siblings)
- Cliff Pack (handoff)
- Recent exports
- Brand Kit
- Prompt presets

Plan:

- Remove the always-visible `.context-panel` from the main grid. The studio becomes: left sidebar (256px) + main canvas only, matching Auth/Admin screens.
- Split its contents into two left-sidebar entries that open the existing drawer pattern (mirrors how "Advanced" already works via `advancedOpen`):
  - **Review** — opens automatically when an asset is selected in the thread; also reachable from a sidebar button. Contains the selected-asset inspector + Cliff Pack + Recent exports.
  - **Brand & presets** — sidebar button opens a drawer with Brand Kit + Prompt presets (including the "+ New preset" tile).
- Both drawers slide in as an overlay from the left edge (same treatment as Advanced), so the canvas stays uncluttered on all viewports. Close via ✕ or Esc.
- Auto-open Review when the user clicks an image in the thread; auto-close on session change.
- Delete the right-panel media query blocks in `styles.css` and the `studio-shell` grid column that reserved the right rail.

## 2. Brand pass on the current UI

Re-audit against the kit and fix what still reads half-baked:

- **Sidebar (256px)**: confirm white surface, ink text, wordmark logo top, "THE ART DEPT." tagline, active state = ink pill with white text, hover = blush-tint. Remove any leftover borders/shadows that don't match the kit.
- **Typography**: enforce Pitch for headings/eyebrows/data, Founders Grotesk for body. Sweep remaining `font-family` fallbacks and any Inter/Space Grotesk holdovers in `styles.css`.
- **Color tokens**: audit `styles.css` for stray hex/rgba that bypass `--frank-blush`, `--frank-ink`, `--frank-cream`, `--frank-lilac`. Replace them with tokens.
- **Buttons**: primary = ink fill / cream text / 999px radius; secondary = white / ink border; ghost = transparent / ink text. Normalize `.mini-button`, `.provider-check-button`, generate/stop buttons.
- **Cards & inputs**: 12px radius, `#FFFBFA` input background, ink 1px borders, subtle blush focus ring. Apply to composer, session list, thread cards, drawer sections.
- **Copy sweep (frank voice)**: second person, lowercase, no exclamation marks. Rewrite drawer titles, tour steps, toasts, and empty states that still read as generic SaaS.
- **Auth + Admin**: verify they already match the new tokens; tighten spacing/margins if needed.

## 3. Verification

- Playwright screenshots (1280×1800): Auth, empty studio, studio with Review drawer open, studio with Brand & presets drawer open.
- Confirm no right-side aside renders on any route.
- Grep for `context-panel` and legacy tokens to catch leftovers.

## Technical notes

- Reuse existing drawer plumbing (`advancedOpen`/`setAdvancedOpen` pattern) — add `reviewOpen` and `brandOpen` state, wire two new `sidebar-nav-button`s.
- `selectedAsset` selection handler flips `reviewOpen = true`.
- No backend changes. No route changes. No changes to generation logic, Replicate routing, references, or feedback.

```text
before:                          after:
┌──────┬──────────┬────────┐     ┌──────┬────────────────────┐
│ side │  canvas  │ right  │     │ side │      canvas        │
│ nav  │          │ panel  │     │ nav  │ (drawers overlay   │
│      │          │        │     │      │  from the left)    │
└──────┴──────────┴────────┘     └──────┴────────────────────┘
```
