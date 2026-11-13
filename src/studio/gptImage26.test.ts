import { beforeEach, describe, expect, it } from "vitest";

import { currentModelId, fallbackConfig, RETIRED_MODEL_IDS } from "../lib/presets";
import { readRunDefaults } from "../lib/preferences";
import {
  estimateImageCost,
  gptImageOutputTokens,
  gptImageUnitPrice,
  modelsForMedia,
  normalizeStudioSettingsForModel
} from "../lib/studio";
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

  it("offers 1K only, since OpenRouter takes no size for GPT Image", () => {
    for (const id of ["openai-gpt-image-2-6-sunburst", "openai-gpt-image-2-6-flare"]) {
      expect(byId(id).allowed_image_sizes).toEqual(["1K"]);
      expect(byId(id).badge).toBe("1K");
    }
    const moved = normalizeStudioSettingsForModel(
      { aspect_ratio: "1:1", image_size: "2K", count: 1 },
      byId("openai-gpt-image-2-6-sunburst")
    );
    expect(moved.image_size).toBe("1K");
  });

  it("counts output tokens exactly like OpenAI's calculator", () => {
    // Values from OpenAI's GptImageTokenCalculator (image generation guide, Nov 2026).
    const cases: Array<[number, number, string, number]> = [
      [1024, 1024, "low", 823],
      [1024, 1024, "medium", 1449],
      [1024, 1024, "high", 1756],
      [1024, 1024, "xhigh", 3122],
      [1024, 1024, "max", 7024],
      [1536, 1024, "low", 664],
      [1536, 1024, "high", 1372],
      [1536, 864, "medium", 924],
      [1536, 656, "max", 2960]
    ];
    for (const [width, height, quality, tokens] of cases) {
      expect(gptImageOutputTokens(width, height, quality)).toBe(tokens);
      expect(gptImageOutputTokens(height, width, quality)).toBe(tokens);
    }
    expect(gptImageOutputTokens(1024, 1024, "auto")).toBeNull();
  });

  it("prices one picture from those tokens at $30 per 1M", () => {
    // The live 2.6 Flare run at 1024x1024 low (13 Nov 2026) billed 824 image tokens.
    expect(gptImageUnitPrice("1:1", "low")).toBeCloseTo(0.02469, 5);
    expect(gptImageUnitPrice("1:1", "max")).toBeCloseTo(0.21072, 5);
    // auto is estimated as high
    expect(gptImageUnitPrice("1:1", "auto")).toBe(gptImageUnitPrice("1:1", "high"));
    expect(gptImageUnitPrice("16:9", "high")).toBeCloseTo(1078 * 30e-6, 8);
  });

  it("shows the token-based estimate, the same on Sunburst and Flare", () => {
    const settings = { aspect_ratio: "1:1", image_size: "1K", count: 2, quality: "medium" } as never;
    const flare = estimateImageCost(byId("openai-gpt-image-2-6-flare"), settings);
    expect(flare).toBe("~$0.09 · 2 images @ 1K · medium quality · $0.04/image");
    expect(estimateImageCost(byId("openai-gpt-image-2-6-sunburst"), settings)).toBe(flare);
  });
});
