import React from "react";

import { CubeWaves } from "autosolutions-design-system";

import { Banner } from "../ds";

/**
 * Cliff's sign-in card from the final design (user decision of 2026-10-14),
 * look only. A white card on the brand background: an image panel (the
 * design system's cube waves, 6.6.0), then the "AutoSolutions |
 * OS" lockup, the heading, the error, the providers and the note.
 *
 * It takes the props the design system's SignIn took from AuthGate (title,
 * description, error, providers, note), so the sign-in, its provider and
 * redirect, the messages and the gating stay in AuthGate exactly as they
 * were. It is a form, as that card was, and a submit does nothing, as there.
 * Its own class names keep the older .as-auth card rules of both design
 * system copies off it.
 */
export interface SignInCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  providers?: React.ReactNode;
  note?: React.ReactNode;
}

/** The whole page behind the card: the design's brand background. */
export function SignInPage({ children }: { children: React.ReactNode }) {
  return <div className="studio-signin-page">{children}</div>;
}

export function SignInCard({ title, description, error, providers, note }: SignInCardProps) {
  return (
    <form className="studio-signin" onSubmit={(event) => event.preventDefault()}>
      <CubeWaves className="studio-signin__media" />

      <div className="studio-signin__body">
        <div className="studio-signin__brand">
          <span className="studio-signin__os" role="img" aria-label="AutoSolutions OS" />
        </div>

        <div className="studio-signin__head">
          <h1 className="studio-signin__title">{title}</h1>
          {description && <p className="studio-signin__description">{description}</p>}
        </div>

        {error && <Banner tone="critical">{error}</Banner>}

        {providers && <div className="studio-signin__providers">{providers}</div>}

        <div className="studio-signin__foot">{note && <p className="studio-signin__note">{note}</p>}</div>
      </div>
    </form>
  );
}
