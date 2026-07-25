import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isAllowedEmail, ALLOWED_EMAIL_DOMAINS, hardSignOut } from "./lib/supabaseClient";
import { lovable } from "./lib/lovableAuth";
import frankCreateLogo from "./assets/frank-create.png";


type Status = "loading" | "signed-out" | "denied" | "ready";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="frank-auth-wrap">
      <div className="frank-auth-card">
        <img src={frankCreateLogo} alt="frank create" className="frank-auth-logo" />

        <p className="frank-auth-tagline">THE ART DEPT.</p>
        <h1 className="frank-auth-title">Hey babe.</h1>
        <p className="frank-auth-sub">
          sign in with your frank body or autosolutions google account.
        </p>
        {status === "loading" && <p className="frank-auth-muted">Checking session.</p>}
        {(status === "signed-out" || status === "denied") && (
          <button onClick={signIn} className="frank-auth-btn">
            Continue with Google.
          </button>
        )}
        {status === "denied" && (
          <button onClick={signOut} className="frank-auth-link">
            use a different account.
          </button>
        )}
        {error && <p className="frank-auth-err">{error}</p>}
        <p className="frank-auth-foot">
          allowed domains: {ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", ")}
        </p>
      </div>
    </div>
  );
}
