import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The access check runs on every auth event, the hourly token refresh
 * included. A network blip there used to throw people out of a working
 * studio (27 Oct 2026 review). These tests hold the rule: only a definite
 * "no", or a first check that keeps failing, stops someone.
 */

const auth = vi.hoisted(() => ({
  listener: null as null | ((event: string, session: unknown) => void),
  rpc: vi.fn(),
}));

vi.mock("./lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { email: "cliff@example.com" } } } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        auth.listener = cb;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      signInWithOAuth: vi.fn(),
    },
  },
  os: { rpc: auth.rpc },
  hardSignOut: vi.fn(),
}));
// The design system ships .jsx that vitest does not load; the gate's logic is the subject.
vi.mock("./ds", () => ({
  GoogleButton: () => <button type="button">Sign in with Google</button>,
  Button: ({ children }: { children?: React.ReactNode }) => <button type="button">{children}</button>,
  Spinner: () => null,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("./components/SignInCard", () => ({
  SignInPage: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  SignInCard: ({ error, providers }: { error?: string | null; providers?: React.ReactNode }) => (
    <div>
      {error ? <p>{error}</p> : null}
      {providers}
    </div>
  ),
}));
vi.mock("./lib/admin", () => ({
  getMyAccessState: () => Promise.resolve({ require_approval: false, approved: true, is_admin: false }),
}));

import { ACCESS_CHECK_WAITS_MS, AuthGate } from "./AuthGate";

const SESSION = { user: { email: "cliff@example.com" } };
const yes = { data: true, error: null };
const blip = { data: null, error: { message: "Failed to fetch" } };
const no = { data: false, error: null };
const tries = ACCESS_CHECK_WAITS_MS.length;

describe("AuthGate", () => {
  beforeAll(() => {
    // Same number of tries, without the real waits.
    ACCESS_CHECK_WAITS_MS.splice(0, tries, ...ACCESS_CHECK_WAITS_MS.map((wait) => (wait ? 1 : 0)));
  });
  beforeEach(() => {
    auth.rpc.mockReset();
    auth.listener = null;
  });
  afterEach(() => {
    cleanup();
  });

  it("keeps a signed-in person in the studio when a later check fails", async () => {
    auth.rpc.mockResolvedValueOnce(yes).mockResolvedValue(blip);
    render(<AuthGate><p>studio</p></AuthGate>);
    await screen.findByText("studio");

    // The hourly refresh, during a network blip: every try fails.
    await act(async () => {
      auth.listener?.("TOKEN_REFRESHED", SESSION);
    });
    await waitFor(() => expect(auth.rpc).toHaveBeenCalledTimes(1 + tries));
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(screen.getByText("studio")).toBeTruthy();
  });

  it("lets a person in when the first check fails once and then works", async () => {
    auth.rpc.mockResolvedValueOnce(blip).mockResolvedValue(yes);
    render(<AuthGate><p>studio</p></AuthGate>);
    await screen.findByText("studio");
    expect(auth.rpc).toHaveBeenCalledTimes(2);
  });

  it("stops someone whose first check keeps failing, and says why", async () => {
    auth.rpc.mockResolvedValue(blip);
    render(<AuthGate><p>studio</p></AuthGate>);
    await screen.findByText(/Could not check your access/);
    expect(auth.rpc).toHaveBeenCalledTimes(tries);
    expect(screen.queryByText("studio")).toBeNull();
  });

  it("still takes access away on a definite no", async () => {
    auth.rpc.mockResolvedValueOnce(yes).mockResolvedValue(no);
    render(<AuthGate><p>studio</p></AuthGate>);
    await screen.findByText("studio");
    await act(async () => {
      auth.listener?.("TOKEN_REFRESHED", SESSION);
    });
    await waitFor(() => expect(screen.queryByText("studio")).toBeNull());
  });
});
