# Upscaler polish + long-run reliability

Four fixes: two are Upscaler UI, two are the same underlying "slow model dies mid-request" problem.

## 1. Much larger upscale preview

- Make the Upscaler output area one full-width column instead of a grid of small tiles, so each result (compare slider or video) fills the content band and can grow to roughly 70% of the viewport height.
- Clicking a result opens the existing full-screen lightbox, and the lightbox keeps the before/after slider for upscaled stills instead of showing only the enhanced image.
- Keep the existing "Compare / Enhanced only" toggle.

## 2. Download = real download

The Upscaler currently uses a plain link, which the browser ignores for cross-origin files and opens a new tab. Switch it to the same fetch-to-blob download already used in Studio ("Save"), so it writes straight to the Downloads folder with a sensible filename, with the open-in-new-tab path kept only as a fallback if the fetch is blocked.

## 3. Riverflow timeout ("Prediction exceeded 120s soft cap")

Confirmed from the browser console: those runs end in `TypeError: Failed to fetch` — the request is cut off while still waiting, and the backend also gives up on any single prediction after ~120s. Riverflow 2 Pro at 4K is agentic and regularly runs several minutes, so one long HTTP request can never work reliably.

Change the flow to start-and-poll:

- The backend creates the Replicate prediction, stores the prediction id on the round, and returns immediately with the round marked `running`.
- A new status endpoint checks those prediction ids, and on completion saves the images and flips the round to `complete` (or `failed` with the real provider error).
- The app polls that endpoint for any running round, so the run card fills in when the model finishes — minutes later is fine — and the misleading "120s soft cap" wording goes away.
- Rounds that are still running survive a page refresh, since the prediction ids live on the round.

## 4. Side-by-side comparison runs

Compare fires two of these long calls at once, so it fails for the same reason and is fixed by the same start-and-poll change: both sides get created, both are polled independently, and each side's card resolves on its own. Failures are reported per side (A / B) instead of killing the whole run. I'll confirm against the backend logs that there is no second, compare-specific cause before wrapping up.

## Technical notes

- Files: `frank-create/src/components/Enhancer.tsx`, `BeforeAfterSlider` usage, `frank-create/src/App.tsx` (download helper passed in, polling loop, lightbox compare), `frank-create/src/styles.css`, `frank-create/src/lib/api.ts`, `supabase/functions/frank-api/index.ts`.
- Round status/prediction ids go in the existing `settings_snapshot_json` on `messages`, so no schema migration is needed.
- Polling backs off (a few seconds, widening) and stops on terminal status, cancel, or an overall cap of ~15 minutes.
