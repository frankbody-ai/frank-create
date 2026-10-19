import { beforeEach, describe, expect, it } from "vitest";

import { fallbackConfig } from "../lib/presets";
import { estimateImageCost } from "../lib/studio";
import {
  DEFAULT_IMAGE_MODEL_ID,
  DEFAULT_MODEL_SEEN_KEY,
  LAST_MODEL_BY_MEDIA_KEY,
  LAST_MODEL_KEY,
  adoptNewDefaultModel,
  preferredStudioModel,
  readLastUsedModelId,
  writeLastUsedModelId
} from "./studioFormat";

/** A small in-memory localStorage: this repo's test DOM has none. */
function installStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (values.has(key) ? (values.get(key) as string) : null),
    setItem: (key: string, value: string) => void values.set(key, String(value)),
    removeItem: (key: string) => void values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    }
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}

/** Nano Banana 2.1 is the default image model (owner, 19 October 2026). */
describe("the default image model", () => {
  beforeEach(() => installStorage());

  it("is Nano Banana 2.1, first in the roster, on OpenRouter", () => {
    const model = fallbackConfig.models[0];
    expect(DEFAULT_IMAGE_MODEL_ID).toBe("google-nb-2-1");
    expect(model.id).toBe(DEFAULT_IMAGE_MODEL_ID);
    expect(model.provider_model).toBe("google/gemini-nano-banana-2.1");
    expect(model.allowed_image_sizes).toEqual(["1K", "2K", "4K"]);
    expect(model.reference_image_limit).toBe(14);
  });

  it("is what a run starts on with nothing remembered", () => {
    expect(preferredStudioModel(fallbackConfig.models, null).id).toBe("google-nb-2-1");
  });

  it("has a price estimate", () => {
    const model = fallbackConfig.models.find((item) => item.id === "google-nb-2-1");
    expect(estimateImageCost(model, { image_size: "1K", count: 1 } as never)).toContain("0.02");
  });

  it("sets a remembered image model aside once, then remembers the next pick", () => {
    writeLastUsedModelId("google-nb-pro", "image");
    adoptNewDefaultModel();
    expect(readLastUsedModelId()).toBeNull();
    expect(readLastUsedModelId("image")).toBeNull();
    expect(preferredStudioModel(fallbackConfig.models, readLastUsedModelId()).id).toBe("google-nb-2-1");
    expect(window.localStorage.getItem(DEFAULT_MODEL_SEEN_KEY)).toBe("google-nb-2-1");

    writeLastUsedModelId("google-nb-pro", "image");
    adoptNewDefaultModel();
    expect(readLastUsedModelId("image")).toBe("google-nb-pro");
    expect(preferredStudioModel(fallbackConfig.models, readLastUsedModelId()).id).toBe("google-nb-pro");
  });

  it("keeps a remembered video model", () => {
    writeLastUsedModelId("google-nb-pro", "image");
    writeLastUsedModelId("seedance-2-5", "video");
    adoptNewDefaultModel();
    expect(readLastUsedModelId("video")).toBe("seedance-2-5");
    expect(window.localStorage.getItem(LAST_MODEL_KEY)).toBe("seedance-2-5");
    expect(JSON.parse(window.localStorage.getItem(LAST_MODEL_BY_MEDIA_KEY) ?? "{}")).toEqual({ video: "seedance-2-5" });
  });
});
