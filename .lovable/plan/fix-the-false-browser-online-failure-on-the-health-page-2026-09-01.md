# Fix the false "Browser online" failure on the health page

## What's actually happening

Nothing is broken with your connection. In the report you pasted, both backend
calls succeeded (`/health` 180 ms, `/models` 451 ms) in the same run where
"Browser online" says offline.

That check reads the browser's `navigator.onLine` flag, which Chrome reports as
`false` in situations where the machine genuinely has connectivity — VPNs,
captive-portal detection, or a network interface that changed after page load.
So the health page fails a check while the app works, which is a misleading
alarm rather than a real fault.

Side note, not an error: `/models` reporting "1 models" is expected on this
screen. The health page runs without a session, and the backend only lists the
models an unauthenticated caller may see.

## The fix

Replace the flag-based check with a real reachability check:

1. Rename the check to "Network reachable".
2. Pass it when a lightweight request to the backend actually completes.
   Reuse the `/health` call result already made earlier in the run, so no extra
   round trip is needed.
3. Fail it only when that request fails AND `navigator.onLine` is false.
4. When requests succeed but `navigator.onLine` is false, still pass, with the
   detail explaining the browser reported offline while requests succeeded — so
   an operator sees the nuance instead of a red row.
5. Keep the raw `online` value in the copyable JSON report for debugging.

Apply the same reasoning to the status banner so it does not flip to "offline"
while requests are succeeding: treat the flag as a hint, and only show offline
after a backend request actually fails.

## Technical detail

- `src/components/HealthPage.tsx` — `runChecks()`: derive the network result
  from the `/health` timing result plus `navigator.onLine`, rather than the flag
  alone. Report object keeps `online: navigator.onLine`.
- `src/components/StatusBanner.tsx` — only enter the `offline` state when a
  health request has failed; the `onLine` flag alone no longer forces it.

No backend, database, or model changes.
