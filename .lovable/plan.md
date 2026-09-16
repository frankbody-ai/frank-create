# Copy the "What's new" feature into your other project

I can't build inside your other project from here — each project's agent only edits its own files. So here is exactly what the feature is made of, plus a ready-to-paste prompt for that project's agent.

## What the feature consists of

1. A hand-written release log in code: a list of entries, each with an id, a date, a title and a few plain-language bullets. Newest entry first.
2. A small database table that records, per signed-in person, the id of the last entry they acknowledged (so dismissal follows them across devices), plus a local fallback marker in the browser.
3. A modal that opens automatically once when someone has unseen entries, listing all entries newer than the one they last saw, with a "Got it" button.
4. A "What's new" item in the sidebar footer so anyone can re-open the latest notes on demand.
5. The standing rule: every publish adds a new entry at the top of the log, in the same change, so the pop-up fires once per person per release.

## Prompt to paste into the other project

> Add a "What's new" release-notes pop-up, working exactly like this:
>
> **1. Release log in code.** Create `src/lib/releaseNotes.ts` exporting `interface ReleaseNote { id: string; date: string; title: string; items: string[] }` and `export const RELEASES: ReleaseNote[]`, newest entry first. Ids look like `2026-09-16-short-slug`, dates like `16 September 2026`. Also export `LATEST_RELEASE_ID = RELEASES[0]?.id ?? ""`. Seed it with one entry describing the current state of the app in plain, non-technical language.
>
> **2. Seen marker.** Add one migration creating `public.release_seen` with `user_id uuid primary key references auth.users(id) on delete cascade`, `last_seen_release_id text not null`, `updated_at timestamptz not null default now()`. Grant `SELECT, INSERT, UPDATE, DELETE` to `authenticated` and `ALL` to `service_role`, enable row level security, and add one `FOR ALL TO authenticated` policy with `USING (auth.uid() = user_id)` and `WITH CHECK (auth.uid() = user_id)`.
>
> **3. Logic in the same file.**
> - `unseenReleases(): Promise<ReleaseNote[]>` — get the current user; if there is no session return `[]`. Read the newest `release_seen` row for that user (order by `updated_at` desc, limit 1 — do not use `.single()`). Fall back to a `localStorage` marker (`last-seen-release`) if there is no row. No marker at all means return every entry; marker equal to the latest id returns `[]`; a known marker returns the entries above it; an unknown marker replays only the newest 5. Wrap everything in try/catch and return `[]` on failure — this banner must never break or spam the app.
> - `markReleasesSeen(): Promise<void>` — write the `localStorage` marker first, then `update` the user's row; if no row was updated, `insert` one. Log warnings only, never throw.
>
> **4. Modal component** `src/components/ReleaseNotesModal.tsx` with props `{ forceOpen?: boolean; onClose?: () => void }`. On mount it calls `unseenReleases()` and auto-opens if there are any; it renders each entry as a heading, a muted date and a bullet list, with a single "Got it" primary action that calls `markReleasesSeen()`, closes, and fires `onClose`. When opened manually via `forceOpen` it shows the 5 most recent entries. Use this project's existing modal, button and text components and its design tokens — no hardcoded colours or raw pixel values if the project uses a token system.
>
> **5. Wiring.** Render `<ReleaseNotesModal forceOpen={notesOpen} onClose={...} />` once inside the app shell (inside the signed-in area), and add a "What's new" entry to the sidebar footer that sets `notesOpen` to true instead of navigating.
>
> **6. Standing rule.** Save a project memory: every publish must add a new entry at the top of `RELEASES` in the same turn, so the pop-up fires once for each user per release.
>
> Then verify: a signed-in user sees the banner once, dismissing it persists across a reload, and the sidebar link re-opens it.

## Notes

- The other project needs sign-in and a database for the cross-device part. Without accounts, the same thing still works using only the browser marker — say so and the agent can drop the table.
- If you'd rather I did it, open that project and paste the prompt above there.
