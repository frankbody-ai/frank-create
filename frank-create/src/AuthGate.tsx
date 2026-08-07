import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isAllowedEmail, ALLOWED_EMAIL_DOMAINS, hardSignOut } from "./lib/supabaseClient";
import { lovable } from "./lib/lovableAuth";
import designStudioLogo from "./assets/ds/art-ificial-design-studio.svg";


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
    <div className="signin-shell">
      <div className="signin-plate">
        {motionOk && (
          <video
            aria-hidden="true"
            className="signin-video"
            src="/media/signin.mp4"
            poster="/media/signin-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        )}
        <div aria-hidden="true" className="signin-veil" />
        <div aria-hidden="true" className="signin-gradient" />
        <div aria-hidden="true" className="signin-glow" />

        <div className="signin-stack">
          <div className="signin-lockup">
            <img
              src="/brand/autosolutions-os-magenta.png"
              alt="autosolutions OS"
              className="signin-brand"
            />
            <div className="signin-name">art-ificial studio</div>
            <div className="signin-kicker">THE UNMARKED GROUP</div>
          </div>

          <div className="signin-card">
            <div className="signin-card-head">
              <h1 className="signin-card-title">Sign in</h1>
              <p className="signin-card-sub">
                use your frank body or autosolutions google account.
              </p>
            </div>

            {status === "loading" && <p className="signin-muted">Checking session.</p>}

            {(status === "signed-out" || status === "denied") && (
              <button onClick={signIn} className="signin-primary">
                Continue with Google
              </button>
            )}

            {status === "denied" && (
              <button onClick={signOut} className="signin-secondary">
                use a different account
              </button>
            )}

            {error && <p className="signin-err">{error}</p>}

            <p className="signin-foot">
              allowed domains: {ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", ")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

