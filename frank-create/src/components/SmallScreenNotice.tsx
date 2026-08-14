import React from "react";

import { Text } from "../ds";

/**
 * The gate itself is CSS: this always renders, and app.css shows it below
 * 1024px while hiding every sibling of #root. Keep that mechanism — it is what
 * makes the gate work before any JS measures anything.
 */
export function SmallScreenNotice() {
  return (
    <div className="small-screen" role="dialog" aria-modal="true" aria-live="polite">
      <div className="small-screen__card">
        <span className="as-app as-app--design-studio" role="img" aria-label="art-ificial design studio" />
        <Text variant="headingLg" as="h2">
          Open this on a desktop
        </Text>
        <Text tone="secondary" as="p">
          The studio is a dense console — it needs a screen wider than 1024px to lay out the
          composer, the rounds feed and the run settings side by side. Tablet and phone layouts
          aren't built yet.
        </Text>
        <span className="as-logo small-screen__logo" role="img" aria-label="AutoSolutions OS" />
      </div>
    </div>
  );
}
