# AGENT PROMPT — frank body app kit

Paste everything below the line into your agent (Lovable, Claude Code, Cursor, etc.) at the start of any new frank body webapp, with this kit's files in the repo.

---

You are building an internal frank body webapp. This repo contains the **frank body design kit** — it is binding, not a suggestion:

1. **`design.md`** — the full design system: colours, typography, logo rules, layout, components, responsive rules, interactive states, voice. Read it completely before writing any UI. Every colour, font, spacing, radius, shadow, and label style you use must come from it. Do not invent tokens, do not substitute fonts, do not use Tailwind default colours for UI surfaces or status pills.

2. **`fonts/`** (with `fonts/fonts.css`) — the licensed brand fonts, self-hosted: Pitch Semibold (headings, numbers, IDs, wordmark) and Founders Grotesk Text (body/UI). Serve these files with the app and load them via `fonts/fonts.css` (or replicate its `@font-face` rules in your global stylesheet). **Never** load Google Fonts or use stand-ins like Montserrat, Inter, Roboto, or Courier Prime.

3. **`frankhub-starter.html`** — a working reference shell. Treat it as the source of truth for markup structure and CSS values: the invariant 256px sidebar, the logo zone (wordmark capsules filling the width, tagline beneath), nav sections with the inverted active row, the blush page background with white cards, buttons, pills, inputs, and the responsive behaviour (64px icon rail on tablet, 64px top bar on phone). Port these patterns into your framework (React/Vue/whatever); don't redesign them.

Non-negotiables (details in design.md):
- Page bg `#FFEFEA`, surfaces white, all text `#3F2A2D`. Never white-on-white, never pure black, no red anywhere — critical/error states are ink.
- The left sidebar is identical on every page; only the active row changes. Auth screens are the only pages without it.
- Headings: Pitch Semibold, uppercase with `letter-spacing:.2em` (or sentence case). Body: Founders Grotesk Light, sentence case only. Numbers/money/IDs always Pitch.
- Pick ONE module accent from the concern palette in design.md §2 and set it as `--accent`; use it for icon discs, focus borders, progress fills, kanban headers. Accents are backgrounds/badges, never text colour. Set the app's tagline under the logo.
- Copy is in frank's voice: cheeky, direct, second person, lowercase "frank body", full stops on headings, NO exclamation marks, no corporate labels ("HEY BABE." not "Welcome"). Icons are lucide, never emoji.
- Spacing on the 4px scale; cards `border-radius:12px`; buttons/inputs 8px; pills full. Every control needs hover, focus (`2px #FFB6A5` outline), disabled (40% opacity), and error states.

Workflow: read `design.md`, wire up `fonts/`, port the starter shell, then build the requested screens by following the pattern recipes in design.md §5–§6 and §11. When in doubt, match the starter file, not your instincts.

The kit's other frank apps follow this same system — consistency across apps matters more than local creativity.
