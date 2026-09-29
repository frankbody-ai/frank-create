import React from "react";
import { OsWorkspaceFrame } from "autosolutions-os/frame";

import { Icon } from "./ds";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { ReleaseNotesModal } from "./components/ReleaseNotesModal";
import { hardSignOut, os } from "./lib/supabaseClient";
import { APP_KEY } from "./lib/coreConfig";
import { STUDIO_TOOLS, navigate, placeFor, screenForPlace } from "./nav";
import type { Screen } from "./nav";

export interface ShellProps {
  /** Which tab reads as current. */
  screen: Screen;
  /**
   * Called instead of a route change when the target screen lives inside `App`.
   * Only `App` passes this; everywhere else a menu click is a real navigation.
   */
  onSelectInApp?: (screen: Screen) => void;
  /** Top-bar search. Each screen filters its own primary list with this. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra controls in the top bar, before What's new and the company plate. */
  actions?: React.ReactNode;
  /** Rendered in the menu panel under the tool's tabs: the session organiser. */
  navExtra?: React.ReactNode;
  /**
   * Content column cap. 1000px for single-column reading views. Default
   * `var(--page-max-width)` (1260px), the old AppFrame's default.
   */
  maxWidth?: string;
  children?: React.ReactNode;
}

/** The frame opens with its menu closed on a phone-width screen. */
const NARROW = "(max-width: 767px)";

/**
 * The application shell: the AutoSolutions OS workspace frame every app on the
 * core wears (autosolutions-os/frame). The 56px bar with the OS lockup, the
 * search and the company plate; the rail (Hub, Finance, Marketing, Commercial,
 * Operations; Admin, Settings, Sign out at the foot); and, in the work area,
 * this app drilled open as Marketing > Creative > Artificial Design Studio,
 * its screens as the tool's tabs with the session organiser under them.
 *
 * The frame follows `screen`, which this app's hash router (and App's mode)
 * decides, and reports only clicks: a tab becomes the same mode change or
 * hash navigation the old side nav made. Other apps' tools, the rail's Hub and
 * Admin open in the same tab, through the catalogue.
 */
export function Shell({
  screen,
  onSelectInApp,
  search,
  onSearchChange,
  searchPlaceholder = "Search sessions and picks",
  actions,
  navExtra,
  maxWidth = "var(--page-max-width)",
  children,
}: ShellProps) {
  const [notesOpen, setNotesOpen] = React.useState(false);
  /* Read once: every route that renders the shell renders in the browser only. */
  const [narrow] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW).matches,
  );

  const go = (target: Screen) => {
    if (onSelectInApp) onSelectInApp(target);
    else navigate(target);
  };

  const signOut = () => {
    void hardSignOut().then(() => window.location.replace("/"));
  };

  /* The old AppFrame's cap took in its own gutters, which the frame's sheet
     padding now replaces, so the column keeps the content width it had. */
  const column = { maxWidth: `calc(${maxWidth} - 2 * var(--page-gutter))` };

  return (
    <OsWorkspaceFrame
      os={os}
      appKey={APP_KEY}
      tools={STUDIO_TOOLS}
      location={placeFor(screen)}
      onNavigate={(href) => {
        const target = screenForPlace(href);
        if (target) go(target);
      }}
      /* The frame always draws the search box, so it stays controlled on every
         render: a screen that adds its search after a first render (AdminPortal,
         once it knows the role) must not switch the input from uncontrolled to
         controlled. A screen without search keeps the frame's own "Search". */
      search={{
        placeholder: onSearchChange ? searchPlaceholder : undefined,
        value: search ?? "",
        onChange: onSearchChange,
      }}
      actions={
        <>
          {actions}
          <button
            type="button"
            className="as-topbar__target"
            aria-label="What's new"
            title="What's new"
            onClick={() => setNotesOpen(true)}
          >
            <Icon source="sparkles" size={20} tone="inherit" />
          </button>
        </>
      }
      companySwitch="os"
      panelFooter={navExtra == null ? undefined : <div className="studio-panel-extra">{navExtra}</div>}
      onSignOut={signOut}
      settingsPath={placeFor("settings")}
      {...(narrow ? { initialOpen: false } : {})}
    >
      <div className="studio-page" style={column}>
        {children}
        <FeedbackWidget variant="fixed" />
        <ReleaseNotesModal forceOpen={notesOpen} onClose={() => setNotesOpen(false)} />
      </div>
    </OsWorkspaceFrame>
  );
}
