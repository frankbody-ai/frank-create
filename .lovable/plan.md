# Wrap-up: finish Phase 3 + Phase 4 stubs

Close out the remaining items from `.lovable/plan.md` plus the fresh 404 in the runtime logs.

## 1. Fix the `/local-engine/workflow-blueprints` 404

The edge function currently 404s on `GET /local-engine/workflow-blueprints`. The handler exists but the path matching is off (likely method/order). Patch the route so it returns the empty-blueprints payload as designed.

## 2. Dedicated Review Board route

Replace the "open raw JSON in a new tab" behavior with a real in-app page:

- New route `src/routes/review.$sessionId.tsx` (under `_authenticated` so it's auth-gated).
- Fetches `/sessions/:id/review-board` and `/sessions/:id/sync-manifest` via existing `frank-api` endpoints.
- Renders: session header, approved/pending asset grid with thumbnails, brief snapshot, export list, and a "Download handoff" button calling `createSessionHandoff`.
- Update the "Open Review Board" button in `frank-create/src/App.tsx` to navigate to `/review/:sessionId` instead of opening JSON.

## 3. Live session-dropdown counters

The session picker shows stale counts from the cached header. Recompute on session-switch:

- In `App.tsx`, derive turn/asset counts per session from the already-loaded `turns` / `assets` arrays (or fetch counts lazily when the dropdown opens).
- Drop the cached count field from the session row rendering.

## 4. Phase 4 stubs — graceful "not available in cloud"

- `POST /videos` in `frank-api`: return `501` with `{ error: { code: "unsupported", message: "Video generation requires the desktop ComfyUI install." } }`.
- Frontend: catch that code in `createVideoStoryboard` callers and surface a non-blocking toast/banner ("Available in desktop install") instead of an error.
- Same treatment for any remaining `/local-engine/*` UI affordances — hide behind `isLovablePreview` where they're dead, show a tooltip elsewhere.

## 5. Dead-code cleanup in `frank-create/src/lib/api.ts`

`uploadImage` and `queuePrompt` still call `/api/upload/image` and `/api/prompt` (the old Python server). In Lovable preview they're unreachable. Either:
- Remove them if nothing imports them, or
- Stub them to throw a clear "Desktop install only" error.

Quick grep first to confirm call sites, then act accordingly.

## Files touched

- `supabase/functions/frank-api/index.ts` — fix blueprint 404, add video 501
- `src/routes/_authenticated/review.$sessionId.tsx` — new review board page
- `frank-create/src/App.tsx` — link to new route, live session counts, video error handling
- `frank-create/src/lib/api.ts` — clean up `uploadImage`/`queuePrompt`

## Out of scope

- Real video generation
- Real local ComfyUI execution in cloud
- Any DB migrations (none needed)

## Order of execution

1, 2, 3 in one batch (most user-visible). Then 4 and 5 as a smaller follow-up batch. Test in the preview after batch 1.
