import { beforeEach, describe, expect, it } from "vitest";

import { currentModelId, fallbackConfig, RETIRED_MODEL_IDS } from "../lib/presets";
import { readRunDefaults } from "../lib/preferences";
import { estimateImageCost, modelsForMedia, normalizeStudioSettingsForModel } from "../lib/studio";
import {
  LAST_MODEL_BY_MEDIA_KEY,
  LAST_MODEL_KEY,
  modelName,
  preferredStudioModel,
  readLastUsedModelId
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

const byId = (id: string) => fallbackConfig.models.find((model) => model.id === id)!;

/** GPT Image 2.6 replaced GPT Image 2.5 on 12 November 2026. */
describe("GPT Image 2.6", () => {
  beforeEach(() => installStorage());

  it("runs Sunburst and Flare on OpenAI's 2.6 model ids", () => {
    expect(byId("openai-gpt-image-2-6-sunburst").provider_model).toBe("openai/gpt-image-2.6-sunburst");
    expect(byId("openai-gpt-image-2-6-flare").provider_model).toBe("openai/gpt-image-2.6-flare");
    for (const id of ["openai-gpt-image-2-6-sunburst", "openai-gpt-image-2-6-flare"]) {
      const model = byId(id);
      expect(model.provider).toBe("openrouter");
      expect(model.allowed_qualities).toEqual(["auto", "low", "medium", "high", "xhigh", "max"]);
      expect(model.allowed_moderation).toEqual(["auto", "low"]);
      expect(model.reference_image_limit).toBe(16);
      expect(model.max_count).toBe(10);
    }
  });

  it("shows only 2.6 in the image picker; the 2.5 rows stay for old rounds", () => {
    const picker = modelsForMedia(fallbackConfig.models, "image").map((model) => model.id);
    expect(picker).toContain("openai-gpt-image-2-6-sunburst");
    expect(picker).toContain("openai-gpt-image-2-6-flare");
    expect(picker).not.toContain("openai-gpt-image-2-5-sunburst");
    expect(picker).not.toContain("openai-gpt-image-2-5-flare");
    expect(byId("openai-gpt-image-2-5-sunburst").legacy).toBe(true);
    expect(modelName(fallbackConfig, "openai-gpt-image-2-5-flare")).toBe("GPT Image 2.5 Flare");
  });

  it("maps each retired 2.5 id to its 2.6 replacement, and nothing else", () => {
    expect(RETIRED_MODEL_IDS).toEqual({
      "openai-gpt-image-2-5-sunburst": "openai-gpt-image-2-6-sunburst",
      "openai-gpt-image-2-5-flare": "openai-gpt-image-2-6-flare"
    });
    for (const replacement of Object.values(RETIRED_MODEL_IDS)) {
      expect(byId(replacement).legacy).not.toBe(true);
    }
    expect(currentModelId("google-nb-2-1")).toBe("google-nb-2-1");
    expect(currentModelId(null)).toBeNull();
  });

  it("brings back a remembered 2.5 pick as its 2.6 replacement", () => {
    window.localStorage.setItem(LAST_MODEL_KEY, "openai-gpt-image-2-5-sunburst");
    window.localStorage.setItem(LAST_MODEL_BY_MEDIA_KEY, JSON.stringify({ image: "openai-gpt-image-2-5-flare" }));
    expect(readLastUsedModelId()).toBe("openai-gpt-image-2-6-sunburst");
    expect(readLastUsedModelId("image")).toBe("openai-gpt-image-2-6-flare");
    expect(preferredStudioModel(fallbackConfig.models, readLastUsedModelId()).id).toBe("openai-gpt-image-2-6-sunburst");
  });

  it("reads a 2.5 run default as its 2.6 replacement", () => {
    window.localStorage.setItem("frank-create.run-defaults", JSON.stringify({ model_id: "openai-gpt-image-2-5-flare" }));
    expect(readRunDefaults().model_id).toBe("openai-gpt-image-2-6-flare");
  });

  it("keeps a transparent background and the other extras", () => {
    const sunburst = byId("openai-gpt-image-2-6-sunburst");
    const next = normalizeStudioSettingsForModel(
      { aspect_ratio: "1:1", image_size: "1K", count: 1, quality: "low", background: "transparent", output_compression: 80 },
      sunburst
    );
    expect(next).toMatchObject({ quality: "low", background: "transparent", output_compression: 80 });
  });

  it("drops a transparent background on a model that cannot take it", () => {
    const nb21 = byId("google-nb-2-1");
    const next = normalizeStudioSettingsForModel(
      { aspect_ratio: "1:1", image_size: "1K", count: 1, background: "transparent" },
      nb21
    );
    expect(next.background).toBeUndefined();
  });

  it("keeps the 2.5 price estimate (same OpenAI token rates)", () => {
    expect(estimateImageCost(byId("openai-gpt-image-2-6-flare"), { aspect_ratio: "1:1", image_size: "1K", count: 1, quality: "auto" } as never)).toContain("0.02");
    expect(estimateImageCost(byId("openai-gpt-image-2-6-sunburst"), { aspect_ratio: "1:1", image_size: "1K", count: 1, quality: "auto" } as never)).toContain("0.04");
  });
});
