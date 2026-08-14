import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isAllowedEmail, ALLOWED_EMAIL_DOMAINS, hardSignOut } from "./lib/supabaseClient";
import { lovable } from "./lib/lovableAuth";
import { Button, Spinner, Text } from "./ds";


type Status = "loading" | "signed-out" | "denied" | "ready";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Off until we know the user hasn't asked for reduced motion / data saving —
  // the poster is a faithful still of the clip either way.
  const [motionOk, setMotionOk] = useState(false);

  useEffect(() => {
    const saveData = Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    );
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotionOk(!query.matches && !saveData);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);


  useEffect(() => {
    let mounted = true;

    const evaluate = async (s: Session | null) => {
      if (!mounted) return;
      setSession(s);
      if (!s) return setStatus("signed-out");
      const email = s.user?.email;
      if (!isAllowedEmail(email)) {
        await hardSignOut();
        setError(`access is for ${ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(" and ")} accounts only. (${email ?? "no email"})`);
        return setStatus("denied");
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
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result?.error) {
      setError(result.error.message || "sign-in didn't work. try again, babe.");
    }
  };

  const signOut = async () => {
    await hardSignOut();
    window.location.replace("/");
  };

  if (status === "ready" && session) return <>{children}</>;

  return (
    <div className="signin">
      {motionOk && (
        <video
          aria-hidden="true"
          className="signin__video"
          src="/media/signin.mp4"
          poster="/media/signin-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}
      <div aria-hidden="true" className="signin__scrim" />

      <div className="signin__stack">
        <div className="signin__lockup">
          {/* The lockup carries the group line; it is part of the artwork. */}
          <span className="as-logo signin__logo" role="img" aria-label="AutoSolutions OS" />
          <span className="as-app as-app--design-studio" role="img" aria-label="art-ificial design studio" />
        </div>

        <div className="signin__card">
          <Text variant="headingLg" as="h1">
            Sign in
          </Text>
          <Text variant="bodyMd" tone="secondary" as="p">
            Use your frank body or AutoSolutions Google account.
          </Text>

          {status === "loading" ? (
            <div className="signin__loading">
              <Spinner size="small" />
              <Text variant="bodySm" tone="secondary">
                Checking your session
              </Text>
            </div>
          ) : null}

          {status === "signed-out" || status === "denied" ? (
            <Button variant="primary" fullWidth onClick={() => void signIn()}>
              Continue with Google
            </Button>
          ) : null}

          {status === "denied" ? (
            <Button fullWidth onClick={() => void signOut()}>
              Use a different account
            </Button>
          ) : null}

          {error ? (
            <p className="signin__error" role="alert">
              {error}
            </p>
          ) : null}

          <Text variant="bodySm" tone="secondary" as="p">
            Allowed domains: {ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", ")}
          </Text>
        </div>
      </div>
    </div>
  );
}
