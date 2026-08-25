// The AutoSolutions OS core.
//
// Create Studio no longer carries its own backend: identity, entitlements and
// its data all live in the core, and the studio's tables sit in the core's
// `studio` schema. The URL and publishable (anon) key are public values — they
// ship in the browser bundle by design — so they are pinned here rather than
// left to host environment variables, which have silently pointed at the wrong
// project before. Secrets are never stored here.

const CORE_URL = "https://allzlfxbemhhhihdpxfv.supabase.co";
const CORE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbHpsZnhiZW1oaGhpaGRweGZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODE0ODksImV4cCI6MjEwMjY1NzQ4OX0.uGWNGg9onAFF88OZ6A_N3bacv805VLea1H_uKSH2LAI";

function fromEnv(name: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return value && value.length > 0 ? value : undefined;
}

export const CORE_SUPABASE_URL = fromEnv("VITE_CORE_SUPABASE_URL") ?? CORE_URL;
export const CORE_SUPABASE_PUBLISHABLE_KEY =
  fromEnv("VITE_CORE_SUPABASE_PUBLISHABLE_KEY") ?? CORE_PUBLISHABLE_KEY;

/** The app key this product is registered under in the OS catalogue. */
export const APP_KEY = "frank_create";
