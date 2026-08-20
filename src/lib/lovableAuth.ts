import { supabase } from "./supabaseClient";

/**
 * Sign-in goes straight through our own Supabase project (and therefore our own
 * Google OAuth client), NOT the Lovable OAuth broker at oauth.lovable.app.
 * The broker's callback URL isn't registered in our Google Cloud project, which
 * produced `redirect_uri_mismatch` after the public URL changed. The Supabase
 * callback (https://<ref>.supabase.co/auth/v1/callback) is registered and stable,
 * so renaming the app's public URL can never break it again.
 */
type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft" | "lovable",
      opts?: SignInOptions
    ) => {
      const supaProvider = provider === "microsoft" ? "azure" : provider === "lovable" ? "google" : provider;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: supaProvider as "google" | "apple" | "azure",
        options: {
          redirectTo: opts?.redirect_uri ?? window.location.origin,
          queryParams: { ...opts?.extraParams },
        },
      });
      if (error) return { error, redirected: false as const };
      return { redirected: true as const, error: null };
    },
  },
};
