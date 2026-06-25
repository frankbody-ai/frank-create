# Port Frank Create Backend to Lovable Cloud

## Goal

Make the Lovable preview a fully working standalone app by reimplementing the `/api/frank/*` surface on top of Lovable Cloud (Supabase + Lovable AI Gateway), so the user no longer needs the local Python ComfyUI server to demo it.

The existing Python backend (`custom_nodes/frank_create/*`, `scripts/Start-FrankCreate.ps1`) stays untouched — local power users can still run it. The Lovable preview gets its own backend that mimics the same JSON contracts the frontend already calls.

## Architecture

Frontend keeps calling `/api/frank/*` (no frontend refactor required). Those routes are reimplemented as TanStack server routes / `createServerFn` calls in this Lovable project, backed by:

- **Supabase tables** for sessions, turns (rounds), assets, brand kit, projects, briefs, exports
- **Supabase Storage** (`studio-images` bucket already exists) for generated images and uploads
- **Lovable AI Gateway** for actual image generation (`google/gemini-3.1-flash-image` ≈ "Nano Banana", `google/gemini-3-pro-image`, `openai/gpt-image-2`)
- **Auth**: Supabase user session (already wired). RLS scopes all rows to `auth.uid()`.

Existing Supabase tables (`sessions`, `messages`, `assets`, `presets`, `model_capabilities`) get extended; missing ones (`turns`, `brand_kits`, `projects`, `briefs`, `exports`) get added.

## Phasing

### Phase 1 — Critical path (fixes issues 1, 3, 4, 10)

Get a brand-new session to actually generate an image end-to-end.

Endpoints implemented:
- `GET /api/frank/health` → `{ ok: true }`
- `GET /api/frank/config` + `/models` → static config from a server module
- `GET/POST/PATCH /api/frank/sessions` → CRUD on `sessions` table
- `GET/POST/PATCH /api/frank/turns` → new `turns` table (one row per generation round)
- `POST /api/frank/inference/turn` → calls Lovable AI Gateway image model, uploads result to `studio-images` storage, inserts an `assets` row, updates turn status `queued → running → complete/failed`
- `GET/POST/PATCH/DELETE /api/frank/assets` + `GET /api/frank/assets/:id/download` → signed URL from storage
- `POST /api/frank/prompt-remix` → Lovable AI chat (`google/gemini-3-flash-preview`) returning 3 variant prompts

Result after phase 1: persistent reconnecting banner gone, Generate works on a fresh session, Brief Remix works, images persist across reloads (already-implemented localAssets stays as a fallback cache).

### Phase 2 — Brand kit, briefs, projects, exports (fixes issues 5, 7, 8)

- `GET/PATCH /api/frank/brand-kit` → new `brand_kits` table (one per user), removes the "Start ComfyUI to save" message
- `GET/POST/PATCH /api/frank/projects` + `/briefs` + `/runs` → new tables
- `POST /api/frank/exports` + `GET /api/frank/exports/:id/download` + `POST /api/frank/assets/:id/export-set` → renders channel-ready variants (server-side resize via Web `OffscreenCanvas` / `sharp`-free path; for v1, just record the export and return the original asset URL with metadata)
- `GET /api/frank/sessions/:id/review-board` + `/sync-manifest` → JSON manifest endpoints
- `POST /api/frank/sessions/:id/handoff` → JSON bundle download

### Phase 3 — Provider/diagnostics + UX polish (fixes issues 2, 6, 9)

- `GET /api/frank/provider-env` + `/provider-status` + `/provider-audit` + `/activation-checklist` + `/demo-doctor` → return a Lovable-Cloud-flavored status (all green, Lovable AI as the provider, no env-key prompts)
- `POST /api/frank/demo/*` (evidence, call-brief, readiness-pack, brand-context, provider-readiness) → generate JSON receipts and store them as exports
- **Raw Comfy / Advanced Graph / `/comfy/`** → remove those sidebar links in Lovable preview (gated by a `VITE_IS_LOVABLE_PREVIEW` flag or by feature-detecting the absence of `/comfy/`) so users don't hit a dead "Not Found" page
- **Session dropdown stale counters** → recompute counts from `turns`/`assets` rows on session-switch instead of reading the cached header value
- **Open Review Board button** → either open a dedicated `/review/:sessionId` route rendering the review-board JSON, or remove the button. Picking the route option.

### Phase 4 — Video + local engine (deferred / explicit "Lovable preview doesn't support this")

- `POST /api/frank/videos` and `/local-engine/*` return `501` with a clear "video + local ComfyUI engine require the desktop install" message that the UI surfaces as a non-blocking notice. Most demo flows don't use these.

## Database migrations (Phase 1 + 2)

New tables (all RLS-scoped to `auth.uid()`, all with the required GRANTs):

- `turns` — `id`, `session_id`, `user_id`, `model`, `prompt`, `negative_prompt`, `status`, `provider_payload jsonb`, `error jsonb`, `created_at`, `updated_at`
- `brand_kits` — one row per user: `user_id` (PK), `name`, `palette jsonb`, `typography jsonb`, `voice jsonb`, `style_guidance text`, `assets jsonb`
- `projects`, `briefs`, `runs`, `exports` — standard CRUD shapes mirroring the existing TypeScript types in `frank-create/src/lib/types.ts`

Extend `sessions` (add `project_id`, `brief_id` optional FKs) and `assets` (add `turn_id`, `approval_status`, `is_favorite`, `export_metadata jsonb`).

## Files

New server routes under `src/routes/api/frank/`:
- `health.ts`, `config.ts`, `models.ts`, `sessions.ts`, `sessions.$id.ts`, `turns.ts`, `turns.$id.ts`, `assets.ts`, `assets.$id.ts`, `assets.$id.download.ts`, `inference.turn.ts`, `prompt-remix.ts`, `brand-kit.ts`, `projects.ts`, `briefs.ts`, `runs.ts`, `exports.ts`, `exports.$id.download.ts`, `provider-env.ts`, `provider-status.ts`, `activation-checklist.ts`, `demo-doctor.ts`, plus the `/demo/*` and `/sessions/:id/*` helpers

All use `requireSupabaseAuth` middleware so RLS does the heavy lifting; the existing `frank-create/src/lib/api.ts` already sends the bearer token, so no frontend changes are needed for auth.

Lovable AI Gateway helper: `src/lib/ai-gateway.server.ts` (the canonical `createLovableAiGatewayProvider`).

## Out of scope

- Rebuilding the local ComfyUI workflow execution. The "local engine" status simply reports unavailable in the cloud preview.
- The Python backend itself — untouched.
- Video generation (Phase 4 stub only).

## Recommended execution order

Phase 1 first as one batch (migration → server routes → quick browser test). Once you confirm a fresh session generates an image in the preview, we move on to Phase 2, then 3. Phase 4 is optional polish. Want me to start with Phase 1 only, or push straight through 1–3?