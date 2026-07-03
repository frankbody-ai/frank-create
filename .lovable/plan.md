# Frank Create — Pre-Launch Blocker Remediation Plan

Address the 4 blockers + 3 majors from the test report. Scope is limited to the `frank-create/` SPA (React + Vite, not the TanStack shell) plus one small edge-function contract check. No changes to review-board data model, handoff schema, or brand-kit backend.

## 1. FC-001 — Add `/health` route

`frank-create/src/components/HealthPage.tsx` already exists and `main.tsx` already routes `/health` to it. Blocker is that the published build is stale / the router match isn't being hit on the deployed URL.

- Verify the current `main.tsx` route match logic runs on both `/health` and `/health/` (already strips trailing slash — confirm).
- Rebuild + republish `frank-create`. If Published still 404s, the hosting layer isn't serving the SPA index for unknown paths — add a `_redirects` / SPA fallback for the `frank-create/` build output.
- Extend `HealthPage` checks to include: `frank-generate` edge-fn ping (OPTIONS), storage bucket HEAD on `studio-images`, and AI-gateway reachability probe. Render green/red rows per Section 2.1.

## 2. FC-002 + FC-004 — Sign-out must clear session and reset UI

In `AuthGate.tsx` `signOut()`:
- Call `await supabase.auth.signOut({ scope: 'local' })`.
- Explicitly remove any `sb-*-auth-token` keys from `localStorage` (loop over keys with that prefix — don't hardcode the project ref).
- `window.location.replace('/')` to force full remount at the auth gate.

Also ensure the "Sign out" button in `App.tsx` left nav calls the same central handler (not an inline `supabase.auth.signOut()`).

## 3. FC-003 — Register `/review/:sessionId` route

`main.tsx` already has a `reviewMatch` regex routing to `ReviewBoardPage`. Same root cause as FC-001: SPA fallback missing on the published host, so deep links return "Not Found" from the static host before the SPA loads.

- Add SPA fallback (`_redirects` `/* /index.html 200` or equivalent) to the `frank-create/` build output.
- Wire the "Open review board" button in the right panel to `window.location.assign('/review/' + sessionId)` (currently only scrolls).

## 4. FC-005 — Generate button empty-prompt guard

In `App.tsx` `handleGenerate`:
- Compute `const canGenerate = prompt.trim().length > 0 && !isGenerating`.
- Add `disabled={!canGenerate}` on the Generate button.
- On disabled click via keyboard shortcut, surface a toast "Enter a prompt to generate."

## 5. FC-006 — Export Cliff Pack empty-state guard

In the handoff export button:
- Disable when `approvedAssets.length === 0 && refs.length === 0`.
- Tooltip / inline hint: "Approve at least one asset to export."

## 6. FC-007 — Approve/Reject silent failure

- Wrap the approve/reject RPC in try/catch; surface error via `ErrorToast`.
- Log the failing status code + body to console for debugging.
- Verify the RLS policy on `asset_approval_events` allows the current user's insert (server-side check only, no policy changes unless the log confirms a 403).

## 7. Deferred (out of scope for this pass)

- FC-008 (Lovable auth-bridge branding on Published URL) — hosting concern, needs product decision.
- FC-010 (anon key in bundle) — expected Supabase behavior; add a note to security memory instead.
- FC-011 (responsive collapse at ~915px) — track separately; needs design input on tablet layout.

## Verification

After changes:
1. `bun run build` in `frank-create/`, republish.
2. Playwright script: hit `/health`, `/review/test-id`, sign in → sign out → assert `sb-*` keys gone + on auth gate, empty-prompt Generate disabled, empty-approved Export disabled.
3. Re-run Section 16 smoke steps.
