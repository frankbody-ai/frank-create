# Refactor: cut the dead weight, split the monolith

The app still carries a lot of early-stage machinery that nothing on screen uses. `App.tsx` is 6,834 lines and every page load fires extra backend calls for screens that no longer exist. This plan removes what's dead and breaks the monolith into focused files — with no visible change to Studio, Prompt generator, Upscaler, sessions, admin, feedback, themes or auth.

## 1. Remove the dead demo/readiness era

Confirmed unused by any visible screen, but still loaded and called:

- Demo doctor, readiness pack, demo evidence, call brief, provider readiness receipt, activation checklist, brand-context receipt.
- Provider env-key management (template/reload/save keys) — keys live in the backend now.
- Cliff guide steps/proofs, launch-readiness items, provider unlock plan / key-plan text / capability summary / provider audit summaries.
- Legacy Projects → Briefs → Runs → Exports chain (`listBriefs`, `createExport`, `listExports`, brief drafts, export presets/labels/metadata helpers).
- Workflow-provenance bridge helpers left from the ComfyUI era (`assetWorkflowBridge`, node-type readers, workflow summary/sanitiser).
- Orphan components: `ApprovedScreen.tsx`, `PresetCreator.tsx` (nothing imports them).
- Matching types in `types.ts` (all `Demo*`, `*ReceiptResult`, `ActivationChecklist`, `ProviderEnvStatus`, `ProviderAdapterAudit`, `Brief`, `Run`, `ExportRecord`, `FrankProvider`, `UploadedImage`) and the matching helpers in `api.ts`.

Removing the bootstrap calls above is the single biggest win for perceived speed: first paint currently waits on three requests that feed nothing.

## 2. Split App.tsx into real modules

Same behaviour, same markup — just moved out of one file:

```text
src/App.tsx                      shell + state orchestration only
src/studio/                      composer, run grid, output strip, asset media
src/studio/lightbox/             full-screen preview + inline edit
src/studio/references/           reference picker, @ref tagging, paste/drop
src/studio/MaskPainterDialog.tsx
src/studio/CompareDialog.tsx
src/lib/studioFormat.ts          label/aspect/cost/JSON-chip formatters
src/lib/modelMemory.ts           last-used model persistence
```

Pure helpers (formatters, label builders, model preference, settings-for-task) move first since they carry no state; then the presentational pieces; then the remaining stateful blocks. Each move is verified by build + tests before the next.

## 3. Remove the walkthrough

The guided walkthrough goes: overlay component, step definitions, anchor measuring, and every trigger and state flag tied to it (~95 references).


## 4. Performance pass on what remains

- Cut redundant bootstrap round-trips; load sessions/turns/assets for the active session only.
- Memoise the run grid and asset tiles so typing in the composer stops re-rendering the whole timeline.
- Keep thumbnails on the already-optimised path; drop duplicate reconciliation passes.

## 5. Backend and CSS

- `frank-api`: delete the handlers that only served the removed screens (demo/readiness/activation/env/briefs/runs/exports). Studio, video, upscale, sessions, prompt agent, feedback, handoff and admin RPCs stay.
- `frank-generate` is still referenced from `App.tsx` as a generation path — kept as is.
- `app.css` (2,118 lines): remove rules for the deleted screens only; no restyling.

## Verification

- Build + typecheck clean; test suite green (tests asserting removed helpers are deleted with them).
- Playwright pass signed in as your account: Studio image/video/compare, generate a run, lightbox + inline edit, references (upload, paste, @ref), Prompt generator wizard → send to Studio, Upscaler, sessions rename/new, Admin portal (video + access toggles), feedback, themes — screenshots compared before/after so nothing visible moves.
- A release-notes entry is added for the publish, per the standing rule.

## Technical notes

- No database schema changes, no auth changes, no model roster changes.
- Deletions are import-graph verified before removal; no "probably unused" guesses.
- Work lands in phases (dead code → helper extraction → component extraction → perf) so each step is independently reversible.
