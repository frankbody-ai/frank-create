# Fix Cliff's two open feedback items (21 Oct)

## 1. Reference image history no longer updating
- Read Cliff's feedback text and screenshot to confirm what he saw.
- Reproduce in the app: add a reference, generate, check the reference history list updates.
- Trace the cause (the history read in the backend vs. the list refresh in the Studio) and fix only what the reproduction shows.

## 2. Refreshing the page loses previously generated images
- Reproduce: generate images, refresh, check the session still shows them.
- Check whether runs are saved and read back correctly, including the newer paged loading of runs and pictures.
- Fix the cause the reproduction confirms; if both already work, say so and close the items.

## Finish
- Re-run both checks after the fix.
- Mark both feedback items done (or explain why not).
- Add a "What's new" note at the top of the release notes if anything changed; redeploy the backend only if it changed.

## Technical details
- Cause is not yet confirmed for either item; diagnosis comes first.
- Likely areas: `supabase/functions/frank-api/turns.ts`, `refs.ts`, `index.ts` (paged `/turns`, `/assets`) and the Studio session/reference loading code.
