# Seedream 5.0 Pro + "What's new" release banner

## 1. Seedream 5.0 Pro

Add ByteDance Seedream 5.0 Pro as the active Seedream image model and retire 4.5 from the picker without breaking history.

- New model entry `seedream-5-pro` — label "Seedream 5.0 Pro (ByteDance)", OpenRouter provider, 4K badge, native multi-image batches, edit-capable, aspect ratios and sizes matching what the model actually accepts (no invented options).
- Existing `seedream-4-5` entry stays in the roster but flagged as legacy/hidden, so past runs still display "Seedream 4.5" on their cards and JSON chips.
- Backend routing (`frank-api`) gets the new OpenRouter slug, native-n support, per-model count cap, and payload builder; cost tier and provider-priority tables updated for the new id.
- Prompt-agent model list and in-app copy that names "Seedream 4.5" updated to 5.0 Pro.
- The exact OpenRouter slug is confirmed against the live catalog during implementation before wiring (the public list endpoint does not expose image models, so it is verified with an authenticated probe); if the slug differs from expectation, the model is registered under the real one.

## 2. Release notes popup

- A code-defined release notes list: each entry has an id, date, title, and bullet points. The newest entry covers this change set (centre-view fixes, Seedream 5.0 Pro).
- On sign-in, the app compares the newest release id against what the signed-in user has already seen and shows a centered modal banner with the release title and bullets, plus a "Got it" dismiss.
- Seen state is stored per user in the backend (small table keyed by user id + last seen release id, with row-level security so each user only reads/writes their own row), so the popup does not reappear on another device.
- If several releases shipped since the user last logged in, all unseen entries are listed in one modal, newest first.
- Optional link in the sidebar/footer to re-open the latest notes on demand.

## Technical notes

- Files touched: `frank-create/src/lib/presets.ts`, `frank-create/src/lib/studio.ts`, `frank-create/src/App.tsx`, `supabase/functions/frank-api/index.ts` and `promptAgent.ts`, plus a new `src/lib/releaseNotes.ts` and `src/components/ReleaseNotesModal.tsx`.
- One migration: `release_seen` table (user_id, last_seen_release_id, updated_at) with GRANTs and per-user RLS policies.
- `studio.test.ts` updated so the Seedream validation case targets the 5.0 Pro entry.
