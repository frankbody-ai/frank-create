# Create Studio → AutoSolutions OS core

**Status: complete.** Create Studio runs on the AutoSolutions OS core. This is
the record of what moved, how it was verified, and what is deliberately left
behind.

## What runs where now

| Concern | Where |
|---|---|
| Identity (one Google account), entitlements, roles | core |
| Studio data — sessions, messages, assets, chats, feedback | core, `studio` schema |
| Images (4.76 GB, 735 objects) | core, `studio-images` bucket |
| Company branding | core (`my_brand()`) |
| Email queue, send state, send log | core (`pgmq` + `studio` tables) |
| `frank-api` (generation) | Lovable Cloud **compute**, reading/writing the core |
| MCP tools | Lovable Cloud compute, reading/writing the core |
| AI gateway keys (`LOVABLE_API_KEY`, Replicate, OpenRouter) | Lovable Cloud |

The old project is now compute only. It holds no authoritative data.

## How access works now

Before: an email-domain allowlist (`@frankbody.com`, `@autosolutions.ai`,
`@alivebody.com.au`) plus a per-person approval flag.

Now: the company must own Create Studio (`entitlements`) **and** the person
must be assigned it (`app_assignments`) — checked by `is_entitled('frank_create')`
in the SPA, and again inside `frank-api` for every call. Company owners and
admins pass automatically. Studio roles (admin/manager/user) are OS app roles,
so one place decides who may use the studio and as what.

Because Create Studio is an "everyone app" for Frank Body and al.ive
(`entitlements.auto_assign`), anyone joining those companies by email domain
receives it automatically — the same reach the old allowlist gave, without the
guesswork.

## Verification performed

- 735/735 storage objects reconciled path-by-path against the source database;
  0 missing, 0 extra, 0 zero-byte. Real `assets.storage_path` values were
  signed from the core and fetched: bytes and content types intact.
- Row counts after merge: assets 749, messages 220, sessions 19, prompt chats
  72, chat messages 367, feedback 5.
- Ownership split corrected: al.ive designers' 246 assets belong to al.ive, not
  Frank Body (the August migration had filed everything under Frank Body, which
  would have hidden people's own work from them and exposed it to the other
  company). Mis-tagged rows: 0.
- End-to-end in production: sign-in, entitlement gate, `my_access_state`,
  `release_seen`, `user_features`, brand resolution, and `frank-api`
  `/sessions`, `/assets`, `/turns` all 200.

## Things that bit us (worth remembering)

- **Lovable reserves `SUPABASE_*` env names.** Pointing the function at the
  core needed `CORE_SUPABASE_URL` / `CORE_SUPABASE_SERVICE_ROLE_KEY` /
  `CORE_SUPABASE_ANON_KEY`. `frank-api` now *throws at boot* if they are
  missing rather than silently serving the host's database.
- **`service_role` bypasses RLS but still needs GRANTs.** Missing table grants
  on the `studio` schema produced `42501` on every call (core migration 0024).
- **Old app code knows nothing about companies.** `frank-api` inserts rows with
  a `user_id` and no `tenant_id`; the core fills it from the author's acting
  company via a trigger (core migration 0025) rather than every insert learning
  about tenancy.
- **The app and its edge functions deploy separately.** Pushing to main updated
  the SPA while `frank-api` kept running the old code — the symptom was a
  half-migrated app whose reads worked and whose generation 401'd.
- **MCP silently resolved to the host project**, because it preferred
  `SUPABASE_URL`. Every MCP generation was writing to the wrong database while
  the app read the core. It is now pinned to the core.
- **A dump taken with zstd compression** needs a `pg_restore` built with zstd
  (Homebrew's `libpq` is not; `postgresql@18` is).

## Left behind deliberately

- `frank-generate`: removed from the repo; the deployed copy still needs
  deleting once Lovable's publish gate releases it.
- Auth emails: the core still sends them through Supabase's built-in sender
  (rate limited to 2/hour, no custom SMTP). Nobody depends on it — sign-in is
  Google — but see below.

## Next

1. Delete the deployed `frank-generate` function.
2. Decide where platform email lives (see `docs/PLATFORM_EMAIL.md`).
3. Retire the old Supabase project once a week passes with no reads.
