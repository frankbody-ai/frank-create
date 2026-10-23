import { afterEach, describe, expect, it } from "vitest";

import {
  expectedOutputCount,
  generateGate,
  mergeAssetList,
  mergeTurns,
  readLastLaunchSessionId,
  writeLastLaunchSessionId
} from "./history";
import type { Asset, StudioTurn } from "./types";

function turn(id: string, created_at: string, extra: Partial<StudioTurn> = {}): StudioTurn {
  return {
    id,
    session_id: "s1",
    kind: "generate",
    provider: "lovable",
    model: "google-nb-2-1",
    prompt: `prompt ${id}`,
    settings_json: "{}",
    frank_body_mode: false,
    preset_key: null,
    status: "complete",
    output_asset_ids_json: "[]",
    reference_asset_ids_json: "[]",
    error_json: null,
    created_at,
    updated_at: created_at,
    ...extra
  } as StudioTurn;
}

function asset(id: string, created_at: string): Asset {
  return { id, session_id: "s1", kind: "output", title: id, created_at } as Asset;
}

describe("generateGate", () => {
  it("asks for a prompt only when the prompt is empty", () => {
    expect(generateGate({ prompt: "  ", connection: "online", hasSession: true })).toBe("empty");
    expect(generateGate({ prompt: "", connection: "checking", hasSession: false })).toBe("empty");
  });

  it("waits, never says the prompt is missing, while the studio is still connecting", () => {
    expect(generateGate({ prompt: "a red tube", connection: "checking", hasSession: false })).toBe("wait");
    expect(generateGate({ prompt: "a red tube", connection: "online", hasSession: false })).toBe("wait");
  });

  it("runs once the session is known, online or offline (offline says so itself)", () => {
    expect(generateGate({ prompt: "a red tube", connection: "online", hasSession: true })).toBe("run");
    expect(generateGate({ prompt: "a red tube", connection: "offline", hasSession: true })).toBe("run");
  });
});

describe("mergeTurns", () => {
  it("keeps a run started before the history arrived", () => {
    const fresh = turn("new", "2026-10-23T10:05:00Z");
    const history = [turn("a", "2026-10-22T09:00:00Z"), turn("b", "2026-10-22T10:00:00Z")];
    expect(mergeTurns([fresh], history).map((t) => t.id)).toEqual(["a", "b", "new"]);
  });

  it("lets the server copy win for a round it knows", () => {
    const local = turn("a", "2026-10-22T09:00:00Z", { status: "running" });
    const server = turn("a", "2026-10-22T09:00:00Z", { status: "complete" });
    const merged = mergeTurns([local], [server]);
    expect(merged).toHaveLength(1);
    expect(merged[0].status).toBe("complete");
  });
});

describe("mergeAssetList", () => {
  it("merges by id, newest first", () => {
    const merged = mergeAssetList(
      [asset("x", "2026-10-23T10:00:00Z")],
      [asset("y", "2026-10-21T10:00:00Z"), asset("x", "2026-10-23T10:00:00Z"), asset("z", "2026-10-22T10:00:00Z")]
    );
    expect(merged.map((a) => a.id)).toEqual(["x", "z", "y"]);
  });
});

describe("expectedOutputCount", () => {
  it("uses the round's saved output ids", () => {
    expect(expectedOutputCount(turn("a", "2026-10-22T09:00:00Z", { output_asset_ids_json: '["1","2","3"]' }), 1)).toBe(3);
  });

  it("falls back when no ids are saved, and expects nothing from a failed round", () => {
    expect(expectedOutputCount(turn("a", "2026-10-22T09:00:00Z"), 4)).toBe(4);
    expect(expectedOutputCount(turn("a", "2026-10-22T09:00:00Z", { status: "failed" }), 4)).toBe(0);
  });
});

describe("last launch session", () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
    else delete (window as { localStorage?: Storage }).localStorage;
  });

  it("round-trips through storage", () => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, String(value))
      }
    });
    expect(readLastLaunchSessionId()).toBeNull();
    writeLastLaunchSessionId("s-42");
    expect(readLastLaunchSessionId()).toBe("s-42");
  });

  it("never throws when storage is blocked", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      }
    });
    expect(() => writeLastLaunchSessionId("s-42")).not.toThrow();
    expect(readLastLaunchSessionId()).toBeNull();
  });
});
