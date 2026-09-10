# Use uploaded AutoSolutions icon as favicon

Replace the current `public/favicon.svg` with the uploaded `AutoSolutions-icon-2.svg` so the browser tab icon matches the new official mark.

## Steps

1. Copy `/mnt/user-uploads/AutoSolutions-icon-2.svg` to `public/favicon.svg`.
2. Verify `src/routes/__root.tsx` still links to `/favicon.svg` (no change expected).
3. Confirm no stale `public/favicon.ico` remains.

## Outcome

The app will serve the new magenta AutoSolutions icon at `/favicon.svg`, used by Chrome and other browsers for the tab icon.
