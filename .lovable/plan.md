# Fix stuck "Generating…" cards after the media is already done

## What's happening

The studio only re-reads the session **after** the generation request returns. Verified in `frank-create/src/App.tsx`:

- `reconcileSessionAssets()` is called only in the `finally` block of the image, video and compare handlers — never while a run is in flight.
- `pollTurnUntilDone()` only starts if the backend response arrives and says `running`.
- The only other safety net is a 12-minute watchdog that clears the card and shows a timeout error.

Meanwhile the backend (`supabase/functions/frank-api/index.ts`) writes the round row **before** calling the provider and then updates it with assets on completion. So when the HTTP response is lost (edge 502/504, worker request timeout, dropped connection, laptop sleep, tab throttling), the assets are already in the database while the browser keeps spinning until the 12-minute watchdog — which is why a manual refresh reveals the finished images.

## What to build

1. **Live reconcile loop**
   While there is any local pending card or any queued/running round, poll the session every ~5s (backing off to ~10s after the first minute) using the existing `reconcileSessionAssets()`. Merge-only, so nothing on screen is lost.

2. **Settle the pending card from server truth**
   When the reconcile shows the round has finished (round no longer running, or its assets have landed), clear the matching local pending entry, drop `busy`, set the phase to completed, select the newest asset and show the normal "ready" status — same end state as a successful response. Tie each local pending entry to its round id so only that card settles.

3. **Reconcile on window focus and tab visibility**
   Re-read the session when the tab regains focus or becomes visible again, so coming back to a backgrounded tab shows finished work immediately instead of waiting for the next tick.

4. **Honest waiting copy + manual escape hatch**
   After ~90s of waiting, the pending card shows elapsed time and a small "Check for results" button that runs the reconcile on demand. The 12-minute watchdog stays, but only fires if the reconcile still shows nothing finished, so a completed run can never end in a false timeout error.

5. **Don't double-apply results**
   If the original request eventually does return after the reconcile already settled the round, the merge-by-id logic keeps it idempotent — no duplicate assets, no duplicate round cards.

## Technical notes

- All changes are client-side in `frank-create/src/App.tsx`; no backend or schema change is needed because the round row and assets are already persisted server-side.
- The poll reuses `listTurns` / `listAssets` via `reconcileSessionAssets()`; polling stops as soon as there is no pending card and no queued/running round, so idle sessions make no requests.
- Video runs already carry their own polling for the async provider path; the new loop is scoped so it complements that rather than duplicating provider calls (it only reads our own database).
