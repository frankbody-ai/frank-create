# Keep "What's new" fresh on every publish

## What's actually wrong

The pop-up machinery already works: the release log lives in `frank-create/src/lib/releaseNotes.ts`, the modal auto-opens once per user, and the "seen" marker is stored per user in the backend (`release_seen`), so once dismissed it stays gone until a newer entry exists.

The problem is content: the log still has only one entry, dated 18 August 2026 ("Seedream 5.0 Pro + a tidier studio"). Everything shipped since then — the inline lightbox editing, prompt-generator reference handoff, Brief Mix removal, auto-clearing prompt box, upscaler rework — was never added, so anyone who dismissed that entry never sees the banner again.

## Plan

1. Add a new release entry at the top of the log, dated today, summarising the changes shipped since the last entry in plain user-facing language:
   - Full-screen image preview with inline editing — type a change under the image and send, the new version opens in place.
   - Prompt box clears automatically after each Generate.
   - Prompt Generator now carries your reference images through to Studio.
   - Brief Mix removed.
   - Upscaler simplified: one clean "drop here or upload" card, with the chosen source shown as a small chip in the settings rail.
2. Keep the standing rule going forward: **every publish gets a new entry at the top of the log in the same turn**, so the pop-up shows once for each user after each release and disappears when dismissed. I'll note this rule in project memory so it isn't dropped in future sessions.
3. Verify the flow end-to-end in the preview: signed-in user sees the banner once, dismissing it persists, and reloading does not re-show it.

## Technical notes

- Entry shape: `{ id, date, title, items }` appended as the first element of `RELEASES`; `LATEST_RELEASE_ID` derives from it automatically.
- `unseenReleases()` already handles the "user last saw an older entry" case by returning only the newer entries, so no logic change is needed.
- No migration required — `release_seen` exists with correct grants and RLS.
