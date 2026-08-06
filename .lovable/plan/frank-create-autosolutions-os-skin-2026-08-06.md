# frank Create → AutoSolutions OS skin

Appearance only. No behaviour, data, routes, copy, props or schema changes.

## Decisions from your answers

- Fonts: you upload Google Sans + Roboto variable files; I self-host them as CDN assets (no CDN font links, no third face). Jura is removed from the app UI.
- Top bar (§4): skipped. There is no top bar or global search in the app today, and adding one would mean new UI and new behaviour. Sign out stays in the rail footer.
- Rail lockup (§5): you upload the artwork; I use it in the rail's top slot at the specified size, with the live `art-ificial` + `studio` text lockup as the fallback until the file lands.

## What changes

**Tokens and type** — replace the current blush/Jura token block in `styles.css` with the brief's token set: core colours, paper scale, translucent border tokens, on-dark tokens, frank body tenant tint, type sizes, weights, tracking, radii, and the single card glow shadow. `--font-display` / `--font-body` / `--font-mono` repoint to Google Sans / Roboto / Roboto (label register = weight 300 + uppercase + letterspacing, not a mono face). Tabular numerals wherever columns align. Hierarchy comes from size, never weight or colour.

**Ambient field** — the shell wrapper gets the base pink→cream ramp; a fixed full-viewport blurred SVG blob sits under everything at `z-index:0`, anchored lower-left. Rail and main panel both go fully transparent, separated only by a 1px hairline, so the rail reads deeper purely because the blob sits under it. No veils, no second gradients.

**Left rail** — 216px, transparent, scrolling, exactly three type voices: the lockup slot with divider, mono uppercase section eyebrows, and 34px pill nav rows (14px display label, 14px outline icons, hover grey pill, active solid ink pill with white label, no weight change). Footer pinned bottom with a hairline above and a `WORKSPACE` eyebrow. Nav rows are `flex-shrink:0` with `flex:1 0 auto` so they can't overdraw the footer.

**Main panel** — transparent, 36px gutters, opaque white 24px cards with the glow shadow and no borders. Page header = mono eyebrow over title over one muted line. The stat cluster becomes a joined pill group of metric-over-label cells (existing accessible names kept). The brief card gets the mono head row, borderless `--paper-50` textarea, and an action row with a solid-ink pill `Generate`. Rounds become sections inside one ink panel with 24px radius, divided by on-dark hairlines — black in both empty and filled states.

**Right panel / studio rail** — 280px, same white cards, everything visible with no disclosure. Segmented mode pill wired to the existing modes only; `MODEL` eyebrow + existing control; model note in the tenant tint box with mono badge pills; `ASPECT RATIO` as a 3-column tile grid whose glyphs are drawn from each tile's real ratio, read from the existing allowed-ratios source; `QUALITY` pills with a solid-ink active state.

**Overlays** — dialogs 18px radius with the dialog shadow and a 0.55 scrim, lightbox media on ink, menus on the menu shadow.

## Files touched

- `frank-create/src/styles.css` — the bulk of the work (tokens, field, rail, panels, cards, overlays, responsive).
- `frank-create/src/App.tsx` and the `components/` files — class names and wrapper elements only where the new structure needs them (blob layer, lockup spans, stat pill group, aspect tiles). No hooks, handlers, props, copy or attributes changed.
- `frank-create/src/assets/` — new font and lockup asset pointers.

Untouched: everything under `lib/`, `supabase/functions/`, auth, model rosters, and `package.json` dependencies.

## Verification

- Sample the rendered page at mid-height: pixel under the rail must be visibly deeper pink than panel centre, with no colour step at the rail border; top-right near `#FDEFE4`, bottom-left near `#F9C0B9`.
- Screenshot Studio, Prompt generator, Upscaler, Preset creator, Approved, Exports, Admin portal and Settings at desktop and narrow widths.
- Existing tests must pass unchanged; if one fails, the skin broke a contract and the skin gets fixed.

## Note

Upload the two variable font files and the `-md` lockup cut whenever you're ready — if they aren't in yet when I build, the skin ships with system fallbacks and the text lockup, and swapping in the real files afterwards is a token-level change.
