/**
 * The screens, in one place.
 *
 * Three of them (studio, prompt, upscaler) are states inside `App` — they share
 * its session and asset state, so routing between them is a mode change, not a
 * page change. The rest are their own routes. Both kinds sit in the same side
 * nav, which is the point: the operator should not be able to tell which is
 * which.
 */

export type Screen =
  | "studio"
  | "prompt"
  | "upscaler"
  | "admin"
  | "health"
  | "settings";

export interface NavEntry {
  id: Screen;
  label: string;
  /** 20px icon name from the design system's set. */
  icon: string;
}

/** The screens that live inside `App` and switch by mode rather than by route. */
export const IN_APP_SCREENS = ["studio", "prompt", "upscaler"] as const;
export type InAppScreen = (typeof IN_APP_SCREENS)[number];

export function isInApp(screen: Screen): screen is InAppScreen {
  return (IN_APP_SCREENS as readonly string[]).includes(screen);
}

export const NAV_MAIN: NavEntry[] = [
  { id: "studio", label: "Studio", icon: "bolt" },
  { id: "prompt", label: "Prompt generator", icon: "chat-bubble-left-right" },
  { id: "upscaler", label: "Upscaler", icon: "arrow-trending-up" },
];


export const NAV_FOOTER: NavEntry[] = [
  { id: "admin", label: "Admin portal", icon: "shield-check" },
  // App health stays reachable at /health, but it is not a nav destination.
  { id: "settings", label: "Settings", icon: "cog-6-tooth" },
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
const KNOWN_ROUTES = ["", "/health", "/settings", "/admin", "/admin/feedback", "/.lovable/oauth/consent"];

export function resolveScreen(): { screen: Screen | "oauth" | "notfound" } {
  const pathname = window.location.pathname.replace(/\/$/, "");
  const rawHash = window.location.hash.replace(/^#/, "");
  const hashPath = (rawHash.split("?")[0] || "").replace(/\/$/, "");
  const at = (route: string) => hashPath === route || pathname === route;

  if (at("/.lovable/oauth/consent")) return { screen: "oauth" };
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
