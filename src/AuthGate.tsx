import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, os, hardSignOut } from "./lib/supabaseClient";
import { APP_KEY } from "./lib/coreConfig";
import { getMyAccessState } from "./lib/admin";
import { brandCompanyId, brandName } from "./lib/tenantBrand";
import { AuthLayout, SignIn, GoogleButton, Button, Spinner, Text } from "./ds";

type Status = "loading" | "signed-out" | "denied" | "pending" | "ready";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const evaluate = async (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      if (!s) return setStatus("signed-out");
      const email = s.user?.email;
      // The OS decides who gets in: the company must own Create Studio and
      // the person must be assigned it (admins bypass). No email-domain
      // guesswork, and no second login.
      const { data: entitled, error: entitlementError } = await os.rpc("is_entitled", {
        app_key: APP_KEY,
      });
      if (!mounted) return;
      if (entitlementError) {
        setError("Could not check your access with AutoSolutions OS. Try again shortly.");
        return setStatus("denied");
      }
      if (!entitled) {
        setError(
          `${email ?? "This account"} is not entitled to Create Studio in the workspace you are signed in to. Ask your workspace admin to grant it from the AutoSolutions hub.`,
        );
        return setStatus("denied");
      }
      // A second gate: admins can require explicit approval per person.
      try {
        const access = await getMyAccessState();
        if (!mounted) return;
        if (access.require_approval && !access.approved && !access.is_admin) {
          setError(null);
          return setStatus("pending");
        }
      } catch {
        /* if the check itself fails, don't lock people out of a working session */
      }
      setStatus("ready");
    };

    supabase.auth.getSession().then(({ data }) => evaluate(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => evaluate(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);


  const signIn = async () => {
    setError(null);
    setBusy(true);
    // Straight to the core: same Google account as the hub and every other
    // AutoSolutions app, so arriving from the launcher is a silent hop.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setBusy(false);
      setError(oauthError.message || "Sign-in didn't work. Try again.");
    }
  };

  const signOut = async () => {
    await hardSignOut();
    window.location.replace("/");
  };

  if (status === "ready" && session) return <>{children}</>;

  const pending = status === "pending";

  return (
    <AuthLayout>
      <SignIn
        company={brandCompanyId()}
        companyName={brandName() ?? "frank body"}
        app="design-studio"
        appName="art-ificial design studio"
        method="sso"
        title={pending ? "Waiting for approval" : "Sign in"}
        description={
          pending
            ? `Your account (${session?.user?.email ?? "your work account"}) is on hold until an admin approves it. You'll get in as soon as they do.`
            : "Sign in with your work account."
        }
        error={error}
        loading={busy}
        providers={
          status === "loading" ? (
            <div className="as-auth__loading">
              <Spinner size="small" />
              <Text variant="bodySm" tone="secondary">
                Checking your session
              </Text>
            </div>
          ) : pending ? (
            <>
              <Button size="large" fullWidth onClick={() => window.location.reload()}>
                Check again
              </Button>
              <Button size="large" fullWidth onClick={() => void signOut()}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <GoogleButton loading={busy} onClick={() => void signIn()} />
              {status === "denied" ? (
                <Button size="large" fullWidth onClick={() => void signOut()}>
                  Use a different account
                </Button>
              ) : null}
            </>
          )
        }
        note={
          pending
            ? "Ask your team lead to approve your access in the admin portal."
            : "Access is granted per company in AutoSolutions OS. Ask your workspace admin to add Create Studio to your account."
        }
      />

    </AuthLayout>
  );
}
