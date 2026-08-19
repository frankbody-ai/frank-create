import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const ALLOWED_EMAIL_DOMAINS = ["frankbody.com", "autosolutions.ai", "alivebody.com.au"];

export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false;
  const lower = email.toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some((d) => lower.endsWith(`@${d}`));
}

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
