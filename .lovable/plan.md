Merge the sidebar footer into the main nav so it reads as one continuous menu, and turn Sessions into an expandable nav item that lists previous sessions inline.

## Sidebar structure (frank-create/src/App.tsx)

Remove `<div className="sidebar-footer">` entirely. Move its logic into the existing `<nav className="sidebar-nav">` as new nav items placed under a final "Account" section:

1. New "Sessions" section in the nav (near the top, above "Create" or below "Configure" — place under Configure to keep primary actions on top):
   - A `sidebar-nav-button` labeled "Sessions" with a chevron icon that toggles a new local state `sessionsOpen`.
   - When open, render an indented list of `sessions` as `<button className="sidebar-nav-sub">` rows; the active session gets `.active`. Click switches session via `selectSession`.
   - Below the list: two compact sub-rows using the same styling — "Rename current" (only if activeSession) and "New session". These reuse the existing rename prompt and `handleNewSession`.
   - Drop the `<select>`, the `sidebar-session-stats` line, and the "Main demo" button (or keep "Main demo" only when `showMainDemoAction` — as a sub-row).

2. New "Account" section at the bottom of the same nav:
   - A non-interactive row showing the email (small, muted) — reuse existing `sidebar-account-info` markup but styled to sit inside the nav flow.
   - A `sidebar-nav-button` "Sign out" that calls `handleSignOut`.

Result: `<aside>` contains only brand block + one `<nav>`. No footer div, no card, no divider.

## Styles (frank-create/src/styles.css)

- Delete rules for `.sidebar-footer`, `.sidebar-session-card`, `.sidebar-session-stats`, `.sidebar-account`, `.sidebar-account-info`, `.sidebar-account-label`, `.sidebar-account-email`, `.sidebar-signout`, `.session-picker`, `.sidebar-new-session` — anything that was drawing the separate bottom block.
- Add `.sidebar-nav-sub`: same font/tracking as `.sidebar-nav-button` but with `padding-left: 32px`, slightly smaller font (12px), used for expanded session list rows and inline actions.
- Add `.sidebar-nav-button .chevron` rotation state for the expanded Sessions item.
- Ensure the `<nav>` scrolls if it overflows (`overflow-y: auto`) so the merged menu still fits on short viewports.

## Verification

- Sidebar shows a single uninterrupted menu — Create / Review / Configure / Sessions (expandable) / Account — with no card or divider between sections.
- Clicking Sessions expands to show all prior sessions; clicking one switches; Rename + New session appear as sub-rows.
- Sign out sits as the last nav item and still signs the user out.
- Build passes; no leftover references to removed classes.
