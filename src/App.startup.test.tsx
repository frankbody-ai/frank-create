import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Start-up of the studio, with the backend under our control.
 *
 * The owner's report (23 October 2026): old rounds took ages to load, Generate
 * said the prompt was missing while it was there, and then the run started
 * late, on its own. These tests hold the fixes: the composer works as soon as
 * the session is known, a press before that waits visibly and then runs once,
 * and old rounds show while their pictures still load.
 */

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const api = vi.hoisted(() => ({
  fetchHealth: vi.fn(),
  fetchConfig: vi.fn(),
  listSessions: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  listTurns: vi.fn(),
  listAssets: vi.fn(),
  createInferenceTurn: vi.fn(),
  fetchTurnStatus: vi.fn(),
  createVideoStoryboard: vi.fn(),
  createReference: vi.fn(),
  deleteAsset: vi.fn(),
  deleteTurn: vi.fn()
}));

vi.mock("./lib/api", () => api);
vi.mock("./Shell", () => ({
  Shell: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
}));
vi.mock("./lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: () => Promise.resolve({ data: { user: { email: "owner@example.com" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } })
    }
  }
}));
vi.mock("./lib/admin", () => ({ getMyVideoAccess: () => Promise.resolve(false) }));
vi.mock("./components/WhatsNewButton", () => ({ WhatsNewButton: () => null }));
vi.mock("./components/SessionFolders", () => ({ SessionFolders: () => null }));

import { fallbackConfig } from "./lib/presets";
import App from "./App";

const SESSION = {
  id: "session-1",
  project_id: null,
  name: "Studio session",
  mode: "studio",
  status: "active",
  summary: null,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z"
};

const DONE_TURN = {
  id: "turn-old",
  session_id: SESSION.id,
  kind: "generate",
  provider: "lovable",
  model: fallbackConfig.models[0].id,
  prompt: "An earlier round",
  settings_json: JSON.stringify({ count: 2, aspect_ratio: "1:1" }),
  frank_body_mode: false,
  preset_key: null,
  status: "complete",
  output_asset_ids_json: JSON.stringify(["a1", "a2"]),
  reference_asset_ids_json: "[]",
  error_json: null,
  partial_errors_json: null,
  requested_count: 2,
  created_at: "2026-10-22T10:00:00Z",
  updated_at: "2026-10-22T10:00:00Z"
};

const never = <T,>() => new Promise<T>(() => undefined);

function promptBox() {
  const box = document.querySelector("textarea");
  if (!box) throw new Error("no prompt box");
  return box;
}

function typePrompt(text: string) {
  fireEvent.change(promptBox(), { target: { value: text, selectionStart: text.length } });
}

function pressGenerate() {
  fireEvent.keyDown(promptBox(), { key: "Enter" });
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.fetchHealth.mockResolvedValue({ ok: true, product: "frank-create", store: "test" });
  api.fetchConfig.mockResolvedValue(fallbackConfig);
  api.createInferenceTurn.mockReturnValue(never());
});

afterEach(() => {
  cleanup();
});

describe("studio start-up", () => {
  it("runs a prompt while old rounds and pictures are still loading", async () => {
    api.listSessions.mockResolvedValue({ sessions: [SESSION] });
    api.listTurns.mockReturnValue(never());
    api.listAssets.mockReturnValue(never());

    render(<App />);
    await screen.findByText("Loading earlier rounds");
    await waitFor(() => expect(api.listSessions).toHaveBeenCalled());
    // Let the session land.
    await act(async () => undefined);

    typePrompt("A frank body tube on wet sand");
    pressGenerate();

    await waitFor(() => expect(api.createInferenceTurn).toHaveBeenCalledTimes(1));
    const [request] = api.createInferenceTurn.mock.calls[0];
    expect(request.session_id).toBe(SESSION.id);
    expect(request.prompt).toBe("A frank body tube on wet sand");
    expect(screen.queryByText(/prompt first/i)).toBeNull();
  });

  it("holds a press made before the session is known, says so, then runs it once", async () => {
    const sessions = deferred<{ sessions: (typeof SESSION)[] }>();
    api.listSessions.mockReturnValue(sessions.promise);
    api.listTurns.mockReturnValue(never());
    api.listAssets.mockReturnValue(never());

    render(<App />);
    typePrompt("Two tubes, studio light");
    pressGenerate();

    expect(await screen.findByText(/Your run starts by itself\.$/)).toBeInTheDocument();
    expect(screen.queryByText(/prompt first/i)).toBeNull();
    expect(screen.queryByText("Enter a prompt to generate.")).toBeNull();
    expect(promptBox()).toHaveAttribute("readonly");
    expect(api.createInferenceTurn).not.toHaveBeenCalled();

    await act(async () => {
      sessions.resolve({ sessions: [SESSION] });
    });

    await waitFor(() => expect(api.createInferenceTurn).toHaveBeenCalledTimes(1));
    expect(api.createInferenceTurn.mock.calls[0][0].prompt).toBe("Two tubes, studio light");
    expect(api.createInferenceTurn.mock.calls[0][0].session_id).toBe(SESSION.id);
    await waitFor(() => expect(screen.queryByText(/Your run starts by itself\.$/)).toBeNull());
  });

  it("lets a held press be cancelled", async () => {
    const sessions = deferred<{ sessions: (typeof SESSION)[] }>();
    api.listSessions.mockReturnValue(sessions.promise);
    api.listTurns.mockReturnValue(never());
    api.listAssets.mockReturnValue(never());

    render(<App />);
    typePrompt("Hold this one");
    pressGenerate();
    const banner = (await screen.findByText(/Your run starts by itself\.$/)).closest("div") as HTMLElement;
    fireEvent.click(banner.querySelector("button") as HTMLButtonElement);

    await act(async () => {
      sessions.resolve({ sessions: [SESSION] });
    });
    await act(async () => undefined);
    expect(api.createInferenceTurn).not.toHaveBeenCalled();
    expect(promptBox()).toHaveValue("Hold this one");
  });

  it("still asks for a prompt when there is none", async () => {
    api.listSessions.mockResolvedValue({ sessions: [SESSION] });
    api.listTurns.mockResolvedValue({ turns: [] });
    api.listAssets.mockResolvedValue({ assets: [] });

    render(<App />);
    await waitFor(() => expect(api.listTurns).toHaveBeenCalled());
    pressGenerate();
    expect(await screen.findByText("Enter a prompt to generate.")).toBeInTheDocument();
    expect(api.createInferenceTurn).not.toHaveBeenCalled();
  });

  it("shows old rounds before their pictures, without calling them failed", async () => {
    api.listSessions.mockResolvedValue({ sessions: [SESSION] });
    api.listTurns.mockResolvedValue({ turns: [DONE_TURN] });
    api.listAssets.mockReturnValue(never());

    render(<App />);
    expect(await screen.findByText("An earlier round")).toBeInTheDocument();
    expect(screen.queryByText(/succeeded/)).toBeNull();
    expect(document.querySelectorAll(".output-skeleton").length).toBe(2);
  });
});
