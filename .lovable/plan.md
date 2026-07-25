## Goal
Make the left sidebar look complete and brand-consistent again, especially the lower session/account area shown in your screenshot, and verify it visually before handing it back.

## What I’ll fix

1. **Stop the sidebar footer from overlapping.**
   - Rework the sidebar as a proper vertical shell: logo, grouped nav, then session/account controls at the bottom.
   - Prevent the session name, stats, admin link, rename button, and sign-out area from colliding.
   - Keep the sidebar at the frank kit’s 256px desktop width.

2. **Make the bottom controls match the top nav.**
   - Style `Session`, `Rename`, `New session`, `Admin portal`, and `Sign out` as the same clean left-menu row system.
   - Use frank kit tokens: white sidebar, ink text, blush hover, ink active state, 8px nav radius, Pitch/Founders typography.
   - Remove the current cramped/stacked treatment that makes it look broken.

3. **Improve information hierarchy.**
   - Move the session stats into a compact muted line that cannot overlap controls.
   - Make the active session selector readable and truncated safely.
   - Keep the signed-in email visible but clipped/truncated professionally.

4. **Clean up responsive behavior.**
   - At the current preview width, ensure the sidebar remains visible and the main canvas starts after it.
   - On narrower tablet/mobile rules, avoid leaking desktop-only session footer styles into the icon rail.

5. **Verify before returning it.**
   - Run a local browser check at the current-style viewport.
   - Capture screenshots of the fixed sidebar/studio view.
   - Confirm there is no right-side empty gutter and no sidebar text/control overlap.

## Files expected to change

- `frank-create/src/styles.css` — primary layout/style fix.
- `frank-create/src/App.tsx` — only if markup needs a small class/structure adjustment to support the clean sidebar layout.

## Done when

The sidebar reads as one cohesive frank left menu: top nav and bottom session/account controls align, nothing overlaps, the selected session is legible, and the main canvas fills the remaining space without the old right-side blank column.