import React, { useCallback, useEffect, useState } from "react";
import { Banner, Button, Card, Spinner, Text } from "../ds";
import { supabase } from "../lib/supabaseClient";
import { lovable } from "../lib/lovableAuth";

type ClientInfo = { name?: string | null; client_id?: string | null } | null;

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function oauthApi(): OAuthApi {
  const api = (supabase.auth as unknown as { oauth?: OAuthApi }).oauth;
  if (!api) throw new Error("This backend does not expose the OAuth authorization API.");
  return api;
}

function authorizationIdFromUrl(): string {
  const search = new URLSearchParams(window.location.search);
  const fromSearch = search.get("authorization_id");
  if (fromSearch) return fromSearch;
  const hash = window.location.hash.replace(/^#/, "");
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
  return new URLSearchParams(query).get("authorization_id") ?? "";
}

type Phase = "loading" | "signed-out" | "ready" | "error";

export function OAuthConsentPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [client, setClient] = useState<ClientInfo>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const authorizationId = authorizationIdFromUrl();

  const load = useCallback(async () => {
    if (!authorizationId) {
      setError("This link is missing an authorization request id.");
      return setPhase("error");
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return setPhase("signed-out");
    try {
      const { data, error: detailsError } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (detailsError) {
        setError(detailsError.message);
        return setPhase("error");
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setClient(data?.client ?? null);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [authorizationId]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) void load();
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signIn = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.href,
      extraParams: { prompt: "select_account" },
    });
    if (result?.error) setError(result.error.message);
  };

  const decide = async (approve: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const api = oauthApi();
      const { data, error: decisionError } = approve
        ? await api.approveAuthorization(authorizationId)
        : await api.denyAuthorization(authorizationId);
      if (decisionError) {
        setBusy(false);
        return setError(decisionError.message);
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        return setError("The authorization server did not return a redirect.");
      }
      window.location.href = target;
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const clientName = client?.name ?? "this app";

  return (
    <main className="consent">
      <div className="consent__card">
        <span className="as-logo consent__logo" role="img" aria-label="AutoSolutions OS" />
        <Card>
          {phase === "loading" ? (
            <div className="consent__loading">
              <Spinner size="small" />
              <Text tone="secondary">Loading the authorization request</Text>
            </div>
          ) : null}

          {phase === "signed-out" ? (
            <div className="consent__body">
              <Text variant="headingLg" as="h1">
                Sign in to continue
              </Text>
              <Text tone="secondary" as="p">
                Sign in to approve access for the app requesting your studio data.
              </Text>
              <Button variant="primary" fullWidth onClick={signIn}>
                Continue with Google
              </Button>
            </div>
          ) : null}

          {phase === "ready" ? (
            <div className="consent__body">
              <Text variant="headingLg" as="h1">
                Connect {clientName}
              </Text>
              <Text tone="secondary" as="p">
                {clientName} is asking to use art-ificial design studio as you. It will be able to
                read your sessions and generated assets, change asset approvals, and file feedback on
                your behalf.
              </Text>
              <div className="consent__actions">
                <Button disabled={busy} onClick={() => decide(false)}>
                  Deny access
                </Button>
                <Button variant="primary" loading={busy} onClick={() => decide(true)}>
                  Approve access
                </Button>
              </div>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="consent__body">
              <Text variant="headingLg" as="h1">
                Authorization unavailable
              </Text>
              <Text tone="secondary" as="p">
                This request couldn't be loaded. It may have expired — start the connection again
                from the app you were using.
              </Text>
            </div>
          ) : null}

          {error ? (
            <Banner tone="critical" title="Something went wrong">
              <span>{error}</span>
            </Banner>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
