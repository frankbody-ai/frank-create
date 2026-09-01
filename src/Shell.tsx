import React from "react";

import { AppFrame, SideNav, TopBar } from "./ds";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { ReleaseNotesModal } from "./components/ReleaseNotesModal";
import { hardSignOut, os } from "./lib/supabaseClient";
import { OsAppSwitcherPlate, OsCompanySwitcher } from "./os-chrome/os-chrome";
import { APP_KEY } from "./lib/coreConfig";
import type { SideNavItem } from "./ds";
import { NAV_FOOTER, NAV_MAIN, navigate } from "./nav";
import type { Screen } from "./nav";

export interface ShellProps {
  /** Which nav item reads as current. */
  screen: Screen;
  /**
   * Called instead of a route change when the target screen lives inside `App`.
   * Only `App` passes this — everywhere else a nav click is a real navigation.
   */
  onSelectInApp?: (screen: Screen) => void;
  /** Top-bar search. Each screen filters its own primary list with this. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra controls inserted into the top bar before feedback and sign out. */
  actions?: React.ReactNode;
  /** Panel rendered inside the side nav under the main items — the session organiser. */
  navExtra?: React.ReactNode;
  /** Content column cap. 1000px for single-column reading views. */
  maxWidth?: string;
  children?: React.ReactNode;
}

/**
 * The application shell: 56px inverse top bar, 240px side nav, and a content
 * region rounded on its top-left corner so it reads as raised off the nav.
 *
 * The top bar carries the AutoSolutions OS lockup and, on the right, the frank
 * body mark — the product is AutoSolutions, frank body is the tenant inside it.
 * There is no company switcher and no notification bell: this app has one tenant
 * and no notification backend, and an absent control is better than a dead one.
 */
export function Shell({
  screen,
  onSelectInApp,
  search,
  onSearchChange,
  searchPlaceholder = "Search sessions and picks",
  actions,
  navExtra,
  maxWidth,
  children,
}: ShellProps) {
  const [notesOpen, setNotesOpen] = React.useState(false);

  const go = (id: string) => {
    if (id === "signout") {
      void hardSignOut().then(() => window.location.replace("/"));
      return;
    }
    const target = id as Screen;
    if (onSelectInApp) onSelectInApp(target);
    else navigate(target);
  };

  const toItem = (entry: (typeof NAV_MAIN)[number]): SideNavItem => ({
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    badge: undefined,
  });

  return (
    <AppFrame
      maxWidth={maxWidth}
      topBar={
        <TopBar
          showSearch={onSearchChange != null}
          searchPlaceholder={searchPlaceholder}
          searchValue={search ?? ""}
          onSearchChange={onSearchChange}
          leading={<OsAppSwitcherPlate client={os} appKey={APP_KEY} />}
          actions={
            <>
              {actions}
              {/* The company switcher stays in the right cluster; the app
                  switcher lives beside the lockup on the left. */}
              <OsCompanySwitcher client={os} appKey={APP_KEY} />
            </>
          }

        />
      }
      navigation={
        <SideNav
          app="design-studio"
          appName="art-ificial design studio"
          items={NAV_MAIN.map(toItem)}
          extra={navExtra}
          footerItems={[
            { id: "whats-new", label: "What's new", icon: "sparkles" },
            ...NAV_FOOTER.map(toItem),
            { id: "signout", label: "Sign out", icon: "power" },
          ]}
          selected={screen}
          onSelect={(id) => {
            if (id === "whats-new") {
              setNotesOpen(true);
              return;
            }
            go(id);
          }}
        />
      }


    >
      {children}
      <FeedbackWidget variant="fixed" />
      <ReleaseNotesModal forceOpen={notesOpen} onClose={() => setNotesOpen(false)} />

    </AppFrame>
  );
}
