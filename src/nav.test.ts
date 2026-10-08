import { describe, expect, it } from "vitest";
import { osFrame } from "autosolutions-os/nav";
import type { OsFrameState } from "autosolutions-os/nav";
// The glyph table on its own: the package index also loads the components.
import { NAV_ICONS } from "autosolutions-design-system/components/media/navIcons.js";

import { STUDIO_TABS, STUDIO_TOOLS, frameLocation, placeFor, screenForPlace } from "./nav";
import type { Screen } from "./nav";

const SCREENS: Screen[] = ["studio", "prompt", "upscaler", "admin", "settings", "health"];

const studioFrame = () =>
  osFrame({ appKey: "frank_create", tools: STUDIO_TOOLS, settingsPath: placeFor("settings") });

describe("the studio in the workspace frame", () => {
  it("draws every tab with a glyph the frame carries inline", () => {
    for (const tab of STUDIO_TABS) {
      expect(Object.prototype.hasOwnProperty.call(NAV_ICONS, tab.icon ?? ""), `tab icon "${tab.icon}"`).toBe(true);
    }
  });

  it("keeps the old menu's screens and order, Admin portal last", () => {
    expect(STUDIO_TABS.map((tab) => tab.id)).toEqual(["studio", "prompt", "upscaler", "admin"]);
    expect(STUDIO_TABS.map((tab) => tab.label)).toEqual([
      "Studio", "Prompt generator", "Upscaler", "Admin portal",
    ]);
  });

  it("names every screen by a place that leads back to it", () => {
    for (const screen of SCREENS) {
      expect(screenForPlace(placeFor(screen))).toBe(screen);
      expect(screenForPlace(frameLocation(screen))).toBe(screen);
    }
    expect(screenForPlace("/somewhere-else")).toBeNull();
  });

  it("locates each screen on the right function, tool and tab", () => {
    const frame = studioFrame();
    const at = (screen: Screen) => frame.locate(frameLocation(screen));

    // The tool row and the Studio tab share the studio's place and the row
    // claims it first: the frame shows the first tab, Studio, as current.
    expect(at("studio")).toEqual({ fn: "marketing", item: "image-generator", tab: null });
    expect(at("prompt")).toEqual({ fn: "marketing", item: "image-generator", tab: "prompt" });
    expect(at("upscaler")).toEqual({ fn: "marketing", item: "image-generator", tab: "upscaler" });
    expect(at("admin")).toEqual({ fn: "marketing", item: "image-generator", tab: "admin" });
    expect(at("settings")).toEqual({ fn: "settings", item: null, tab: null });
    // Health is no tab's place: Marketing, with nothing marked as current.
    expect(at("health")).toEqual({ fn: "marketing", item: null, tab: null });

    // The mark on the location changes no place.
    for (const screen of SCREENS) {
      expect(frame.locate(frameLocation(screen)), screen).toEqual(frame.locate(placeFor(screen)));
    }
  });

  it("turns a tab click into that screen, and Settings into the app's own page", () => {
    const frame = studioFrame();
    const click = (from: Screen, fn: string, item: string | null, tab: string | null, flags: Partial<OsFrameState> = {}) =>
      frame.targetFor(
        { fn: { id: fn }, item: item ? { id: item } : null, tab: tab ? { id: tab } : null, ...flags },
        frameLocation(from),
      );

    expect(click("studio", "marketing", "image-generator", "prompt")).toEqual({ href: "/?mode=prompt", external: false });
    expect(click("prompt", "marketing", "image-generator", "upscaler")).toEqual({ href: "/?mode=upscaler", external: false });
    expect(click("upscaler", "marketing", "image-generator", "studio")).toEqual({ href: "/?mode=studio", external: false });
    expect(click("studio", "marketing", "image-generator", "admin")).toEqual({ href: "/admin", external: false });
    // From health, Studio and Marketing > Artificial Design Studio both go to the studio.
    expect(click("health", "marketing", "image-generator", "studio")).toEqual({ href: "/?mode=studio", external: false });
    expect(click("health", "marketing", "image-generator", null)).toEqual({ href: "/?mode=studio", external: false });
    expect(screenForPlace("/?mode=studio")).toBe("studio");
    expect(click("studio", "settings", null, null)).toEqual({ href: "/settings", external: false });
    // A state the frame did not report as a click on what it shows: no navigation.
    expect(click("prompt", "marketing", "image-generator", "prompt")).toBeNull();
    // The rail's Hub, Back to hub and Admin leave for the Hub.
    expect(click("studio", "hub", null, null)?.external).toBe(true);
    expect(click("prompt", "hub", null, null, { back: true })?.external).toBe(true);
    expect(click("studio", "admin", null, null)?.external).toBe(true);
  });

  it("runs a click on the tab already shown again, as the old side nav did", () => {
    const frame = studioFrame();
    const again = (screen: Screen, fn: string, item: string | null, tab: string | null) =>
      frame.targetFor(
        { fn: { id: fn }, item: item ? { id: item } : null, tab: tab ? { id: tab } : null, reselect: true },
        frameLocation(screen),
      );

    // Studio again reopens the run settings; the other modes repeat their own switch.
    expect(again("studio", "marketing", "image-generator", "studio")).toEqual({ href: "/?mode=studio", external: false });
    expect(again("prompt", "marketing", "image-generator", "prompt")).toEqual({ href: "/?mode=prompt", external: false });
    expect(again("upscaler", "marketing", "image-generator", "upscaler")).toEqual({ href: "/?mode=upscaler", external: false });
    expect(again("admin", "marketing", "image-generator", "admin")).toEqual({ href: "/admin", external: false });
    // Settings on Settings is the same hash navigation it was.
    expect(again("settings", "settings", null, null)).toEqual({ href: "/settings", external: false });
    for (const screen of ["studio", "prompt", "upscaler", "admin", "settings"] as Screen[]) {
      const target = screen === "settings"
        ? again(screen, "settings", null, null)
        : again(screen, "marketing", "image-generator", screen);
      expect(screenForPlace(target?.href ?? ""), screen).toBe(screen);
    }
  });
});
