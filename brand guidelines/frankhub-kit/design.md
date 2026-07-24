# frank body — Digital Product Design System (design.md)

The single source of truth for building any frank body internal web app (FrankHub and every module or new app in the family). It merges:

1. **Official 2026 External Brand Guidelines** (colour, type, logo, voice, claims) — always wins on brand.
2. **frankHUB** (`autosolutionsai-didac/frank-create → DESIGN.md`) — the foundation reference for layout, components, and app patterns.
3. **Brand-supplied font files** — self-hosted in `fonts/` with `fonts/fonts.css`. Never use Google-font stand-ins (no Montserrat, Inter, or Courier Prime — those were placeholders in the old frankHUB mock and are retired).

---

## 1. Brand DNA — the three knobs

1. **Pink page + off-black ink.** Soft Original-Pink-tinted surfaces, `#3F2A2D` (Black 5C) ink. Cosmetics-counter calm broken by typewriter typography.
2. **PITCH SEMIBOLD** for everything that wants attention — headings, wordmark voice, numbers. **Founders Grotesk Text (Light)** handles everything else.
3. **Cheeky, second-person voice.** frank talks to "babes", never to "users". Module names get nicknames, never department labels. No exclamation marks — frank never shouts.

If a screen feels generic, one of these three knobs is off.

---

## 2. Colour tokens

### Masterbrand (from the brand guidelines — exact values)

| Token | Hex | Role |
|---|---|---|
| `frank-pink` (Original Pink, PMS 2337C) | `#FFB6A5` | Brand moments: hero bands, active states, badges, chart fills |
| `frank-ink` (Black 5C) | `#3F2A2D` | ALL text, primary buttons, logo, borders on emphasis |
| `frank-white` | `#FFFFFF` | Cards, sidebar, inputs, modal surfaces |

### Derived app-surface tints (digital-only, derived from Original Pink — not in the print guide)

Full-strength `#FFB6A5` is too loud for a whole page. Use these tints for large UI surfaces; they keep the exact brand hue:

| Token | Value | Role |
|---|---|---|
| `frank-blush` | `#FFEFEA` | **Page background** (the new `#F8E6E6`) |
| `frank-pink-soft` | `#FFD0C6` | Chip backgrounds, hovers, scrollbar track (= Caffeinated secondary from the guide) |
| `frank-ink-40` | `rgba(63,42,45,.4)` | Eyebrows, muted labels, dividers |

Rule: **page bg is `frank-blush`, surfaces are white, ink is `frank-ink`.** Never white-on-white; never pure `#000`.

### Module accents = concern-category palette

Each app/module in the hub owns ONE accent, taken from the official concern-category palette (never Tailwind defaults). Primary for fills/discs, Secondary for soft backgrounds.

| Concern colour | Primary | Secondary | Suggested module |
|---|---|---|---|
| Caffeinated | `#FFB6A5` | `#FFD0C6` | Hub home / brand-level screens |
| Acid: Acne + KP | `#69E9D2` | `#ACFAEA` | 3PL / Logistics |
| Barrier Repair | `#4FA6E1` | `#82CCF7` | Forecasting / Oracle |
| Firm + Restore | `#FFB2BC` | `#FFD1D5` | CRM |
| Anti-Ageing | `#A0ACFF` | `#BECCFF` | Designer / Art Dept |
| Tan, Firm + Glow | `#F4C3AB` | `#FFACB8` | Copywriter |
| Relax + Recharge | `#869AB7` | `#A3B2C8` | Legal / Admin |

Rules (straight from the guide): accents are for **backgrounds and badges, never type colour**. One accent per screen — pink (the brand) is always allowed alongside. Multi-module or brand-level screens use masterbrand colours only.

### Status palette

Rendered as pill chips: `rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide`.

| State | Style |
|---|---|
| Active / Healthy / Approved | `bg-[#ACFAEA] text-frank-ink` |
| Pending | `bg-[#FFD0C6] text-frank-ink` |
| Warning | `bg-[#FFACB8] text-frank-ink` |
| Critical / Overdue | `bg-frank-ink text-white` |
| Info / Shipped | `bg-[#82CCF7] text-frank-ink` |
| VIP | `bg-[#BECCFF] text-frank-ink` + filled `Star` 10px |

Status pills stay inside the brand palette — no green-100/red-100 Tailwind defaults.

---

## 3. Typography

### Files
Self-hosted in `fonts/` (copy the whole folder + `fonts/fonts.css` into every project — never link Google Fonts):

- `Pitch-Semibold.woff2/.woff` — the only Pitch weight. Headings only.
- `FoundersGrotesk-Light.woff2/.woff` — body default (300).
- `FoundersGroteskText-{Regular,Medium,Semibold,Bold}[Italic].otf` — UI weights 400–700.

```html
<link rel="stylesheet" href="fonts/fonts.css">
```

```css
--font-display: "Pitch", "Courier New", ui-monospace, monospace;
--font-body: "Founders Grotesk", ui-sans-serif, system-ui, sans-serif;
```

### Roles (from the brand guidelines)

- **Pitch Semibold** = all headings, digital and print. Uppercase, sentence case, or title case. **When uppercase, letter-spacing = 0.2em** ("tracking 200"). Pitch is also the "data voice": numbers, money, IDs (`TRK-9921`, `$120,000`), and the wordmark.
- **Founders Grotesk Text Light (300)** = body copy, bylines, badges. **Sentence case only — never uppercase or all-lowercase.** Use 400–600 for small UI (buttons, labels, table headers) where 300 is too faint on screen.
- First-person frank headlines take quotation marks: `“ I like you a latte. ”` Third-person headings take none. Headings and sentences **end with a full stop.**
- No hyphenation. No exclamation marks. Ever.

### Type scale

| Role | Recipe |
|---|---|
| Page hero ("HEY BABE.") | Pitch 600, 40–48px, uppercase, `letter-spacing:.2em`, `color:#3F2A2D` |
| Page H2 | Pitch 600, 30px, uppercase, `letter-spacing:.2em` |
| Card title | Pitch 600, 22–24px, uppercase, `letter-spacing:.15em` |
| Sub-header H3 | Pitch 600, 18px, sentence case |
| First-person quote heading | Pitch 600, sentence case, wrapped in “ ” |
| Nav item | Founders Grotesk 600, 13–14px, uppercase, `letter-spacing:.08em` |
| Eyebrow / micro-label | Founders Grotesk 600, 10–11px, uppercase, `letter-spacing:.14em`, `frank-ink-40` |
| Body | Founders Grotesk 300–400, 14–15px, sentence case |
| Helper / sub-text | Founders Grotesk 400, 12px, `frank-ink-40` |
| Money / numbers / IDs | Pitch 600, tabular feel comes free (typewriter) |

---

## 4. Logo & wordmark

- Use only the **approved, supplied logo**: black text, solid white fill, on a brand-palette background or approved imagery. Never recreate, recolour, warp, add effects, or abbreviate. Minimum 250px wide digital / 25mm print. Clear zone = height of the ‘f’ on all sides.
- Brand name in copy: always **frank body** (brand) or **frank** (persona), lowercase. Never Frank, Frank Body, frankbody, FRANK BODY.
- **In-app sub-brand marks** (no official logo asset in context): two side-by-side capsules, 2px `frank-ink` border, transparent fill, lowercase **Pitch** inside — `[frank][hub]`, `[frank][create]`. This is the frankHUB pattern re-set in Pitch; swap in the supplied logo file wherever it exists.

---

## 5. Layout system (frankHUB shell)

```
┌───────────────────────────────────────────────────────┐
│ Sidebar 256px (white)   │  Main (bg frank-blush)      │
│  ─ wordmark             │  max-width 1280, mx auto    │
│  ─ nav in sections      │  padding 16 / 32            │
│  ─ "Logged in as" card  │                             │
└───────────────────────────────────────────────────────┘
```

- Sidebar: white, `border-right: 2px rgba(63,42,45,.1)`, soft shadow. Nav grouped into labelled sections (Business / Creative / Agents) with eyebrow-style headers.
- **The sidebar is invariant.** It renders identically on every page of the app — same width (256px), same logo block, same nav items in the same order, same "Logged in as" card. The ONLY thing that changes between pages is which row is active. It never collapses, hides, or reorders on desktop; no page ships without it (auth screens are the single exception).
- **Logo zone**: the block at the top of the sidebar, `border-bottom: 2px rgba(63,42,45,.1)`, padding ~18px 16px. The wordmark capsules **fill the sidebar width** (16px side padding, the two capsules splitting the row 50/50), Pitch ~22–24px — big and snug, not floating in whitespace. Beneath it, centered: a one-line app tagline, 9–10px, 600, uppercase, `letter-spacing:.24em`, ink at 35% (e.g. "B2B GROWTH ENGINE"). Same treatment in the mobile top bar (smaller wordmark, vertically centered, no tagline).
- **Active nav item inverts the whole row**: `background:#3F2A2D; color:#fff`, no thin indicator strips. Inactive hover: `background:#FFD0C6`(40%).
- Mobile: fixed 64px white top bar, lucide `Menu`/`X`, full-screen white menu panel. Member-facing apps (Frank's Kitchen pattern) are one-column, thumb-reachable, ≥44px hit targets.

### Breakpoints & proportions

| Range | Shell | Main content |
|---|---|---|
| **Desktop ≥1024px** | Sidebar fixed **256px** (never fluid) | Rest of viewport; content capped at `max-width:1280px`, centered, padding 32px. At 1440px that's ~256 / 1184 ≈ 18% / 82%. |
| **Tablet 768–1023px** | Sidebar collapses to a **64px icon rail** (icons only, labels on hover/tap; active row still inverts to ink) | Fluid, padding 24px |
| **Mobile <768px** | Rail disappears → fixed **64px top bar** + full-screen menu panel | One column, padding 16–18px, bottom-of-screen primary actions |

Adaptation rules per pattern:
- **Card grids** (module tiles, KPIs, gallery): 3 → 2 → 1 columns (gallery 4 → 3 → 2). Grid `gap` stays 16–20px at every size.
- **Data tables**: below 768px, rows become stacked cards — avatar + name on top, labelled value pairs beneath, status pill top-right. Never horizontal-scroll a table on a phone.
- **Kanban**: below 1024px, columns keep `min-width:280px` and the board scrolls horizontally (the one sanctioned horizontal scroll).
- **Detail 2:1 grids / split views (inbox)**: stack to one column below 1024px; the list becomes the screen, the detail opens as its own screen (mobile) or a slide-over (tablet).
- **Forms**: two-column field grids collapse to one column below 768px; wizard stepper drops labels and keeps numbered discs.
- **Drawers/modals**: drawer is 420px wide on desktop, full-width sheet from the bottom on mobile; modals go near-full-width with 16px margins.
- Page header recipe: Pitch uppercase H2 + one Founders Grotesk sentence explaining what the module actually does + primary CTA on the right.

---

## 6. Components

**Radius scale:** cards/tiles 12px (`rounded-xl`), buttons/inputs 8px, pills full.

### 6.1 Card
`background:#fff; border:1px solid rgba(63,42,45,.08); border-radius:12px; box-shadow:0 1px 2px rgba(63,42,45,.05); padding:24px`
Hoverable tile: transparent 2px border → `border-color:#3F2A2D` + lifted shadow on hover, 300ms.

### 6.2 Dashboard module tile
1. Blurred accent-colour blob top-right, ~10% opacity.
2. Icon disc `48px round`, filled with the module's **primary accent**, white lucide icon 24px `strokeWidth 2.5`, ink stroke feel.
3. Title: Pitch 600 uppercase 22px.
4. One-sentence description, Founders Grotesk 300, `frank-ink` at 60%.
5. Footer CTA: 11px uppercase tracked label + `ArrowRight` that slides `translate-x` 4px on hover.

### 6.3 Buttons
- **Primary**: `background:#3F2A2D; color:#fff; padding:10px 16px; border-radius:8px`, Founders Grotesk 600 13px uppercase tracked, darkens on hover, `active:scale-95`.
- **Secondary**: white, `border:1px solid rgba(63,42,45,.15)`, ink text.
- **Ghost icon**: transparent, ink at 40%, hover → soft blush bg.
- **Module CTA**: filled with module primary accent, **ink text** (accents never carry white type — most are too light).
- **Hero CTA ("Make Magic")**: big block, ink fill, white Pitch uppercase, `hover:-translate-y-1` + shadow.

### 6.4 Segmented control
White capsule `padding:4px; border-radius:8px; border:1px solid rgba(63,42,45,.1)`; active segment = ink fill, white text; inactive = ink 50%, hover blush.

### 6.5 Pills & chips
Tag chip: `background:#FFEFEA`, ink text, 9–10px, 600, uppercase tracked, radius 4px. Status pills per §2.

### 6.6 Inputs
`background:#FFFBFA` (or `#fff` on blush), `border:1.5px solid rgba(63,42,45,.12)`, radius 8px, Founders Grotesk 400 14px. Focus: border → module accent primary, no heavy ring. Search inputs carry a lucide `Search` 18px left inside. Textareas same, no resize handle.

### 6.7 Data table
- Header: `background:#FFF6F3`, sticky; cells 11px Founders Grotesk 600 uppercase `letter-spacing:.14em`, `frank-ink-40`.
- Rows: `border-bottom:1px solid rgba(63,42,45,.06)`, hover `#FFEFEA` at 50%.
- Avatar: 32px circle, `#FFD0C6` bg, ink initials, Founders Grotesk 600.
- Money/ID cells: **Pitch**, right-aligned.

### 6.8 Kanban
Column: `background:rgba(255,255,255,.5); border:1px solid rgba(63,42,45,.08); border-radius:12px; max-width:320px`; header has `border-top:4px` in the stage's accent secondary + Pitch uppercase 13px name + Pitch money total. Cards hover → accent border, `cursor:grab`. Stage names stay in voice: **Fresh Meat → Flirting → The Date → Going Steady → Locked Down.**

### 6.9 AI Insight card (hero black card)
`background:#3F2A2D; color:#fff; border-left:8px solid #FFB6A5; border-radius:12px; padding:24px`. Pulsing 48px `rgba(255,255,255,.1)` disc with `BrainCircuit` in `#FFB6A5`; label in Pitch uppercase `#FFB6A5`; body 17px Founders Grotesk 300. The pattern for any "the AI noticed something" moment.

### 6.10 Decorative glow
Absolute blurred circle top-right of input/result panels: module secondary colour, `opacity:.5; filter:blur(64px); pointer-events:none`.

### 6.11 Progress bar
Track `#FFEFEA`, fill = module primary accent, `height:10px; border-radius:full; transition:width 1s`. Pair with 4 evenly-spaced uppercase milestone labels (`Ordered • Port • Customs • Delivered`).

### 6.12 Scrollbar
```css
::-webkit-scrollbar { width:8px }
::-webkit-scrollbar-track { background:#FFEFEA }
::-webkit-scrollbar-thumb { background:#FFD0C6; border-radius:4px }
::-webkit-scrollbar-thumb:hover { background:#3F2A2D }
```

### 6.14 Spacing & sizing scale

Base unit **4px**. Legal steps: 4, 8, 12, 16, 20, 24, 32, 40. Defaults: card padding 24; gaps inside a card 12–16; grid gap 16–20; page padding 32 / 24 / 16 (desktop / tablet / phone); section spacing 20–24. Control heights: buttons 40, inputs 44, mobile primary buttons 48+. If a value isn't on the scale, round it onto it.

### 6.15 Borders, shadows, elevation

Borders: **1px `rgba(63,42,45,.08)`** card edges & row dividers · **1.5px `rgba(63,42,45,.12)`** inputs · **2px ink or ink/10** emphasis (logo capsules, sidebar divider, selected option, hover-border cards).

Shadows (never gray-black, always ink-tinted):
- Resting card: `0 1px 2px rgba(63,42,45,.05)`
- Hover lift: `0 8px 24px rgba(63,42,45,.12)`
- Overlay (drawer/modal): `0 16px 48px rgba(63,42,45,.25)`
- Toast: `0 8px 20px rgba(63,42,45,.25)`

Scrim behind overlays: `rgba(63,42,45,.35)`. Stack order: content → sticky table headers → sidebar → drawer/modal → toast.

### 6.16 Interactive states (every control has all four)

- **Hover**: per component (§6). Cheapest correct answer: darken fill or add blush bg.
- **Focus (keyboard)**: `outline: 2px solid #FFB6A5; outline-offset: 2px` on everything focusable. Never remove without replacing.
- **Disabled**: 40% opacity, no hover, `cursor: not-allowed`. Never change the label to gray manually.
- **Error / validation**: input border → `2px solid #3F2A2D` + a 12px Founders Grotesk 500 message under the field, in voice ("That email doesn't look right."). There is no red in this brand — critical is always ink.

### 6.17 Menus, tooltips, formatting

- **Dropdown menu**: white, radius 8, overlay shadow, 13px items, hover `#FFEFEA`, destructive item in ink 600. Trigger shows a Pitch `▾`.
- **Tooltip**: ink bg, white text, 11px, padding 6px 10px, radius 6, no arrow. One line only.
- **Dates**: Founders Grotesk. Relative within 7 days ("Today 9:41am", "Tue 4:02pm"), else "12 Mar 2026". Never ISO in UI.
- **Numbers / money / IDs**: always Pitch. Money with thousands separators (`$12,400`); compact only on KPI cards (`$86.2k`).

---

- **Library: lucide.** No emoji in UI, ever.
- Sizes 14/16/18/20/24 matched to surrounding type; stroke 2 (2.5 inside accent discs).
- On coloured backgrounds icons are **white with ink strokes** (brand icon rule). Never rotate, overlap, recolour, or change line weight of supplied brand icons (concern icons, Born in Australia, bunny ears, carrot heart, leaf) — those come from the brand team as assets, in circular lockups with text identifiers.
- Module identity picks: `Users` CRM · `TrendingUp` Oracle · `Ship` 3PL · `Palette` Art Dept · `Scale` Legal · `PenTool` Copy Desk · `Receipt` Expenses · `BrainCircuit` AI-thinking.

---

## 8. Motion

Subtle, fast, never showy.

| Where | What |
|---|---|
| View enter | fade-in, opacity 0→1 + 4px rise, 350ms ease-out |
| Hover arrow | `translate-x 4px` |
| Hero CTA hover | `-translate-y 4px` + shadow |
| Button press | `scale .95` |
| Loading | spin on `RefreshCw`; AI thinking = pulsing disc + skeleton bars |
| Image hover | scale 1.1 over 700ms inside `overflow:hidden` |
| Progress fill | width transition 1s |

---

## 9. Charts (recharts)

- Grid `3 3` dashed, horizontal only, `#F5E4DE`.
- Axes: no axis/tick lines; ticks 10px 600.
- Primary series `#3F2A2D`, strokeWidth 3. Forecast: dashed `5 5`, width 2.
- Filled areas `#FFEFEA` fill / `#FFB6A5` stroke; extra series use the module accent.
- Tooltip: white, radius 8, soft shadow, no border. Legend outside top-right as colour dots + labels.

---

## 10. Voice & copy

frank is **cheeky, humble, direct**. Written by women. He flirts, never sleazes; he's coy, not cocky.

**Hard rules (brand guidelines):**
- No exclamation marks. No hyperboles, clichés, or jargon ("detoxify, rejuvenate, clarify, purify" are banned — be specific: "removes sweat and excess sebum").
- Headings and sentences end with a full stop. Two short sentences beat one long one.
- **frank body** / **frank**, always lowercase. Product names in Title Case.
- First person = frank being cheeky, always in quotation marks, used to draw attention (heroes, headers, empty states). Third person = informative product/UI copy, straight and matter-of-fact.
- Claims: "range of vegan products" not "vegan brand"; "born in Australia" not "Australian-made"; "caffeinated" not "stimulating"; "helps reduce the appearance of" not "fades"; never cure/treat/heal.

**App vocabulary (frankHUB canon):**

| Don't say | Say |
|---|---|
| Welcome | **HEY BABE.** |
| Dashboard | **Hub Home** |
| Customers | **The Babes** |
| Pipeline | **The Big Fish** |
| Legal assistant | **Legal Eagle** |
| Copy generator | **The Copy Desk** |
| Designer / image gen | **The Art Dept.** |
| Forecast | **Oracle AI** |
| Logistics | **Where's the goods?** |
| Expenses | **Spend it.** |
| Generate | **Make Magic** |
| Add lead | **Add Babe** |
| Loading… | **Writing magic…** / **Reviewing clauses…** |
| Error state | **Writer's block. Try again, babe.** |

Subtitles do the explaining in one normal sentence: "Manage the babes (B2C) and the big fish (B2B)."

---

## 11. Page recipe — new module in 5 minutes

**Starter file: `frankhub-starter.html`** — a working shell (sidebar, logo zone, nav, header, cards, all tokens) that pairs with `fonts/`. Copy both plus this design.md into any new project; every value in it comes from this doc.

1. **Shell**: sidebar + blush main area (§5). Register the module in nav with a lucide icon under a section header.
2. **Header**: Pitch uppercase H2 in voice + one-sentence Founders Grotesk sub + CTA/segmented control right.
3. Optional **AI insight card** (§6.9).
4. **Content grid**: 1/2/3-col responsive, white rounded-xl cards on blush.
5. Pick the module's **one concern-palette accent** and use it for: icon disc, focus borders, progress fills, kanban headers, glow. Nothing else changes.

### Starter head (any stack)

```html
<link rel="stylesheet" href="fonts/fonts.css">
<style>
  :root{
    --frank-pink:#FFB6A5; --frank-ink:#3F2A2D; --frank-blush:#FFEFEA;
    --frank-pink-soft:#FFD0C6; --frank-ink-40:rgba(63,42,45,.4);
  }
  body{ margin:0; background:var(--frank-blush); color:var(--frank-ink);
        font-family:"Founders Grotesk",ui-sans-serif,system-ui,sans-serif; font-weight:300; }
  h1,h2,h3{ font-family:"Pitch","Courier New",ui-monospace,monospace; font-weight:600; }
  a{ color:var(--frank-ink); } a:hover{ color:#6b4a4f; }
</style>
```

Tailwind config equivalent: `frank.pink #FFB6A5 · frank.ink #3F2A2D · frank.blush #FFEFEA · frank.soft #FFD0C6`; `fontFamily.display ["Pitch"] · fontFamily.sans ["Founders Grotesk"]`.

---

## 12. Don'ts

- ❌ Montserrat / Inter / Courier Prime / any Google font — the brand fonts are supplied; ship them.
- ❌ `#F8E6E6` / `#2A2A2A` / `#6F4E37` / `#E8B4B4` — legacy mock values, replaced by §2.
- ❌ Accent colours as text colour, or two module accents on one screen.
- ❌ Exclamation marks, ALL-CAPS Founders Grotesk, uppercase Pitch without .2em tracking.
- ❌ White cards on white; pure black `#000`; emoji as labels.
- ❌ Neutral SaaS copy — if a label could appear in any app, it's wrong here.
- ❌ Recreating the logo or brand icons in code when an approved asset exists.
