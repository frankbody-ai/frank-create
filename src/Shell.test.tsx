import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* The frame stands in as a probe: it keeps every set of props it is given. */
const frames: Record<string, unknown>[] = [];
const lastFrame = () => frames[frames.length - 1] as {
  location: string;
  admin?: boolean;
  onNavigate: (href: string) => void;
};

const myAdminScope = vi.fn();

vi.mock("autosolutions-os/frame", () => ({
  OsWorkspaceFrame: (props: Record<string, unknown> & { children?: React.ReactNode }) => {
    frames.push(props);
    return <>{props.children}</>;
  },
}));
vi.mock("autosolutions-os", () => ({ myAdminScope: (os: unknown) => myAdminScope(os) }));
vi.mock("./lib/supabaseClient", () => ({ os: {}, hardSignOut: vi.fn(() => Promise.resolve()) }));
vi.mock("./components/FeedbackWidget", () => ({ FeedbackWidget: () => null }));
vi.mock("./components/ReleaseNotesModal", () => ({ ReleaseNotesModal: () => null }));
vi.mock("./ds", () => ({ Icon: () => null }));

/* Shell keeps the admin answer for the page, so each case loads it afresh. */
const loadShell = async () => (await import("./Shell")).Shell;
const at = (url: string) => window.history.replaceState(null, "", url);

beforeEach(() => {
  vi.resetModules();
  frames.length = 0;
  myAdminScope.mockReset();
  at("/");
  // jsdom has no media queries; a desktop width.
  window.matchMedia = vi.fn((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  cleanup();
  at("/");
});

describe("the Admin row at the foot of the rail", () => {
  it("is asked of the core once per page and handed to every screen's frame", async () => {
    myAdminScope.mockResolvedValue({ isPlatformAdmin: false, managesTenants: ["t-frankbody"], groupAdminOf: [] });
    const Shell = await loadShell();

    const first = render(<Shell screen="studio" />);
    expect(frames[0].admin).toBe(false); // no row until the core answers, as before
    await waitFor(() => expect(lastFrame().admin).toBe(true));
    first.unmount();

    // Settings, Admin portal and Health each mount a new Shell: the row is
    // there from their first frame, and the core is not asked again.
    for (const screen of ["settings", "admin", "health", "studio"] as const) {
      frames.length = 0;
      const next = render(<Shell screen={screen} />);
      expect(frames[0].admin, screen).toBe(true);
      next.unmount();
    }
    expect(myAdminScope).toHaveBeenCalledTimes(1);
  });

  it("stays away for someone who manages nothing", async () => {
    myAdminScope.mockResolvedValue({ isPlatformAdmin: false, managesTenants: [], groupAdminOf: [] });
    const Shell = await loadShell();
    render(<Shell screen="studio" />);
    await waitFor(() => expect(myAdminScope).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(lastFrame().admin).toBe(false);
  });

  it("is asked again by the next screen when the core did not answer", async () => {
    myAdminScope
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ isPlatformAdmin: true, managesTenants: [], groupAdminOf: [] });
    const Shell = await loadShell();

    const first = render(<Shell screen="health" />);
    await waitFor(() => expect(myAdminScope).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(lastFrame().admin).toBe(false);
    first.unmount();

    render(<Shell screen="settings" />);
    await waitFor(() => expect(lastFrame().admin).toBe(true));
    expect(myAdminScope).toHaveBeenCalledTimes(2);
  });
});
