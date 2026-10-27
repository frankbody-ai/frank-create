import { describe, expect, it } from "vitest";
import type { StudioSession } from "../lib/types";
import { chooseLaunchSession } from "./studioFormat";

const session = (id: string, name = `Session ${id}`) => ({ id, name, mode: "image", status: "active" }) as StudioSession;

// Sessions come oldest first. A reload used to open the oldest one, so the
// work the person was just doing looked lost (27 Oct 2026 review).
describe("chooseLaunchSession", () => {
  const sessions = [session("old"), session("demo", "Frank Body Demo Studio"), session("new")];

  it("opens the session used last", () => {
    expect(chooseLaunchSession(sessions, "new")?.id).toBe("new");
  });

  it("falls back to the demo studio, then the first, when the last one is gone", () => {
    expect(chooseLaunchSession(sessions, "archived")?.id).toBe("demo");
    expect(chooseLaunchSession([session("a"), session("b")], null)?.id).toBe("a");
  });

  it("has nothing to open in an empty list", () => {
    expect(chooseLaunchSession([], "new")).toBeUndefined();
  });
});
