# AutoSolutions OS — Design System

The design system for **AutoSolutions OS**, a dense professional console for building and supervising automated workflows and agents, plus the editorial brand layer used on marketing surfaces.

It is built from a token specification the AutoSolutions team supplied: 453 measured CSS custom properties, a measured component inventory, and two annotated screenshots of the reference admin console the OS is modelled on. Everything here is implemented from those measurements — sizes, weights, shadow stacks and state colours are copied, not approximated.

## Sources this was built from

| Source | What it gave us |
|---|---|
| `NEW AutoSolutions OS` brief (pasted, in-chat) | The full token spec: neutral ramp, status matrices, type ramp, space/radius/shadow/motion scales, component measurements, shell geometry, interaction and accessibility rules, and the Layer B marketing spec |
| `uploads/Screenshot 2026-08-12 at 16.16.44.png` | Reference console home: metric strip, centred greeting + ask bar, task chips, setup cards |
| `uploads/Screenshot 2026-08-12 at 16.17.32.png` | Reference resource index: insights strip, saved views + search, 52px table rows, status badges, pagination |
| [rsms/inter](https://github.com/rsms/inter) @ `master` | Inter variable + Inter Display webfonts (SIL OFL 1.1), copied into `assets/fonts/` |
| [tailwindlabs/heroicons](https://github.com/tailwindlabs/heroicons) @ `master` | 20px and 16px solid icon sets (MIT), copied into `assets/icons/` — a substitution, see **Iconography** |

No codebase or Figma file was attached. If one exists, hand it over and this system should be re-derived from it — screenshots and a written spec are lossier than source.

## The two layers

**Layer A — the product (`components/`, most of `tokens/`).** The OS console. Inter, 13px base, warm-neutral greys, near-black `#303030` as the primary action colour, 12px container radius, 8px control radius, extremely dense, very low chroma. Everything is quiet so the operator's data is loud. Build apps, dashboards and internal tools from this layer.

**Layer B — marketing (`tokens/brand-marketing.css`, `ui_kits/marketing/`).** Editorial and high-contrast: hue-tinted near-blacks, Inter Display at 96px on a 1.0 line-height, fully-round pill buttons, one violet accent. Build landing pages and campaign surfaces from this layer.

They are deliberately different. Don't mix them in one view.

---

## Index

| Path | What's in it |
|---|---|
| `styles.css` | The single entry point consumers link. `@import` list only. |
| `tokens/` | `fonts.css` · `colors.css` · `typography.css` · `spacing.css` · `shape.css` · `elevation.css` · `motion.css` · `layout.css` · `brand-marketing.css` · `base.css` |
| `components/` | 34 React primitives in 9 groups, each with `.d.ts` props, a `.prompt.md`, a group stylesheet and a specimen card |
| `guidelines/` | 23 foundation specimen cards (Colors, Type, Spacing, Shape, Elevation, Motion, Brand) |
| `ui_kits/os_admin/` | The product recreation: 5 interactive screens + `README.md` |
| `ui_kits/marketing/` | The brand layer: home + pricing + `README.md` |
| `assets/logo.png` | The AutoSolutions OS lockup, 3456×768 (4.5:1), transparent ground |
| `assets/companies/` | Seven tenant company marks, tile + plain cuts, 1234×372 (3.32:1) |
| `assets/apps/` | Thirteen generated application labels, 1234×372 (3.32:1) |
| `assets/fonts/` | Inter variable (roman + italic), Inter Display 300/400/500/600 |
| `assets/icons/20`, `assets/icons/16` | 90 + 14 solid SVG icons |
| `SKILL.md` | Agent-Skills wrapper so this folder works as a Claude Code skill |

### Components

**brand** — `Logo` `CompanyMark` `AppMark`
**primitives** — `Text` `Box` `Stack` `Grid`
**actions** — `Button` `IconButton` `ButtonGroup`
**forms** — `TextField` `Select` `Checkbox` `RadioButton` `Switch`
**structure** — `Card` `Section` `Divider`
**feedback** — `Badge` `Banner` `Spinner` `Skeleton` `Tooltip`
**media** — `Icon` `Avatar` `Thumbnail`
**data** — `DataTable` `Pagination` `FilterBar`
**navigation** — `AppFrame` `TopBar` `SideNav` `PageHeader` `Tabs`
**overlays** — `Modal` `Popover` `ActionList`

Intentional additions beyond the source's measured inventory, and why:
- `AppFrame` — the spec describes the shell (top bar + 240px nav + rounded content region) as a fixed structure; wiring it once stops every screen re-deriving it.
- `Icon` — a wrapper for the SVG set so glyphs inherit token colour instead of being pasted inline.
- `FilterBar`, `Pagination` — named in the spec's resource-index description but not measured as standalone components; they exist so the index shape is one composition, not copy-paste.

---

## Content fundamentals

The voice is a direct consequence of the density. The product is talking to a professional who is mid-task; it never performs.

**Casing.** Sentence case everywhere — labels, buttons, headings, table headers, menu items, empty states. Never title case. Labels never end in a period; sentences always do.

**Buttons are a verb plus an object.** "Add workflow", "Export runs", "Reconnect ledger" — never "Add", never "Create New Workflow", never "Submit". If a button needs more than three words, the screen is doing too much.

**Destructive confirmations name the consequence** instead of asking "Are you sure":
> **Delete 3 workflows?** Run history is kept for 30 days, but the schedules and connections stop immediately. This can't be undone.

**Errors say what went wrong, then what to do, in that order**, and sit inline under the field they belong to — never in a banner when the error is field-scoped.
> "Enter a valid https:// URL" · "The ledger connector returned 401. Reconnect it to resume the schedule."

**Empty states** pair a one-line explanation with exactly one primary action. No illustrations of feelings, no exclamation marks.

**Numbers and dates.** Locale separators always (`12,480`), currency always fully qualified (`A$3,412`, not `$3,412`), tabular figures in every table column. Dates are relative under 7 days ("18 minutes ago", "Yesterday, 2:00 am"), absolute after.

**Person.** Address the operator as "you"; the product refers to itself by name ("AutoSolutions is assembling steps"), not as "we" and never as "I". Product surfaces do not use the first person plural — that's marketing's register.

**AI copy is literal.** Say what the agent will do and what it costs; never "magic", "supercharge" or "effortless". "Describe the outcome and AutoSolutions will assemble the steps."

**No emoji.** Not in the product, not in marketing, not in empty states. Status is carried by a badge and an icon, never by a glyph pun.

**Layer B (marketing) shifts register but not honesty.** Short declaratives, hard numbers, no adjective stacking: *"Work that runs itself." "Measured, not promised." "Pay for runs, not for seats."* Headlines are two or three words per line so they stack into a block; the lede does the explaining.

---

## Visual foundations

### Logo
One lockup: the robot mark plus `autosolutions|OS` wordmark with the parent group's `theunmarked` line beneath it, in magenta on a transparent ground (`assets/logo.png`, 3456×768, exactly 4.5:1). The group line is part of the artwork — never crop it off. The lockup is never redrawn, recoloured, stretched or re-cropped, and there is no inverse variant — the magenta holds on both the `#1A1A1A` top bar and white surfaces.

Three locked sizes, and only these three:

| Size | px | Where |
|---|---|---|
| `default` | 216 × 48 | The app shell, centred in a 240 × 56 slot — exactly the side-nav width and top-bar height, so 12px sits each side and 4px above and below |
| `compact` | 144 × 32 | Marketing nav, footers, dense headers |
| `large` | 288 × 64 | Marketing hero, covers, title slides |

Clear space is at least half the lockup height on every side. `<Logo slot />` renders the shell version; the numbers live in `tokens/logo.css` so changing the lock is one edit, not a search-and-replace.

### Company marks
AutoSolutions OS is a hub: the product is ours, the tenants inside it are not. Seven company brands ship in `assets/companies/` — al.ive body, Core iQ, enxgy, frank body, Ledgify, Senior Snouts and Strength Lab — each in two cuts at 1234×372 (3.32:1). The **plain** transparent cut is the product default and is what the top bar, the switcher and cards use; because five of the seven marks are dark artwork, a plain mark on a dark surface sits on a white plate. The **tile** cut carries the brand's own colour field and is reserved for places that want a self-contained badge. Heights are locked to three values in `tokens/company.css` (80×24, 106×32, 159×48); the mark sits top-right in the shell, where the tenant name would otherwise be typed, and doubles as the company switcher. frank body is the default tenant in every template.

These are other companies' trademarks held to their own guidelines: never stretch, recolour, re-crop, add effects to, or redraw one.

### App labels
The hub holds thirteen applications, each with a generated label in `assets/apps/` — **Marketing** (Revenue: ad management, shopify sales · Content & Social: content calendar, social simulator, frank's kitchen, shelf simulator, product/idea validator · Design: art-ificial design studio), **Operations** (label maker, ops hub), **Sales** (growth engine, e-commerce sales) and **Internal Comms** (smart comms hub).

Each label is drawn at 1234×372 — deliberately the same box as a company mark, so the app label in the nav plate and the tenant mark in the top bar read as a matched pair. All thirteen are set in Inter Display SemiBold ink at **one cap height across the whole set** (auto-fitted to the longest name), behind the magenta pipe lifted from the `autosolutions|OS` lockup — the device that ties the family together. Adding an app means generating a label the same way, never typing a name into the plate.

### Themes
Seven palettes ship in `tokens/themes.css`: **ink** (the default, achromatic), **marina**, **moon dust**, **sapphire ash morning**, **neptune**, **amethyst mint harmony** and **opaline**. A tenant picks one in Settings via `ThemePicker`, which writes `data-theme` on `<html>` and remembers it.

A theme re-points exactly four things: the accent family (primary actions, links, focus ring), the page canvas, the navigation tint, and the large `--theme-field` surface — plus `--brand-accent` on the marketing layer, so a tenant's colour carries onto Layer B too (the default `ink` theme leaves marketing on its violet accent). It never touches the neutral ramp or the status colours — success, critical, warning, caution, info and AI are constant across all seven so learned meaning survives a re-theme. Light accents (moon dust, neptune, amethyst, opaline) carry a dark `--theme-accent-on` and a darkened `--theme-accent-strong` for text and links, because white on them fails contrast.

### Colour
Roughly 90% of the interface comes from a 17-step neutral ramp (`#FFFFFF` → `#0A0A0A`). Chroma appears only to carry meaning: success, critical, warning, caution, info, highlight, AI. There is no decorative colour in the product — no brand blue in a header, no tinted card, no gradient background.

Three asymmetries give the system its character:
- Text sits at `#303030`, not black. Icons sit one step lighter at `#4A4A4A`.
- The page is `#F1F1F1` while cards are pure white — only ~6% apart, which is why the hairline ring inside `--shadow-100` is load-bearing.
- "Text on fill" is never pure white; it's a hue-tinted near-white (`#FAFFFB` on green, `#FFFAFB` on red).

Warning (amber `#FFB800`, "this will cause a problem") and caution (yellow `#FFE600`, "check this") are distinct and not interchangeable. Every interactive colour ships explicit `-hover`, `-active`, `-selected` and `-disabled` siblings — nothing is derived at runtime with `opacity` or `filter`.

### Type
Inter as a **variable** font at non-standard weights: **450** regular, **550** medium, **600** semibold, **650** bold. Using 400/500/600/700 will not match — the raised body weight plus the suppressed bold is why the UI reads evenly.

Base body is **13px/20px at 450**; the default card heading is **14px/20px at 600** — one step above body, not three. Hierarchy comes from weight and colour, not size. Tracking is `normal` at and below 18px; only 24px+ gets negative tracking. Marketing inverts this: 96px/96px, 70px/70px, line-height at or below font size on anything over 48px.

### Space and density
One 4px base unit, with a 1px sub-step and a 10px optical step. The density is the design: buttons 28px, badges 20px, fields 32px, nav items 32px, table rows 52px, top bar 56px, card padding and card gap both 16px, table cell padding 6px. Don't "breathe" this out — a 40px button in this system looks broken.

### Layout rules
Fixed geometry: 56px top bar (position sticky, above everything) whose first 240px is the logo slot, 240px side nav on `#EBEBEB` opening with a fixed 48px application-name plate, content region on `#F1F1F1` with a 12px top-left radius, page column capped at 1260px with 16px gutters, 16px between page sections. One-column reading views cap at 1000px; record views are a fluid main column plus a fixed 320px sidebar with a 16px gap, stacking below 768px. The `490px` breakpoint is where a phone can show a two-column form row.

### Backgrounds
The product has no background imagery, no pattern, no texture, no gradient — flat token surfaces only. The single gradient in the whole product is the 63.53%→100% white overlay inside the primary button. Marketing is the opposite: full-bleed dark photography with heavy vignetting, radial tints on the hero, and content sections on hue-tinted blacks with 96–128px vertical padding.

### Cards
White, 12px radius, 16px padding, `--shadow-100`, **no visible border** — the 1px `rgba(0,0,0,.06)` ring lives inside the shadow stack. Cards do not float: six stacked shadow layers with a combined opacity under 4%, reading as paper on a slightly darker desk. Nesting changes treatment: level 1 elevated, level 2 a flat `#F7F7F7` inset group at radius 8, level 3 a hairline-divided run. `padding="none"` lets tables and media bleed to the card edge.

### Corner radii
Two-radius rhythm: **8px for anything you click**, **12px for anything that contains things**. 20px for modals, 30px for pills and chips, `clamp(4px, round(25%, 2px), 8px)` for avatars so they stay optically consistent at every size, 9999px for marketing buttons.

### Borders, shadows, bevels
Hairlines are 1px `#E3E3E3` (`#EBEBEB` for secondary dividers). Focus is a fixed `2px solid #005BD3` outline at 1px offset, applied via `:focus-visible` only, never replacing hover. Secondary buttons and segmented controls carry `--shadow-bevel-100` — an inset edge with a light top line and dark bottom — so they read as physical keys; pressing swaps it for `--shadow-inset-200` so the control visibly depresses. Text inputs carry `--shadow-inset-100` at rest.

### Motion
Durations 0–500ms; the signature easing is `cubic-bezier(.19,.91,.38,1)` — aggressive start, long tail, which is what makes menus snap. 100–150ms for hover and colour, 200–250ms for popovers and dropdowns, 300–400ms for modals and sheets, 0.15s for marketing transitions. Everything animates opacity/transform/background only — no bounce, no spring, no scale-on-hover. All of it is wrapped in `prefers-reduced-motion`.

### Hover, press, selection
Hover moves one step along the ramp (`#FFFFFF` → `#F7F7F7`, `#E3E3E3` → `#D4D4D4`, transparent → `rgba(0,0,0,.05)`). Press moves a second step and adds the inset. Selection is a **separate persistent state** with its own tokens, not a darker hover — selected nav items also shift their label to weight 550, and nav icon colour never changes in any state. Disabled uses `bg-fill-disabled` + `text-disabled`, never opacity. Nothing scales, lifts or tilts on hover.

### Transparency and blur
In the product: transparency only as `rgba(0,0,0,.02–.11)` transparent fills, the `.71` modal backdrop, and the `rgba(255,255,255,.8)` overlay surface. Blur is used nowhere. In marketing: `backdrop-filter: blur(14px)` on the floating nav and `rgba(255,255,255,.06–.18)` overlay cards.

### Imagery
Product imagery is limited to record thumbnails (40×40 at radius 8) and setup-card illustration slots. Marketing imagery is cool, dark and cinematic — near-black with deep vignettes, no warm filters, no stock-photo grins. **This system ships no photography or illustration**; both kits mark image areas as explicit labelled slots so real assets can drop in.

### Loading
Skeletons at `bg-fill-secondary` with a slow shimmer wherever layout is predictable; the spinner is reserved for indeterminate waits under 3 seconds.

### Accessibility contract
Body `#303030` on white is ~12.6:1; secondary `#616161` is ~6.2:1. `#8A8A8A` icons land near 3.5:1 — never use `icon-secondary` for anything that carries meaning alone. Caution `#FFE600` requires its dark on-fill text (`#332E00`) and fails with white. Minimum target 28×28 with a 32px invisible hit area on desktop, 44×44 for touch. Focus order follows DOM order, modals trap focus and restore it, every icon-only control carries a label, and status is never colour alone — badges always carry text, validation always carries an icon plus a message.

---

## Iconography

**Set:** Heroicons solid, 20px and 16px, copied into `assets/icons/20` (90 glyphs) and `assets/icons/16` (14 glyphs). **This is a substitution** — the source spec describes the icon system (solid fill, stroke-less, drawn on a 20px grid with a 1px inset margin, two sizes only) but no icon binaries were provided. Heroicons matches that description closely and is MIT-licensed. If AutoSolutions has its own set, drop the SVGs into the same folders using the same names and nothing else changes.

**Rules.**
- Two sizes only: **20px** for the vast majority, **16px** inside buttons, badges, inputs and dense table contexts.
- Default colour `#4A4A4A` (`--color-icon`); secondary `#8A8A8A`; hover `#303030`; disabled `#CCCCCC`. Inside buttons and links icons inherit `currentColor` — the `Icon` component renders as a CSS mask, so a colour change on the parent is enough.
- Icons never carry meaning alone. Pair with text, or give the control a label.
- Nav icons never change colour on hover or selection; only the row background moves.
- No emoji, no unicode glyphs as icons (the one exception is the `⌘K` affordance in the top bar, which is a keyboard key, not an icon), and no inline hand-drawn SVG.

Usage: set `window.AS_ICON_BASE` to the page's relative path to `assets/icons`, then `<Icon source="bolt" />`.

---

## Using it

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
<script>window.AS_ICON_BASE = 'assets/icons';</script>
```

```jsx
const { AppFrame, TopBar, SideNav, PageHeader, Card, DataTable, Button } = window.AutoSolutionsOSDesignSystem_27c955;
```

Token architecture is three-tier and should stay that way: **primitives** (`--color-gray-*`, `--font-size-*`, `--space-*`) are never referenced by a component; **semantic aliases** (`--color-bg-surface`, `--color-text-secondary`, `--color-border-focus`) are the only layer components consume; **component tokens** live in each group's stylesheet. A dark theme is a matter of re-pointing tier 2 — invert the neutral ramp, lift status fills about two steps, drop shadows almost entirely and express elevation as surface lightness.

## Gaps and substitutions to close

1. **Logo is a raster PNG.** `assets/logo.png` is 3456×768 and carries the whole system; an SVG would be better for print and for very large marketing sizes. Sizes are locked to three (216×48, 144×32, 288×64) in `tokens/logo.css` — see the **Logo** section below.
2. **Display face is a stand-in.** The brief specifies a licensed grotesk for Layer B; Inter Display substitutes for it with ~−2% tracking at display sizes. Buy the licence or confirm the substitution.
3. **Icons are Heroicons**, not an AutoSolutions set — see above.
4. **No photography or illustration** anywhere; both kits carry labelled slots.
5. **All product content is invented.** Workspace names, people, workflow names and every number in the kits are fictional demo data.
