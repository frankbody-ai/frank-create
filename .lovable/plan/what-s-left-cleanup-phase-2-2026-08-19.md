# What's left: cleanup phase 2

The heavy lifting is done (App.tsx 6,800 -> 3,748 lines, backend 2,829). Here is what is still carrying weight, verified by reading the current code.

## 1. Remove three dead screens

- **Review board** (`ReviewBoardPage.tsx`, 856 lines) — reachable only at `/review`, has no nav entry, and it renders the approve/reject board that was deleted from Studio. It is the single largest file after App.tsx.
- **Cliff access page** (`CliffAccessPage.tsx`, 419 lines) — a hardcoded QA checklist from the demo era ("Approve while offline surfaces ErrorToast"), reachable only at `/cliff-access`.
- **Health page** (`HealthPage.tsx`, 206 lines) — a diagnostics screen, deliberately not in the nav. Keep it if you still use `/health` to check the backend; otherwise it goes too.

Removing these also drops their routes from `nav.ts` and `main.tsx`, plus the `review` screen type and `sessionReviewBoardUrl` in `api.ts`.

## 2. Finish removing the approval system

Approval was pulled from the UI, but leftovers remain: `approval_status` still written on every new asset, `asset_approval_events` inserts, `/sessions/:id/approval-history` and `/sessions/:id/review-board` endpoints in the backend, an `approvedCount` prop on the shell, and approval fields in `types.ts` / `api.ts` / `App.tsx`. All of it becomes dead once the review board is gone.

## 3. Keep splitting App.tsx

3,748 lines is still one file doing too much. Next extractions, in order of payoff:
- The reference/tag system (paste listener, `@refN` tokens, autocomplete, reference adoption) into `src/studio/useReferences.ts`.
- Session management (list, select, rename, archive, reconcile assets) into `src/studio/useSessions.ts`.
- Generation orchestration (submit, parallel/serial runs, polling, watchdog, cancel) into `src/studio/useGeneration.ts`.

Each move is mechanical: state and handlers into a hook, App keeps the JSX.

## 4. CSS sweep

`app.css` accumulated rules alongside every deleted feature. Cross-check class names against the components that survive and delete the orphans.

## Verification

Typecheck, tests, production build, and an authenticated browser pass over Studio / Prompt generator / Upscaler / Admin portal after each step. A new "What's new" entry lands before publish.

## Suggested order

Steps 1 and 2 together (biggest deletion, lowest risk), then 4, then 3 one hook per pass so nothing regresses silently.
