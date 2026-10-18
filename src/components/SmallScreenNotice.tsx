import { useId } from "react";

import { Text } from "../ds";

/**
 * Below 1024px the studio's screens do not lay out yet. The frame stays at
 * every width, as in every other app (the bar, the rail and the menus, the
 * menu closed at start on a phone), and this notice takes the page's place
 * in the work sheet: Shell renders it next to the page, and app.css shows it
 * and hides the page below 1024px. Keep that mechanism: it is CSS, so it
 * works before any JS measures anything.
 */
export function SmallScreenNotice() {
  const title = useId();
  return (
    <section className="small-screen" aria-labelledby={title}>
      <div className="small-screen__card">
        <span className="as-app as-app--design-studio" role="img" aria-label="art-ificial design studio" />
        <Text variant="headingLg" as="h2" id={title}>
          Open this on a desktop
        </Text>
        <Text tone="secondary" as="p">
          The studio is a dense console — it needs a screen wider than 1024px to lay out the
          composer, the rounds feed and the run settings side by side. Tablet and phone layouts
          aren't built yet.
        </Text>
        <span className="as-logo small-screen__logo" role="img" aria-label="AutoSolutions OS" />
      </div>
    </section>
  );
}
