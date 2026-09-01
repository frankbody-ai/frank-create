import { createClient } from "@supabase/supabase-js";

import { CORE_SUPABASE_PUBLISHABLE_KEY, CORE_SUPABASE_URL } from "./coreConfig";
import { adoptSharedSession, publishSessionChanges } from "./sharedSession";

// supabase-js keys its stored session by the project ref in its URL, so the
// ref is derived from the same resolved URL rather than pinned separately.
function coreProjectRef(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

const CORE_PROJECT_REF = coreProjectRef(CORE_SUPABASE_URL);

// Someone who signed in at the hub arrives here already authenticated. This
// has to run before the client below reads its storage, hence module scope.
adoptSharedSession(CORE_PROJECT_REF);

/**
 * Create Studio talks to the AutoSolutions OS core.
 *
 * One Google account opens every app, so there is no studio-specific login and
 * no email-domain allowlist any more: who may enter is decided by the core
 * (membership + `is_entitled('frank_create')`), and what they can read is
 * decided by RLS on the core's `studio` schema.
 *
 * The default client targets the `studio` schema, so existing calls such as
 * `supabase.from("prompt_chats")` keep working unchanged. OS-level calls
 * (entitlements, brand, app roles) go through `os`, which targets `public`.
 */
export const supabase = createClient(CORE_SUPABASE_URL, CORE_SUPABASE_PUBLISHABLE_KEY, {
  db: { schema: "studio" },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Platform-level tables and helpers (entitlements, tenants, brand). */
export const os = supabase.schema("public");

// Signing in or out here carries to every other AutoSolutions app.
publishSessionChanges(supabase);

/**
 * Fully clear the local Supabase session: signs out via the SDK, then
 * removes any leftover `sb-*-auth-token` entries from localStorage.
 * Callers should typically follow with `window.location.replace("/")` so
 * the UI remounts cleanly at the auth gate.
 */
export async function hardSignOut() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[auth] signOut failed, continuing with local cleanup", err);
  }
  try {
    if (typeof window !== "undefined") {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && (k.startsWith("sb-") || k === "supabase.auth.token")) keys.push(k);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
    }
  } catch {
    /* ignore */
  }
}
