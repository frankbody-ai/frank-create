repo: frankbody-ai/frank-create
branch: main
path: src

## Last sync

date: 2026-08-14T04:18:00Z

### Updated in this project

- Rebuilt Review board, Admin portal and Approved from their real source files after an audit found them written from memory.
- Added App health as its own screen (it is a separate route, not an Admin tab).
- Corrected statuses to the real model: `review` / `approved` / `rejected`, plus `sync_status` and `storage_missing`.
- Moved the app switcher to the top bar — the design-studio label fills the 224px nav plate on its own.

## Screen map

| Project screen | Read and built from |
|---|---|
| Design Studio - Current.dc.html (Studio) | `App.tsx` (shell L3600–4710), `styles.css` (L83–90, 7012–7690, 8155–8300), `styles/ds/*.css` |
| Design Studio - OS.dc.html → Studio | `App.tsx` L3690–4710, `components/StudioRail.tsx` |
| → Prompt generator | `components/PromptGenerator.tsx` |
| → Upscaler | `components/Enhancer.tsx`, `components/BeforeAfterSlider.tsx` |
| → Admin portal | `components/AdminPortal.tsx`, `components/admin/PromptAgentTab.tsx`, `lib/admin.ts` (`AdminUserRow`, `AppRole`), `lib/feedback.ts` (`FeedbackRow`, `FeedbackStatus`) |
| → App health | `components/HealthPage.tsx` (`runChecks`) |
| → Settings | `styles/ds/tenants.css`, `App.tsx` theme swatch block |

## Notes

- Routes come from `main.tsx`: `#/admin`, `#/admin/feedback`, `#/health`, `#/settings`, `#/.lovable/oauth/consent`. Anything else resolves to `NotFoundPage`.
- `AdminFeedbackPage.tsx` (`#/admin/feedback`) is a flat-list duplicate of the Admin portal's Feedback tasks board; the redesign keeps only the board.
- The repo carries a local `styles/ds/` token set (Google Sans + Roboto, magenta brand, glass surfaces). The redesign replaces it with the bound AutoSolutions OS tokens (Inter 450/550/600/650, achromatic ink theme).

## Sync history

- 2026-08-14T03:52:00Z — first import. Recreated the current Studio screen and built all seven surfaces on the AutoSolutions OS design system. Review board, Admin and Approved were written without reading their sources and were rebuilt in the next sync.
- 2026-08-20T00:00:00Z — removed the Presets, Approved and Review board rows and the handoff manifest contract. Those screens and the export handoff were deleted in the August 19 cleanup; this file still pointed at them.
