import React from "react";

import { Button } from "../ds";

/** Opens the release notes the Shell keeps (its ReleaseNotesModal). */
export const WhatsNewContext = React.createContext<(() => void) | null>(null);

/**
 * "What's new", in a page header's actions. It sat in the top bar until
 * autosolutions-os 0.3.2, whose bar is the Hub's in every app (the logo, the
 * search and the company plate, nothing else); it opens the same release
 * notes as before. Outside a Shell there are no notes to open, and it draws
 * nothing.
 */
export function WhatsNewButton() {
  const open = React.useContext(WhatsNewContext);
  if (!open) return null;
  return (
    <Button icon="sparkles" onClick={open}>
      What's new
    </Button>
  );
}
