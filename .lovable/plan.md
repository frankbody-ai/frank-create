
## Goal

Bring the frank-create web app fully in line with the FrankHub kit (`brand guidelines/frankhub-kit/`): brand fonts, colour tokens, sidebar shell, component styles, and frank's voice. No feature changes — only presentation and copy.

**Module accent for this app:** `The Art Dept.` = Anti-Ageing lilac from design.md §2 → `--accent:#A0ACFF`, `--accent-soft:#BECCFF`. Used for icon discs, focus borders on inputs, progress fills, kanban headers, glow blobs. Ink `#3F2A2D` remains for primary actions; pink `#FFB6A5` stays for keyboard focus outlines per §6.16.

## Scope (files touched)

### 1. Fonts — self-host, drop Google Fonts
- Copy `brand guidelines/frankhub-kit/fonts/*` → `frank-create/public/fonts/` (woff2/woff/otf + `fonts.css`).
- `frank-create/index.html`: replace the Courier Prime / Inter / Montserrat `<link>` block with `<link rel="stylesheet" href="/fonts/fonts.css">`. Update `<title>` to `frank create.` and add meta description in frank voice.

### 2. Design tokens — `frank-create/src/styles.css`
Replace the current token block at the top of the file with the frank system:
```
--frank-pink:#FFB6A5; --frank-ink:#3F2A2D; --frank-blush:#FFEFEA;
--frank-pink-soft:#FFD0C6; --frank-ink-40:rgba(63,42,45,.4);
--accent:#A0ACFF; --accent-soft:#BECCFF;
--font-display:"Pitch","Courier New",ui-monospace,monospace;
--font-body:"Founders Grotesk",ui-sans-serif,system-ui,sans-serif;
```
Sweep the stylesheet for legacy values and remap:
- Page bg → `--frank-blush`
- Surfaces → `#fff`
- All text → `--frank-ink` (kill any near-black `#0e0e0e`, `#111`, `#2A2A2A`)
- Any red/error tone → ink (design.md §6.16: critical is ink, never red)
- Radii → cards 12, buttons/inputs 8, pills full
- Shadows → ink-tinted per §6.15
- Scrollbar → §6.12 block
- Global `:focus-visible` → `2px solid #FFB6A5, offset 2px`
- Body font → Founders Grotesk 300; `h1,h2,h3` → Pitch 600 uppercase `.2em`
- Add `.num` monospace-Pitch utility for money/IDs

### 3. Sidebar shell — port `frankhub-starter.html` into `App.tsx`
The starter's `.shell / .sidebar / .logo-zone / .wordmark / .nav / .nav-section / .nav-item / .me / .main` markup and CSS is the source of truth. In `App.tsx`:
- Rewrite the left sidebar JSX so it matches the starter exactly: 256px white sidebar, 2px ink/10 right border, sticky full-height.
- **Logo zone**: `[frank][create]` wordmark capsules filling the sidebar width (Pitch 23px, 2px ink border, split radius), tagline underneath: `THE ART DEPT.` (9px, 600, `.24em` tracking, ink 35%).
- **Nav sections** with eyebrow labels: `Studio.`, `Library.`, `Admin.` grouping existing links (New session, Sessions list, Health, Review board, Admin portal, Admin feedback). Each item is a `.nav-item` with a lucide icon + uppercase label. Active row inverts to ink bg / white text with no strip indicators. Inactive hover → `rgba(255,208,198,.4)`.
- **"Logged in as" card** at the bottom (`.me` block: 32px `#FFD0C6` avatar with initials + email in Founders Grotesk 12/11px, sign-out button styled `.btn-2`).
- Kill the current `Feedback` sidebar section — the feedback widget already floats over the studio.

### 4. Mobile shell
- Tablet ≤1023: sidebar collapses to 64px icon rail (labels hidden, section headers hidden, active still inverts).
- Phone ≤767: rail replaced by 64px white top bar with mini `[frank][create]` wordmark + lucide `Menu`/`X`, opening a full-screen white nav panel. Main padding switches to `80px 16px 24px`.
Port the starter's `@media` blocks; adapt in `styles.css`.

### 5. Components — restyle in `styles.css`, mostly no JSX changes
- **Buttons**: `.btn` (ink fill / white / uppercase 13/.06em), `.btn-2` (white, ink/15 border), ghost icon, module CTA (accent fill, ink text), hero "Make Magic" (ink block, hover `-translate-y-1`). Map all existing button classes to these.
- **Cards**: `background:#fff; border:1px solid rgba(63,42,45,.08); radius:12; shadow:0 1px 2px rgba(63,42,45,.05); padding:24`. Hoverable tiles get 2px transparent border → ink on hover with hover-lift shadow.
- **Module tile**: glow blob top-right in `--accent` @ 15% blur, 48px `--accent` icon disc with white lucide, Pitch 20px uppercase title, `ArrowRight` slide on hover.
- **Inputs / textareas**: `#FFFBFA` bg, 1.5px ink/12 border, radius 8, Founders 400 14; focus border → `--accent`. Search inputs get lucide `Search` inside left.
- **Segmented control** for the inspector tabs (Review / Settings / Brand / Export) → white capsule, active ink fill / white text.
- **Pills / status chips**: replace all current status pills with the palette in design.md §2 (Approved `#ACFAEA`, Pending `#FFD0C6`, Warning `#FFACB8`, Overdue ink/white, Info `#82CCF7`, VIP `#BECCFF` + Star). Applies in timeline cards, admin kanban, review board, feedback triage.
- **Kanban** (admin feedback / triage): white/50% column bg, ink/8 border, radius 12, `border-top:4px` header in stage's accent secondary, Pitch uppercase stage names. Rename stages to frank voice (New → **Fresh in**, In progress → **In the works**, Done → **Locked down**).
- **AI insight card** (used for "Thinking mode" / generation status): ink bg, 8px pink left border, pulsing 48px rgba disc with `BrainCircuit` in pink.
- **Data tables** (sessions list, admin users, audit trail): sticky `#FFF6F3` header row, ink/40 uppercase 11px column labels, 32px `#FFD0C6` avatar circles, money/IDs in Pitch right-aligned.
- **Toasts / status banner / error toast**: ink-tinted shadows, white/ink surface, no red for errors.
- **Dropdowns, tooltips**: per §6.17.

### 6. Voice pass
Rewrite hard-coded UI strings across `App.tsx`, `AuthGate.tsx`, `components/*`. No feature/logic changes — copy only.
- `Welcome`/`Frank Body Image Studio` → **HEY BABE.** with sub "Make product magic. Fast."
- Primary generate CTA → **Make Magic.**
- Loading states → **Writing magic…** (prompts), **Painting…** (renders)
- Empty state → **Waiting for the brief.**
- Error toast → **Writer's block. Try again, babe.**
- Sidebar section labels: `Studio.`, `Library.`, `Admin.`
- Sign-out row: `Logged in as` (unchanged label pattern).
- Kill every `!` in visible copy. End headings and one-liners with `.`.
- Only `frank body` / `frank` — never `Frank Body`. Product names stay Title Case (Nano Banana 2, Reve 2.1, etc.).
- Replace any remaining emoji labels (prompt presets in `presets.ts`) with lucide icons: 🛒 → `ShoppingBag`, 📸 → `Camera`, 👤 → `User`, 🧴 → `Droplet`, 🏪 → `Store`.

### 7. AuthGate (only page without sidebar)
Restyle `AuthGate.tsx`:
- Blush page bg, centered white card 12-radius, `[frank][create]` wordmark at top, tagline `THE ART DEPT.` underneath.
- Google sign-in button in ink primary style; helper text "sign in with your frankbody.com account.".
- No red error tones — validation copy in ink.

### 8. Cleanup
- Remove `Courier Prime`, `Inter`, `Montserrat` from any inline styles / CSS. Grep sweep.
- Remove legacy hex values called out in §12 (`#F8E6E6`, `#2A2A2A`, `#6F4E37`, `#E8B4B4`) — they exist in the current styles.
- Update `brandTheme.test.ts` expectations to the new token values so the test suite stays green.
- Update `presets.ts` `voice` block: `appTitle:"frank create."`, `labTitle:"The Art Dept."`, `primaryAction:"Make Magic"`, `emptyState:"Waiting for the brief."`, `approved:"Locked down."`.

## Out of scope

- No new features, no route changes, no backend edits, no dependency changes (lucide-react is already installed).
- Product Shot Lab and Video Lab stay greyed out.
- The floating feedback widget keeps its current position (top-right of studio header) — only its visual style is updated to match.

## Verification

- Run the existing vitest suite (`brandTheme.test.ts`, `frankWorkflow.test.ts`, `api.test.ts`, `studio.test.ts`, `App.test.tsx`) and update `brandTheme.test.ts` to the new tokens.
- Playwright pass at desktop / tablet / mobile viewports: capture the studio page, sessions list, admin portal, admin feedback kanban, auth screen; verify sidebar / rail / topbar behaviour and that Pitch + Founders Grotesk load (no Google Fonts network requests).
- Manual sweep for any surviving `#000`, red hex codes, or `!` in visible strings.

## Technical notes

- The app is Vite (not TanStack Start); `public/fonts/` is served at `/fonts/*`, referenced by `index.html` and `fonts.css`.
- `styles.css` is 6.6k lines and `App.tsx` is 7k lines — edits are localized to the token block, sidebar JSX, component class definitions, and copy strings. I won't rewrite files wholesale.
- Keep all existing `data-tour-id`, `data-testid`, and route hooks intact so tests and the walkthrough still work.

Question if you want to steer before I start: happy with **lilac (`#A0ACFF` / `#BECCFF`)** as the Art Dept accent, or would you prefer a different one from design.md §2 (e.g. Caffeinated pink for a brand-level look)?
