# Cleanup: remove the abandoned ComfyUI era

Goal: the repo contains only what the live app needs. Everything that shipped and is visible today (Studio with Image / Video / Side-by-Side, Prompt Generator, Preset Creator, Review Board, Admin portal, Feedback, Health, Cliff access, auth, brand styling) stays and keeps working exactly as-is.

## 1. Delete the ComfyUI fork at the repo root

The whole self-hosted attempt goes: the Python engine and its extras, the custom `frank_create` Python nodes, workflow blueprints, model folders, the API/middleware/app server packages, Python configs and requirements, the Windows `.cmd` launchers, and the ComfyUI-era docs and readiness packs. The root `package.json` and `lovable.toml` stay, since they run the app.

Nothing in `frank-create/` imports any of it — the live app talks only to Lovable Cloud.

## 2. Remove the duplicate local backend

`frank-create/server/frankApi.ts` is a second, full copy of the backend that only ran when a local env var pointed at it. It goes, along with its wiring in the Vite config. The app keeps using the Lovable Cloud `frank-api` function, which is the path the preview and published site already use.

## 3. Strip dead ComfyUI/local-GPU surface from the app

- Drop the disabled "Frank Local Comfy Studio" model and its local-checkpoint guidance notes from the model roster.
- Remove the raw-canvas link builder, the desktop-only upload/queue stubs, the desktop-detection helper, and the local-engine status wording that can no longer occur.
- Remove the workflow-graph helpers used only by the old canvas (reference-copy prompt builder, node-type readers) and the `advancedGraphUrl` config field.

## 4. Remove the leftover Advanced tools drawer

The Advanced view was cut earlier but its plumbing remains: a dead view id, an `advancedOpen` constant hardwired to `false`, the shell class it toggles, and the drawer's CSS blocks. All removed.

## 5. Prune the test suite aggressively

Delete tests that assert on removed behaviour (Comfy models, local engine, advanced drawer, the local server) and keep the suite green and focused on what ships: generation flows, side-by-side, presets, pricing, auth gating, review/approval.

## Verification

- Full build plus typecheck must pass with no unresolved imports.
- Test suite green.
- Playwright pass over the live preview: sign-in card, Studio in all three modes, Prompt Generator, Preset Creator, Review Board, Admin, Feedback — screenshots compared against current behaviour so nothing visible changed.

## Technical notes

- Files deleted: repo-root ComfyUI tree (`comfy/`, `comfy_extras/`, `comfy_api*/`, `comfy_execution/`, `comfy_config/`, `custom_nodes/`, `blueprints/`, `models/`, `app/`, `api_server/`, `middleware/`, `alembic*`, `tests/`, `tests-unit/`, `main.py` and sibling Python modules, `*.cmd`, ComfyUI-era markdown), plus `frank-create/server/`.
- Edits: `frank-create/vite.config.ts`, `src/lib/presets.ts`, `src/lib/studio.ts`, `src/lib/api.ts`, `src/lib/types.ts`, `src/lib/frankWorkflow.ts`, `src/App.tsx`, `src/styles.css`, and the affected test files.
- No database, edge function, or auth changes.
- `dist/` at the root is a stale build artifact of the old server and is removed too; the app builds to `frank-create`'s configured output.
