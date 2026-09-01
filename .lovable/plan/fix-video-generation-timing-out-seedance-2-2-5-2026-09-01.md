# Fix video generation timing out (Seedance 2 / 2.5)

## What's actually happening

Verified in the code this turn:

- Video runs are fully **synchronous**. The backend submits the job to the video provider and then sits in a polling loop inside the same request, waiting up to **10 minutes** (`openrouterVideo(..., maxMs = 600_000)`), before it writes the clip and answers the browser.
- The serverless request never lives that long. The gateway cuts the connection first, so the browser sees a timeout/502 even when the clip may still be rendering upstream — and Seedance clips (especially 2.5, which allows up to 30s) are exactly the slow ones.
- Image runs already solved this: they return `status: "running"` with job ids on the run record, and the app polls `/inference/status` until the run closes out. Video never got that treatment — it has no job id stored and no resume path.
- Extra trap: a video run left in `running` with no stored job ids gets force-failed by the 3-minute "worker interrupted" watchdog, so even the record ends up wrong.

Root cause: video is the one media path with no async submit + resume.

## The fix

Bring video onto the same async pattern as images.

1. **Submit and return immediately.** The video route submits the job, stores the provider polling URL (plus model, resolution, duration) on the run record, and answers `status: "running"` in a couple of seconds instead of holding the connection open.
2. **Resume on poll.** `/inference/status` learns to recognise a video run: it checks the stored polling URL, and when the provider reports completion it downloads the clip, stores it, creates the asset, and closes the run as `complete`. Provider failure closes it as `failed` with the provider's message.
3. **Realistic time budget.** The 3-minute interrupted-worker watchdog is scoped so it doesn't kill video runs; video runs get their own ~12-minute ceiling, after which the run fails with "still rendering after 12 minutes — try a shorter clip or lower resolution".
4. **App side.** The video generate handler (single and compare-mode) starts polling when the response is `running`, exactly like the image handler already does, keeping the run card in its generating state with a "long clips can take a few minutes" status line. Stop/cancel still works.

Result: pressing generate on Seedance 2 or 2.5 returns a live run card straight away, and the clip lands on the card when the provider finishes — no more timeouts.

## Verification

After the change I'll run a real Seedance 2.5 clip end to end against the live backend and confirm the run goes running → complete with a playable clip, then report the outcome.

## Technical notes

- `supabase/functions/frank-api/index.ts`: split `openrouterVideo` into `submitOpenrouterVideo` (returns `{ pollUrl, request }`) and a `pollOpenrouterVideoOnce(pollUrl)` reader; `handleVideo` persists `video_poll_url` / `video_started_at` in `settings_snapshot_json` and returns `running`; `handleTurnStatus` gains a video branch before the prediction-id branch that finalises via the existing `downloadProviderMedia` → `storeOrFallback` → asset-insert sequence (extracted into a shared helper so both paths write identical rows).
- Watchdog: the `!predictionIds.length` 3-minute rule excludes snapshots with `kind: "video"`.
- `src/lib/api.ts`: `createVideoStoryboard` return type adds `"running"`.
- `src/App.tsx`: video handler and the compare-mode video side reuse `pollTurnUntilDone`.
