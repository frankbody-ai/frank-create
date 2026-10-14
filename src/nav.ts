/**
 * The screens, in one place.
 *
 * Three of them (studio, prompt, upscaler) are states inside `App` — they share
 * its session and asset state, so routing between them is a mode change, not a
 * page change. The rest are their own routes. Both kinds sit in the same tab
 * menu, which is the point: the operator should not be able to tell which is
 * which.
 */

import type { OsAppTool, OsTab } from "autosolutions-os/nav";

export type Screen =
  | "studio"
  | "prompt"
  | "upscaler"
  | "admin"
  | "health"
  | "settings";

/** The screens that live inside `App` and switch by mode rather than by route. */
export const IN_APP_SCREENS = ["studio", "prompt", "upscaler"] as const;
export type InAppScreen = (typeof IN_APP_SCREENS)[number];

export function isInApp(screen: Screen): screen is InAppScreen {
  return (IN_APP_SCREENS as readonly string[]).includes(screen);
}

/**
 * Where each screen sits in the OS workspace frame, as the pathname plus query
 * the frame reads. The frame never sees the real URL: the screen comes from
 * this app's own hash router (and App's mode), and these are its names for it.
 * Settings is the rail footer's Settings; health is reachable by URL only.
 *
 * The studio's place carries its own mode, although its URL does not: the
 * tool is placed at the studio's place, and a bare "/" would claim every
 * place, so health would read as the studio's first tab and a click on
 * Studio from health would go nowhere. These places never reach the address
 * bar: a click goes through screenForPlace and then the hash router.
 */
const PLACES: Record<Screen, string> = {
  studio: "/?mode=studio",
  prompt: "/?mode=prompt",
  upscaler: "/?mode=upscaler",
  admin: "/admin",
  settings: "/settings",
  health: "/health",
};

/** Where the frame should show `screen`. */
export function placeFor(screen: Screen): string {
  return PLACES[screen];
}

/**
 * The location the frame is given for `screen`: its place, marked as the one
 * on show. The frame sends a click on the tab it already shows to that tab's
 * place unless the location is exactly that place. The old side nav ran every
 * click, the current item's too (Studio again reopens the run settings), so
 * the location is never exactly a place, and that click does what it did.
 * The mark sits in the query, where it changes no place the frame finds, and
 * it never reaches the address bar.
 *
 * `visit` numbers the location afresh when a click went nowhere (see Shell):
 * the same place under a new location, which takes the frame back from what
 * was clicked to the screen on show.
 */
export function frameLocation(screen: Screen, visit = 0): string {
  const place = PLACES[screen];
  return `${place}${place.includes("?") ? "&" : "?"}shown${visit ? `=${visit}` : ""}`;
}

/** The screen a frame destination names, or null for one this app does not have. */
export function screenForPlace(href: string): Screen | null {
  let url: URL;
  try {
    url = new URL(href, "http://studio.invalid");
  } catch {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") {
    const mode = url.searchParams.get("mode");
    return (IN_APP_SCREENS as readonly string[]).includes(mode || "") ? (mode as InAppScreen) : "studio";
  }
  const screen = (Object.keys(PLACES) as Screen[]).find((key) => PLACES[key] === path);
  return screen ?? null;
}

/**
 * The tool's views: the frame's third menu under Marketing > Creative >
 * Artificial Design Studio. Icons are NAV_ICONS glyph ids, which the frame
 * draws inline. Admin portal is last and shown to everyone, as before: the
 * page checks the role and keeps its own Users / Feedback / Prompt agent tabs.
 */
export const STUDIO_TABS: OsTab[] = [
  { id: "studio", label: "Studio", icon: "mkt-image-generator", path: PLACES.studio },
  { id: "prompt", label: "Prompt generator", icon: "agent", path: PLACES.prompt },
  { id: "upscaler", label: "Upscaler", icon: "ops-demand-plan", path: PLACES.upscaler },
  { id: "admin", label: "Admin portal", icon: "fin-approvals", path: PLACES.admin },
];

/** This app in the OS menu, by its menu-map id. */
export const STUDIO_TOOLS: OsAppTool[] = [
  { id: "image-generator", path: PLACES.studio, tabs: STUDIO_TABS },
];

/** Where a screen lives. */
export function hashFor(screen: Screen): string {
  if (isInApp(screen)) {
    return screen === "studio" ? "#/" : `#/?mode=${screen}`;
  }
  return `#/${screen}`;
}

export function navigate(screen: Screen): void {
  window.location.hash = hashFor(screen);
}

/**
 * The screen a URL resolves to. Reads the hash first and the pathname second,
 * because the app is served through an SPA rewrite and both forms reach it.
 */
/** Every path the app answers to. Anything else is a dead link, not the Studio. */
const KNOWN_ROUTES = [
  "", "/health", "/settings", "/admin", "/admin/feedback",
  "/.lovable/oauth/consent", "/oauth/consent",
];

export function resolveScreen(): { screen: Screen | "oauth" | "notfound" } {
  const pathname = window.location.pathname.replace(/\/$/, "");
  const rawHash = window.location.hash.replace(/^#/, "");
  const hashPath = (rawHash.split("?")[0] || "").replace(/\/$/, "");
  const at = (route: string) => hashPath === route || pathname === route;

  if (at("/.lovable/oauth/consent") || at("/oauth/consent"))
    return { screen: "oauth" };
  if (at("/health")) return { screen: "health" };
  if (at("/settings")) return { screen: "settings" };
  if (at("/admin") || at("/admin/feedback")) return { screen: "admin" };

  // A bookmark to a screen that has since been removed (the review board, the
  // cliff access checklist) used to land silently on Studio, which reads as a
  // broken app rather than a dead link.
  const claimed = rawHash ? hashPath : pathname;
  if (claimed && !KNOWN_ROUTES.includes(claimed)) return { screen: "notfound" };

  return { screen: modeFromUrl() };
}


/** Which of the three in-App screens the URL asks for. */
export function modeFromUrl(): InAppScreen {
  if (typeof window === "undefined") return "studio";
  const hashQuery = window.location.hash.split("?")[1] || "";
  const mode =
    new URLSearchParams(hashQuery).get("mode") ||
    new URLSearchParams(window.location.search).get("mode");
  return (IN_APP_SCREENS as readonly string[]).includes(mode || "")
    ? (mode as InAppScreen)
    : "studio";
}

/** Which tab the admin portal should open on. */
export function adminTabFromUrl(): string | null {
  const hashPath = (window.location.hash.replace(/^#/, "").split("?")[0] || "").replace(/\/$/, "");
  if (hashPath === "/admin/feedback") return "feedback";
  const hashQuery = window.location.hash.split("?")[1] || "";
  return new URLSearchParams(hashQuery).get("tab");
}
