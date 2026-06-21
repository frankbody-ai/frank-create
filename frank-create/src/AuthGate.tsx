import React, { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isAllowedEmail, ALLOWED_EMAIL_DOMAINS } from "./lib/supabaseClient";
import { lovable } from "./lib/lovableAuth";


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
        await supabase.auth.signOut();
        setError(`Access is restricted to ${ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(" and ")} accounts. (${email ?? "no email"})`);
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
    if (result.error) setError(result.error.message || "Sign-in failed");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (status === "ready" && session) return <>{children}</>;

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <h1 style={styles.title}>Frank Create</h1>
        <p style={styles.sub}>
          Sign in with your Frank Body or Autosolutions Google account to continue.
        </p>
        {status === "loading" && <p style={styles.muted}>Checking session…</p>}
        {(status === "signed-out" || status === "denied") && (
          <button onClick={signIn} style={styles.btn}>
            Continue with Google
          </button>
        )}
        {status === "denied" && (
          <button onClick={signOut} style={styles.linkBtn}>
            Use a different account
          </button>
        )}
        {error && <p style={styles.err}>{error}</p>}
        <p style={styles.foot}>
          Allowed domains: {ALLOWED_EMAIL_DOMAINS.map((d) => "@" + d).join(", ")}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "#f5f5f5", fontFamily: "system-ui, sans-serif", padding: 24 },
  card: { maxWidth: 420, width: "100%", background: "#161616", border: "1px solid #262626", borderRadius: 16, padding: 32, textAlign: "center" },
  title: { margin: 0, fontSize: 28, letterSpacing: -0.5 },
  sub: { color: "#a3a3a3", marginTop: 8, marginBottom: 24, lineHeight: 1.5 },
  btn: { width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #fff", background: "#fff", color: "#000", fontWeight: 600, cursor: "pointer" },
  linkBtn: { marginTop: 12, background: "transparent", color: "#a3a3a3", border: "none", cursor: "pointer", textDecoration: "underline" },
  err: { marginTop: 16, color: "#fca5a5", fontSize: 14 },
  muted: { color: "#737373" },
  foot: { marginTop: 24, fontSize: 12, color: "#525252" },
};
