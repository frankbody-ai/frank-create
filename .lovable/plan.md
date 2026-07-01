## Scope

Three small enhancements to Frank Create's Lovable preview UI, all frontend + edge-function changes. No schema changes.

---

### 1. Non-blocking video toast

**Problem:** clicking a video/storyboard action currently throws or shows a raw error.

**Change:** in `frank-create/src/App.tsx`, wrap the video call site in a try/catch that detects the `501` / "desktop install" response from `POST /videos` and surfaces a `sonner`-style toast + persistent inline banner ("Video generation requires the desktop ComfyUI install"). Same treatment for `uploadImage` / `queuePrompt` errors thrown from `api.ts`.

- Add a tiny `useDesktopOnlyNotice()` helper (local to `App.tsx`) that shows a toast and sets an inline `<StatusBanner>` message.
- No blocking modal, no page reload.

### 2. Structured Download Handoff (JSON + CSV)

**Problem:** current `createSessionHandoff` returns an opaque `ExportRecord`; users want a real file they can open.

**Change:**
- **Edge function** (`supabase/functions/frank-api/index.ts`): extend the `POST /sessions/:id/handoff` handler to build a structured payload:
  ```
  { session, turns[], assets[], blueprints[], approved[], generated_at }
  ```
  Persist it as an `ExportRecord` with both `handoff.json` and `handoff.csv` (CSV = one row per asset with turn id, prompt, model, approval_status, download_url). The existing `GET /exports/:id/download` route serves the JSON; add `?format=csv` to serve the CSV variant from the same record's metadata.
- **Frontend** (`ReviewBoardPage.tsx`): after `createSessionHandoff` resolves, offer two download links (JSON / CSV) using `exportDownloadUrl(id)` + `?format=csv`. Show asset count and a "Copy manifest" button.

### 3. Approve / Reject on review board

**Problem:** review board is read-only.

**Change** (`frank-create/src/components/ReviewBoardPage.tsx`):
- Add `Approve` and `Reject` buttons on each `AssetGrid` card (pending section shows both; approved section shows only `Reject` → revert to pending).
- On click, call existing `updateAsset(assetId, { approval_status: 'approved' | 'rejected' })` from `api.ts`, then re-run `load()` to refresh both grids.
- Optimistic UI: disable the buttons while the request is in flight; toast on failure.
- Add a "Rejected" section below "Pending" so rejected assets are still visible but clearly separated.

---

### Files touched

- `frank-create/src/App.tsx` — toast + inline banner for desktop-only actions
- `frank-create/src/components/ReviewBoardPage.tsx` — approve/reject buttons, rejected section, JSON+CSV download buttons
- `frank-create/src/lib/api.ts` — small helper `handoffDownloadUrl(id, format)` if needed
- `supabase/functions/frank-api/index.ts` — structured JSON+CSV handoff payload, `?format=csv` on download route

### Out of scope

- DB migrations, real video generation, changes to asset schema, bulk approve/reject.

### Order

Do all three in one batch; verify in preview by (a) clicking a video action, (b) generating a handoff and downloading both formats, (c) approving then rejecting an asset and confirming the grid refreshes.
