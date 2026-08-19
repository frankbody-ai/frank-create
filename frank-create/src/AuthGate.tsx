import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isAllowedEmail, ALLOWED_EMAIL_DOMAINS, hardSignOut } from "./lib/supabaseClient";
import { lovable } from "./lib/lovableAuth";
import { getMyAccessState } from "./lib/admin";
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
      if (!isAllowedEmail(email)) {
        await hardSignOut();
        setError(`Access is for ${ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(" and ")} accounts only. (${email ?? "no email"})`);
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result?.error) {
      setBusy(false);
      setError(result.error.message || "Sign-in didn't work. Try again.");
    }
  };

  const signOut = async () => {
    await hardSignOut();
    window.location.replace("/");
  };

  if (status === "ready" && session) return <>{children}</>;

  return (
    <AuthLayout>
      <SignIn
        company="frankbody"
        companyName="frank body"
        app="design-studio"
        appName="art-ificial design studio"
        method="sso"
        title="Sign in"
        description="Sign in with your work account."
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
        note={`Access is limited to ${ALLOWED_EMAIL_DOMAINS.map((d) => d).join(" and ")}. Accounts are created by an admin — ask your team lead if you need access.`}
      />
    </AuthLayout>
  );
}
