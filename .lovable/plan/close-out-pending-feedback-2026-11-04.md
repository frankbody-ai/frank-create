# Close out pending feedback

Two items were listed as pending. A fresh look shows the first may already be fixed in the code.

## 1. Seedance 2 / 2.5 video timeouts
The backend now submits videos and checks back on them later, instead of waiting in one long request. That is the fix we had planned.
- Run one short Seedance 2 and one Seedance 2.5 clip in the Studio and confirm both finish and show the video.
- If either still times out or gets stuck, find the cause from the logs and fix only that, then redeploy the backend.
- If both work, mark this as done.

## 2. 19 Aug "502 / health check" feedback item
The intermittent 502/503s were a hosting-side problem. The backend keys are set and health checks pass.
- Change this item's status from "open" to "done" so it leaves the admin pending list.
- Read it back to confirm.

## 3. Wrap up
- Add a "What's new" entry only if code changed in step 1.
- Give you a final list of what is done and anything still open.

## Technical notes
- Video path: `submitOpenrouterVideo` + `video_poll_url` status resume in `supabase/functions/frank-api/index.ts`.
- Feedback status update in the core project's feedback table, using the existing allowed status values.
