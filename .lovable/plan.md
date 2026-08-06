# Close the gap to the shipped design

The uploaded bundle is the real design source, not a screenshot. I unpacked it and read the actual token sheets and the actual shell markup, so this pass is measured against exact values instead of guesses.

## What the design source actually specifies

Shell:
- Page: full-height flex column on the tenant gradient (`#F9C0B9 → #FBD8CE 45% → #FDEFE4`) with the ambient field behind everything, `z-index:1` content layer.
- Top bar: 56px, `background: var(--surface)` (white), 1px `--muted-20` bottom hairline, 20px side padding, 18px gap. Logo block is 216px wide, pulled `margin-left:-20px`, centered, image `max-height:44px`. Center = search field (320x36) "Search sessions and picks". Right = two 32px circles + small secondary "Sign out".
- Rail: 216px, `background: var(--surface-rail)` = `rgba(48,48,48,0.10)` (translucent grey over the ambient — NOT white, NOT pink), 1px `--muted-20` right hairline, inner padding `16px 12px 14px`, 6px row gap, own scroll.
- Rail brand lockup: centered, `padding:14px 10px 0`, baseline row — "art-ificial" Google Sans 500 / 18px / 22px / -0.01em in `--ink` + "studio" 400 in `--muted`.
- Dividers: 1px solid `#000000`, bled full width (`margin: … -12px`).
- Section eyebrows exist and are Google Sans 500, 12px, `0.08em`, uppercase, colour `#000000`, padding `12px 10px 8px`.
- Nav rows: 34px tall, `border-radius:99px`, `padding:0 12px`, 10px gap, 14px Google Sans label, 14px icon slot. Hover `rgba(0,0,0,0.10)`. Active = filled `--rail-active` (ink) pill with the label/icon flipping to on-ink. No 8px boxes, no per-row borders, no `--pink` fill.
- Counts: pill on `--tenant-accent`, `--text-on-accent` text, Roboto 300, 12px, `padding:1px 6px`.
- Footer group: `margin-top:auto`, black hairline, "Workspace" eyebrow, then 12px rows with 8px `--series-*` dots (Settings, Admin portal) — same cluster treatment for the feedback row.
- Main pane: transparent, `padding:28px 32px`, 18px gap; H1 is Google Sans 43px/46px, weight `--weight-display`, `-0.02em`; the stat strip is one 99px-radius outlined group with 22px/26px tabular values over 10px uppercase labels.
- Studio grid: `minmax(0,1fr) 280px`, 14px gap; brief card `--surface`, radius 24px, `--shadow-card-glow`, 18px padding; the rounds/thread panel is the ink panel (`--surface-panel`) with radius 24px and on-dark dividers.

## What's wrong in the app today

The DS token files are already imported verbatim, so tokens aren't the problem — the shell CSS is. The rail and nav are still described by legacy rules (8px radius, `--line` borders, white button fills, `--pink` active state) plus roughly six later override blocks stacked on top of them. That layering is why every pass shifts the rail's look instead of landing it, and why it drifted white last round.

## The pass

1. Extract the design source once into `docs/design-source/` (the unpacked template markup + the eight DS token sheets) so future passes diff against it instead of my memory.
2. Delete the legacy shell rules rather than override them: pull `.nav-item` / `.nav-list` out of the shared button group, and remove the stacked `.guided-header.app-sidebar` override blocks that fight each other.
3. Write one authoritative shell block with the exact values above: top bar, rail surface/geometry, brand lockup, black dividers, eyebrows, 99px 34px rows with ink active state, accent count pills, footer cluster.
4. Apply the main-pane geometry: page padding, title role, outlined stat strip, `1fr 280px` studio grid, 24px card radii, ink rounds panel.
5. Verify in the browser at 1500px against the design source — rail width, row height, active pill, divider colour, title size — and screenshot before reporting done.

## Technical notes

- Rail surface must stay `var(--surface-rail)` (10% ink) so the ambient blob reads through; only the top bar is `--surface` white.
- Nav labels/eyebrows use `--font-display`; counts, timestamps and eyebrow meta use the label role (Roboto 300 + uppercase + tracking).
- No new tokens and no `!important`; anything not in the DS export gets expressed with existing tokens.
- No behaviour changes — this is CSS/markup geometry only.
