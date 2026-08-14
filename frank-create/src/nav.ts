/**
 * The nine screens, in one place.
 *
 * Five of them (studio, prompt, upscaler, presets, approved) are states inside
 * `App` — they share its session and asset state, so routing between them is a
 * mode change, not a page change. The other four are their own routes. Both
 * kinds sit in the same side nav, which is the point: the operator should not
 * be able to tell which is which.
 */

export type Screen =
  | "studio"
  | "prompt"
  | "upscaler"
  | "presets"
  | "approved"
  | "review"
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
export const IN_APP_SCREENS = ["studio", "prompt", "upscaler", "presets", "approved"] as const;
export type InAppScreen = (typeof IN_APP_SCREENS)[number];

export function isInApp(screen: Screen): screen is InAppScreen {
  return (IN_APP_SCREENS as readonly string[]).includes(screen);
}

export const NAV_MAIN: NavEntry[] = [
  { id: "studio", label: "Studio", icon: "bolt" },
  { id: "prompt", label: "Prompt generator", icon: "chat-bubble-left-right" },
  { id: "upscaler", label: "Upscaler", icon: "arrow-trending-up" },
  { id: "presets", label: "Presets", icon: "rectangle-stack" },
  { id: "approved", label: "Approved", icon: "check-circle" },
  { id: "review", label: "Review board", icon: "users" },
];

export const NAV_FOOTER: NavEntry[] = [
  { id: "admin", label: "Admin portal", icon: "shield-check" },
  { id: "health", label: "App health", icon: "signal" },
  { id: "settings", label: "Settings", icon: "cog-6-tooth" },
];

/** Where a screen lives. `sessionId` only matters for the review board. */
export function hashFor(screen: Screen, sessionId?: string | null): string {
  if (isInApp(screen)) {
    return screen === "studio" ? "#/" : `#/?mode=${screen}`;
  }
  if (screen === "review") {
    return sessionId ? `#/review/${encodeURIComponent(sessionId)}` : "#/review";
  }
  return `#/${screen}`;
}

export function navigate(screen: Screen, sessionId?: string | null): void {
  window.location.hash = hashFor(screen, sessionId);
}

/**
 * The screen a URL resolves to. Reads the hash first and the pathname second,
 * because the app is served through an SPA rewrite and both forms reach it.
 */
export function resolveScreen(): { screen: Screen | "cliff" | "oauth"; sessionId: string | null } {
  const pathname = window.location.pathname.replace(/\/$/, "");
  const rawHash = window.location.hash.replace(/^#/, "");
  const hashPath = (rawHash.split("?")[0] || "").replace(/\/$/, "");
  const at = (route: string) => hashPath === route || pathname === route;

  if (at("/.lovable/oauth/consent")) return { screen: "oauth", sessionId: null };
  if (at("/cliff-access")) return { screen: "cliff", sessionId: null };
  if (at("/health")) return { screen: "health", sessionId: null };
  if (at("/settings")) return { screen: "settings", sessionId: null };
  if (at("/admin") || at("/admin/feedback")) return { screen: "admin", sessionId: null };

  const review = hashPath.match(/^\/review\/([^/]+)$/) ?? pathname.match(/^\/review\/([^/]+)$/);
  if (review) return { screen: "review", sessionId: decodeURIComponent(review[1]) };
  if (at("/review")) return { screen: "review", sessionId: null };

  return { screen: modeFromUrl(), sessionId: null };
}

/** Which of the five in-App screens the URL asks for. */
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
