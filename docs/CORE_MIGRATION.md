# Create Studio → AutoSolutions OS core

Status of the migration on branch `core-auth-migration` (commit `4019798d`), and
what is still required to cut over.

## What the branch changes

| Area | Before | After |
|---|---|---|
| Identity | Own Supabase project + Lovable auth broker | **One Google account on the core** — no second login |
| Who may enter | Email-domain allowlist (`@frankbody.com`, …) | `is_entitled('frank_create')` — the company owns the app and the person is assigned it |
| Roles | `user_roles` table in the app's own database | OS app roles (`public.app_role('frank_create')`, backed by `app_assignments`) |
| Data | App's own `public` schema | Core's `studio` schema (same table names, so queries are unchanged) |
| Branding | Hardcoded Frank Body marks | `my_brand()` — follows the company the person is acting in |
| API host | Hardcoded Lovable URL | `VITE_FRANK_API_BASE`, falling back to today's URL |

Verified locally against the core with an OS session: entitlement gate passes,
`my_access_state`, `release_seen` and `user_features` all serve from the core,
and the brand resolves from the session (`data-brand=frank-body`).

## What is NOT done yet (do not cut over before these)

### 1. The data on the core is a snapshot from 19 August

```
assets        326 rows   newest 2026-08-19
messages      121 rows   newest 2026-08-19
prompt_chats   30 rows   newest 2026-08-19
sessions       13 rows   newest 2026-08-19
```

The live studio has been in daily use since. **Cutting over now would strand
about a week of work.** Cutover therefore needs a short freeze and a delta
export from the Lovable-managed project (`amwfmlqvaranonhyvqbj`), which only
Lovable can produce — that project is not in our Supabase organisation and its
service-role key is deliberately not retrievable.

### 2. Image files still live in the old bucket

The core now has an empty private `studio-images` bucket with a read policy
(entitled Create Studio users only). The actual objects are still in the old
project, so historical assets would show as broken until they are copied.

Sanctioned way to get them out, without any credential leaving Lovable: ask
Lovable to add a temporary, admin-only function in the studio project that lists
`studio-images` and returns **short-lived signed URLs in batches**. Those URLs
are then downloaded and re-uploaded to the core, preserving paths.

### 3. frank-api has to be repointed and redeployed

The function is migrated in code (core auth, entitlement check, `studio`
schema) but still runs on Lovable Cloud, which is where the AI gateway keys
live. It reads these secrets, preferring the `CORE_*` names because Lovable
reserves `SUPABASE_*`:

| Secret | Value |
|---|---|
| `CORE_SUPABASE_URL` | `https://allzlfxbemhhhihdpxfv.supabase.co` |
| `CORE_SUPABASE_SERVICE_ROLE_KEY` | core service-role key (Supabase → Settings → API) |
| `CORE_SUPABASE_ANON_KEY` | core anon key (public value) |

Existing AI keys (`LOVABLE_API_KEY`, Replicate/OpenRouter) stay exactly as they
are. Set the secrets **first**, then deploy, or the function will briefly serve
the wrong database.

## Cutover order

1. Freeze studio use (announce a window).
2. Lovable exports the delta (DB rows since 19 Aug + the `studio-images` objects).
3. Load the delta into the core's `studio` schema; copy objects into the core bucket.
4. Set the three `CORE_*` secrets on frank-api; deploy the function.
5. Merge this branch and let the SPA deploy.
6. Smoke test: sign in from the hub launcher → studio opens with no second login,
   right company mark, sessions and assets load, a new generation round works.
7. Grant Create Studio to the people who need it (OS app assignment) — the old
   email-domain rule no longer admits anyone by itself.

## Rollback

Revert the merge and unset the `CORE_*` secrets: the function falls back to the
platform-injected `SUPABASE_*` pair and the app returns to its own project.
Nothing in the old project is deleted by this migration.

## After cutover

- Retire the Lovable-managed project once a week has passed with no reads.
- Move the function itself to the core when you want independence from the
  Lovable AI gateway (needs your own OpenRouter / Replicate keys).
