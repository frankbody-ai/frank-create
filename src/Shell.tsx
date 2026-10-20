import React from "react";
import { myAdminScope } from "autosolutions-os";
import { OsWorkspaceFrame } from "autosolutions-os/frame";

import { FeedbackWidget } from "./components/FeedbackWidget";
import { ReleaseNotesModal } from "./components/ReleaseNotesModal";
import { SmallScreenNotice } from "./components/SmallScreenNotice";
import { WhatsNewContext } from "./components/WhatsNewButton";
import { hardSignOut, os } from "./lib/supabaseClient";
import { APP_KEY } from "./lib/coreConfig";
import { STUDIO_TOOLS, frameLocation, linkFor, navigate, resolveScreen, screenForPlace } from "./nav";
import type { Screen } from "./nav";

export interface ShellProps {
  /** Which tab reads as current. */
  screen: Screen;
  /**
   * Called instead of a route change when the target screen lives inside `App`.
   * Only `App` passes this; everywhere else a menu click is a real navigation.
   */
  onSelectInApp?: (screen: Screen) => void;
  /**
   * Top-bar search. Each screen that has one filters its own primary list
   * with this; a screen without one gets the OS menu search. The field reads
   * "Search" on every screen, as the Hub's does; `searchLabel` is its
   * accessible name, which says what this screen searches.
   */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchLabel?: string;
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

/** The bar's field, in every app as in the Hub (owner's rule: one bar everywhere). */
const SEARCH = "Search";

/**
 * The design system names the bar's field by its placeholder, which is
 * "Search" on every screen. A screen with a search of its own gives the field
 * back the name that says what it searches, once the bar is drawn; the OS
 * menu search keeps "Search". The bar is found from the page column, as the
 * list fitting below finds it.
 */
function useSearchFieldName(column: React.RefObject<HTMLDivElement | null>, name: string) {
  React.useEffect(() => {
    const field = column.current
      ?.closest(".as-frame")
      ?.querySelector<HTMLInputElement>(":scope > .as-topbar .as-topbar__search input");
    if (field && field.getAttribute("aria-label") !== name) field.setAttribute("aria-label", name);
  });
}

/**
 * Lists a page opens upward from its own control: the brief's @ reference
 * list. The frame's work sheet clips at its top edge, 27px under the bar,
 * where the old page ran on to the top of the document, so a long list lost
 * its first rows sooner. One that would pass the edge (or the sticky bar,
 * once the document has scrolled the edge under it) keeps to the room above
 * it, less this gap, and scrolls in itself, as it does past its own 240px,
 * keeping its scroll position and the keyboard's highlighted row in view; a
 * list that fits is left exactly as it is.
 */
const UPWARD_LISTS = ".prompt-mention-popover";
const UPWARD_GAP = 8;

function useListsInsideSheet(column: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const root = column.current;
    if (!root || typeof MutationObserver === "undefined") return undefined;
    const fit = () => {
      const lists = root.querySelectorAll<HTMLElement>(UPWARD_LISTS);
      const sheet = lists.length ? root.closest(".as-frame__content") : null;
      if (!sheet) return;
      const bar = sheet.closest(".as-frame")?.querySelector(":scope > .as-topbar");
      const edge =
        Math.max(sheet.getBoundingClientRect().top, bar ? bar.getBoundingClientRect().bottom : 0) +
        UPWARD_GAP;
      for (const list of lists) {
        /* Measuring at full height drops the list's own scroll position;
           put it back, so a page update never moves a list being read. */
        const scrolled = list.scrollTop;
        list.style.maxHeight = "";
        const box = list.getBoundingClientRect();
        if (box.top < edge) list.style.maxHeight = `${Math.max(0, Math.floor(box.bottom - edge))}px`;
        list.scrollTop = scrolled;
      }
    };
    /* The arrow keys move the page's highlight (its class). The full list
       showed every row, so a shortened one scrolls the highlighted row into
       view when the highlight moves, and only then. */
    const follow = (records: MutationRecord[]) => {
      for (const record of records) {
        const row = record.target as HTMLElement;
        if (record.type !== "attributes" || !row.classList.contains("is-active")) continue;
        const list = row.closest<HTMLElement>(UPWARD_LISTS);
        if (!list || !list.style.maxHeight) continue;
        const top = row.offsetTop;
        const bottom = top + row.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      }
    };
    /* The list opens, fills and empties as the brief is typed; the page
       above it moves when a notice comes or goes. */
    const watch = new MutationObserver((records) => {
      fit();
      follow(records);
    });
    watch.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, [column]);
}

/**
 * Whether this person manages anything, which shows Admin at the foot of the
 * rail. Studio, Settings, Admin portal and Health each mount their own Shell,
 * so a frame left to ask the core itself asked again on every change between
 * them and drew the rail without Admin until the answer came. The core is
 * asked once per page, as the frame's company context is, and the answer is
 * handed to every frame; a failure is not kept, so the next screen asks again.
 * Until the first answer the rail has no Admin row, as before.
 */
let managesAnswer: boolean | undefined;
let managesAsk: Promise<boolean> | null = null;

function askManages(): Promise<boolean> {
  if (!managesAsk) {
    managesAsk = myAdminScope(os).then(
      (scope) => (managesAnswer = scope.isPlatformAdmin || scope.managesTenants.length > 0),
      () => {
        managesAsk = null;
        return false;
      },
    );
  }
  return managesAsk;
}

function useManages(): boolean {
  const [manages, setManages] = React.useState(() => managesAnswer ?? false);
  React.useEffect(() => {
    if (managesAnswer !== undefined) return undefined;
    let live = true;
    void askManages().then((answer) => {
      if (live) setManages(answer);
    });
    return () => {
      live = false;
    };
  }, []);
  return manages;
}

/**
 * The application shell: the AutoSolutions OS workspace frame every app on the
 * core wears (autosolutions-os/frame). The 56px bar with the OS lockup, the
 * search and the company plate with its chevron, as the Hub's bar; the rail
 * (Hub, Finance, Marketing, Commercial, Operations; Admin, Settings, Sign out
 * at the foot); and the menu panel opened on this app, Marketing > Creative >
 * Image generator: the tool's icon and name, then its screens as the
 * tool's tabs, Settings last, the session organiser under them.
 *
 * The frame follows `screen`, which this app's hash router (and App's mode)
 * decides, and reports only clicks: a tab, the one already shown included,
 * becomes the same mode change or hash navigation the old side nav made.
 * The tabs and the tool's row are links to each screen's address (linkFor),
 * as in the Hub, so a middle-click, a Cmd or Ctrl click and Copy link open
 * that screen; a plain click still goes through the hash router. The rail's
 * Hub opens the Hub panel; its rows, other apps' tools, Admin and the rail's
 * Settings (the Hub's settings, autosolutions-os 0.3.2) open in the same tab.
 *
 * Nothing goes in the bar's actions: "What's new" is in each page's header
 * (WhatsNewButton), and opens the release notes kept here.
 */
export function Shell({
  screen,
  onSelectInApp,
  search,
  onSearchChange,
  searchLabel = "Search sessions and picks",
  navExtra,
  maxWidth = "var(--page-max-width)",
  children,
}: ShellProps) {
  const [notesOpen, setNotesOpen] = React.useState(false);
  const openNotes = React.useCallback(() => setNotesOpen(true), []);
  /* Read once: every route that renders the shell renders in the browser only. */
  const [narrow] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW).matches,
  );
  const columnRef = React.useRef<HTMLDivElement>(null);
  useListsInsideSheet(columnRef);
  useSearchFieldName(columnRef, onSearchChange ? searchLabel : SEARCH);
  const manages = useManages();
  const [visit, setVisit] = React.useState(0);

  const go = (target: Screen) => {
    if (onSelectInApp) {
      onSelectInApp(target);
      return;
    }
    navigate(target);
    /* On a page opened by its path (/settings, /admin, /health) the hash
       router keeps that page whatever the hash says, so the click went
       nowhere, as it did under the old side nav, which stayed on the page
       shown. The frame has already moved to what was clicked: a new visit
       to the same place takes it back to the page on show. */
    if (resolveScreen().screen !== target) setVisit((count) => count + 1);
  };

  const signOut = () => {
    void hardSignOut().then(() => window.location.replace("/"));
  };

  /* The old AppFrame's cap took in its own gutters, which the frame's sheet
     padding now replaces, so the column keeps the content width it had. */
  const column = { maxWidth: `calc(${maxWidth} - 2 * var(--page-gutter))` };

  return (
    <OsWorkspaceFrame
      /* The tab keeps the AutoSolutions icon from the page head, not the
         menu glyph (owner's choice, 2026-10-17). */
      favicon={false}
      os={os}
      appKey={APP_KEY}
      tools={STUDIO_TOOLS}
      location={frameLocation(screen, visit)}
      onNavigate={(href) => {
        const target = screenForPlace(href);
        if (target) go(target);
      }}
      hrefFor={linkFor}
      /* A screen that searches keeps its own search in the bar; on any other
         screen the bar's field is the OS menu search (autosolutions-os 0.3.2).
         Either way the field reads "Search", the Hub's word.
         The value stays controlled on every render, so a screen that adds its
         search after a first render (AdminPortal, once it knows the role)
         never switches the input from uncontrolled to controlled. */
      search={{
        placeholder: onSearchChange ? SEARCH : undefined,
        value: search ?? "",
        onChange: onSearchChange,
      }}
      companySwitch="os"
      panelFooter={navExtra == null ? undefined : <div className="studio-panel-extra">{navExtra}</div>}
      onSignOut={signOut}
      admin={manages}
      {...(narrow ? { initialOpen: false } : {})}
    >
      <WhatsNewContext.Provider value={openNotes}>
        <div className="studio-page" style={column} ref={columnRef}>
          {/* Below 1024px the sheet shows the notice in the page's place
              (app.css); the frame around it stays, as in every app. */}
          <SmallScreenNotice />
          <div className="studio-page__screen">{children}</div>
          <FeedbackWidget variant="fixed" />
          <ReleaseNotesModal forceOpen={notesOpen} onClose={() => setNotesOpen(false)} />
        </div>
      </WhatsNewContext.Provider>
    </OsWorkspaceFrame>
  );
}
