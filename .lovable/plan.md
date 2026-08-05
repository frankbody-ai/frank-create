# Fix: removed references come back after a refresh

## What's happening

Removing a reference (the X on a thumbnail) and the automatic post-run clean-up only hide the image in the current browser tab. The list of "retired" reference IDs lives in in-memory state that resets on reload, while the reference records themselves stay in the backend. So on refresh the session reloads and every old reference reappears in the dock.

## The fix

Make removal durable instead of visual:

1. When a reference is removed with the X (or via the larger preview's "Remove reference"), delete the reference record in the backend and drop it from the local list, instead of just marking it hidden.
2. Do the same for the automatic clean-up that runs after each generation, so the dock genuinely empties and stays empty across refreshes. Only reference-kind assets are affected — generated outputs, approvals and history are untouched.
3. Keep a local fallback list of removed IDs saved in the browser so that if the backend delete fails (offline mode / network error), the image still does not come back after a refresh.
4. Reconcile on session load: any reference still marked as removed locally is filtered out, and the fallback list is pruned once the backend no longer returns those records.

## Technical notes

- `frank-create/src/App.tsx`: `removeReferenceFromDock` and `clearReferenceDock` call `deleteAsset(id)` (already exposed in `src/lib/api.ts`, and the `DELETE /assets/:id` route already exists in `supabase/functions/frank-api/index.ts`) when connection is online, then remove the asset from `assets` state.
- `retiredReferenceIds` becomes persisted state (localStorage, keyed per user/session) used only as an offline/failure fallback, with pruning after asset load.
- Session-load path (`setAssets(assetResult.assets)`) filters out persisted retired IDs before rendering the dock.
- Dragging a past output back in still works: it re-creates a reference record, so it is unaffected by the delete-on-remove behaviour.

## Verification

Load a session, add references, remove one with X, run a generation, then hard-refresh and confirm the dock is empty (and that outputs/history are intact).
