import React from "react";

import { AppFrame, Icon, SideNav, TopBar } from "./ds";
import { FeedbackWidget } from "./components/FeedbackWidget";
import { hardSignOut } from "./lib/supabaseClient";
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
  /** Session the review board should open. */
  sessionId?: string | null;
  /** Count beside the Approved item. Omitted when zero. */
  approvedCount?: number;
  /** Top-bar search. Each screen filters its own primary list with this. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Extra controls inserted into the top bar before feedback and sign out. */
  actions?: React.ReactNode;
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
  sessionId,
  approvedCount,
  search,
  onSearchChange,
  searchPlaceholder = "Search sessions and picks",
  actions,
  maxWidth,
  children,
}: ShellProps) {
  const go = (id: string) => {
    const target = id as Screen;
    if (onSelectInApp) onSelectInApp(target);
    else navigate(target, sessionId);
  };

  const toItem = (entry: (typeof NAV_MAIN)[number]): SideNavItem => ({
    id: entry.id,
    label: entry.label,
    icon: entry.icon,
    badge: entry.id === "approved" && approvedCount ? approvedCount : undefined,
  });

  return (
    <AppFrame
      maxWidth={maxWidth}
      topBar={
        <TopBar
          company="frankbody"
          companyName="frank body"
          showSearch={onSearchChange != null}
          searchPlaceholder={searchPlaceholder}
          searchValue={search ?? ""}
          onSearchChange={onSearchChange}
          actions={
            <>
              {actions}
              <FeedbackWidget variant="inline" />
            </>
          }
        />
      }
      navigation={
        <SideNav
          app="design-studio"
          appName="art-ificial design studio"
          items={NAV_MAIN.map(toItem)}
          footerItems={NAV_FOOTER.map(toItem)}
          selected={screen}
          onSelect={go}
          footer={
            <button
              type="button"
              className="as-nav__item"
              onClick={() => {
                void hardSignOut().then(() => window.location.replace("/"));
              }}
            >
              <Icon source="power" size={20} />
              <span className="as-nav__label">Sign out</span>
            </button>
          }
        />
      }

    >
      {children}
    </AppFrame>
  );
}
