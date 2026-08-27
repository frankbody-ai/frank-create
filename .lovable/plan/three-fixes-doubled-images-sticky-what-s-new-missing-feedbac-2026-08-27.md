# Three fixes: doubled images, sticky "What's new", missing feedback

## 1. A run of 4 shows 8 images until you refresh

The images are only duplicated on screen, never in the database — which is why a refresh cleans them up.

A multi-image round is fanned out into one worker per image. While it runs, the app both (a) re-reads the session to merge finished images in, and (b) prepends whatever the finished round hands back. That second step adds the images to the on-screen list without checking whether they are already there, so each one appears twice.

Fix: merge by image id everywhere new images arrive (normal run, side-by-side run, video run), keeping newest-first order. Same approach the session re-read already uses correctly. Nothing about generation itself changes.

## 2. "What's new" reappears on every refresh

Confirmed cause: dismissals are no longer being saved. In the new backend the "last seen release" record is keyed by company + person, but the app still saves it keyed by person alone, so the write is rejected and silently swallowed. The most recent successful saves all predate the backend move; every dismissal since then has been lost.

Fix:
- Save the dismissal in a way that matches the new record shape (update the person's existing row, insert one if there isn't one), so it sticks across devices.
- Also remember the dismissal locally on the device, so even if the backend write fails the pop-up doesn't come back on the next refresh.
- Stop swallowing the failure silently — log it so a future breakage is visible.
- Read the marker defensively (one row, newest first) so multiple company rows can't break the check.

## 3. Feedback submissions never reach the admin portal

Verified: the newest feedback record in the live database is from 19 August. Nothing has been stored since the backend move, so this is a submission failure, not an admin-portal display problem. The feedback table now requires a company on each row, which the app's submission doesn't provide.

Fix, in order:
1. Reproduce a real submission against the live backend and capture the exact rejection.
2. Make submission satisfy the new requirements (company stamped on the row, screenshot upload path valid in the new storage bucket), and surface any failure to the person submitting instead of showing success.
3. Then confirm the admin portal can read *other people's* feedback: the current read rule relies on a roles table that the new backend may not populate. If admins can only see their own rows, switch the read to the OS app role already used to gate the admin portal.
4. Verify end-to-end: submit as a normal user, see it listed under Admin portal → Feedback tasks, and confirm the 5 pre-existing historical rows are visible too.

## Technical notes

- Image dedupe: `src/App.tsx` — the `setAssets((current) => [...result.assets, ...current])` sites (image run, side-by-side, video) get a shared `mergeAssets` helper keyed on `asset.id`.
- Release marker: `src/lib/releaseNotes.ts` — `release_seen` primary key in the core is `(tenant_id, user_id)`; the current `upsert(..., { onConflict: "user_id" })` cannot match it. Add localStorage fallback keyed on `LATEST_RELEASE_ID`.
- Feedback: `src/lib/feedback.ts` and `src/components/AdminPortal.tsx`; `studio.feedback_items.tenant_id` is NOT NULL. If the core needs a trigger/policy change to stamp tenant or to let app admins read all rows, that is a change in the OS core project — I'll report the exact SQL rather than applying it from here.
- Publish afterwards adds a new "What's new" entry per the standing rule.
