## Goal
Stop routing Google sign-in through the Lovable broker so users go straight from the app to Google's account picker — no intermediate "Sign in to Lovable" screen.

## Why the extra screen appears today
`frank-create/src/AuthGate.tsx` calls `lovable.auth.signInWithOAuth("google", …)` (from `frank-create/src/lib/lovableAuth.ts`), which always hops through Lovable's OAuth broker before handing off to Google. That broker step is what's showing the "log in to Lovable first" prompt.

Now that the project's own Google Client ID/Secret are configured in Cloud Auth Settings → Google, we can call the backend's OAuth endpoint directly and skip the broker entirely.

## Changes

1. **`frank-create/src/AuthGate.tsx`**
   - Replace the `lovable.auth.signInWithOAuth(...)` call in `signIn` with a direct `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } } })`.
   - Drop the `import { lovable } from "./lib/lovableAuth"` line.

2. **`frank-create/src/lib/lovableAuth.ts`**
   - Delete the file (no other code imports it after step 1).

No backend, schema, or env changes — the Google Client ID/Secret you already pasted into Cloud Auth Settings are what makes the direct flow work.

## Verification
- Click "Continue with Google" on the auth screen → should jump straight to Google's account chooser (no Lovable consent screen).
- After picking the Google account, land back on the app authenticated.
- Domain restriction (`@frankbody.com` / `@autosolutions...`) in `AuthGate` still enforced after sign-in.
