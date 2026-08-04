import { describe, expect, it } from "vitest";

import { fallbackConfig } from "./presets";
import { buildTurnRequest, inferenceStatusCopy, normalizeStudioSettingsForModel, selectModelOptions, validateStudioSettings, hasStudioFieldErrors } from "./studio";
import type { StudioModel } from "./types";

const models: StudioModel[] = [
  {
    id: "google-nb-pro",
    label: "Nano Banana Pro",
    provider: "google",
    status: "ready",
    badge: "4K",
    max_resolution_label: "4K",
    capabilities: { generation: true, edit: true, masked_edit: false, video: false },
    allowed_aspect_ratios: ["1:1", "4:5"],
    allowed_image_sizes: ["1K", "2K", "4K"],
    reference_image_limit: 14,
    cost_label: "premium"
  },
  {
    id: "grok-imagine-quality",
    label: "Grok Imagine",
    provider: "xai",
    status: "ready",
    badge: "2K",
    max_resolution_label: "2K",
    capabilities: { generation: true, edit: true, masked_edit: false, video: true },
    allowed_aspect_ratios: ["1:1", "16:9"],
    allowed_image_sizes: ["1K", "2K"],
    reference_image_limit: 4,
    cost_label: "experimental"
  }
];

describe("studio helpers", () => {
  it("keeps Frank Body Mode off by default in turn requests", () => {
    const request = buildTurnRequest({
      sessionId: "session-1",
      modelId: "google-nb-pro",
      prompt: "Create a clean product shot.",
      promptMode: "generate",
      frankBodyMode: false,
      settings: { aspect_ratio: "1:1", image_size: "4K", count: 4 },
      referenceAssetIds: ["asset-ref"],
      editSourceAssetId: undefined
    });

    expect(request).toMatchObject({
      session_id: "session-1",
      kind: "generate",
      model: "google-nb-pro",
      prompt: "Create a clean product shot.",
      frank_body_mode: false
    });
  });

  it("derives selectable settings from the chosen model", () => {
    expect(selectModelOptions(models, "grok-imagine-quality")).toMatchObject({
      allowedImageSizes: ["1K", "2K"],
      resolutionBadge: "2K",
      referenceLimit: 4,
      canEdit: true
    });
  });

  it("keeps the fallback launch registry aligned with the Cliff model roster", () => {
    expect(fallbackConfig.models.map((model) => model.id)).toEqual([
      "google-nb-pro",
      "google-nb-2",
      "openai-gpt-image-2",
      "reve-2-1",
      "mai-image-2-5",
      "seedream-5-pro",
      "grok-imagine-video",
      "dreamina-seedance-2",
      "grok-imagine-video-1-5",
      "happyhorse-1-0",
      "wan-2-7-i2v",
      "hailuo-2-3"
    ]);
    expect(fallbackConfig.backlogModels).toEqual([]);
    expect(fallbackConfig.models.find((model) => model.id === "openai-gpt-image-2")?.provider_model).toBe(
      "openai/gpt-image-2"
    );
    expect(fallbackConfig.models.find((model) => model.id === "reve-2-1")?.provider_model).toBe("reve/reve-2.1");
    expect(fallbackConfig.models.find((model) => model.id === "seedream-5-pro")?.allowed_image_sizes).toEqual(["1K", "2K"]);
    expect(fallbackConfig.models.find((model) => model.id === "mai-image-2-5")?.status).toBe("disabled");
    expect(fallbackConfig.tasks.find((task) => task.key === "prompt-remix")?.providers).toContain("google");
  });

  it("normalizes stale or malformed settings when the selected model changes", () => {
    expect(
      normalizeStudioSettingsForModel(
        { aspect_ratio: "4:5", image_size: "4K", count: Number.NaN },
        models[1]
      )
    ).toEqual({
      aspect_ratio: "1:1",
      image_size: "2K",
      count: 1
    });

    expect(
      normalizeStudioSettingsForModel(
        { aspect_ratio: "16:9", image_size: "2K", count: 99 },
        models[1]
      )
    ).toEqual({
      aspect_ratio: "16:9",
      image_size: "2K",
      count: 4
    });
  });

  it("names the local engine used for completed rounds", () => {
    expect(
      inferenceStatusCopy({
        status: "complete",
        assetCount: 1,
        localEngine: "fallback",
        fallbackReason: "No queue"
      })
    ).toBe("The fallback renderer made this round.");
  });

  it("flags size for models that pick resolution from aspect (Reve)", () => {
    const reve = fallbackConfig.models.find((m) => m.id === "reve-2-1")!;
    const errors = validateStudioSettings(reve, { aspect_ratio: "1:1", image_size: "1K", count: 1 });
    expect(errors.size).toMatch(/leave size empty/i);
    expect(hasStudioFieldErrors(errors)).toBe(true);
  });

  it("flags unsupported size for Seedream (no 4K)", () => {
    const seedream = fallbackConfig.models.find((m) => m.id === "seedream-5-pro")!;
    const errors = validateStudioSettings(seedream, { aspect_ratio: "1:1", image_size: "4K", count: 1 });
    expect(errors.size).toMatch(/Unsupported/);
  });

  it("flags unsupported aspect for Nano Banana 2", () => {
    const nb2 = fallbackConfig.models.find((m) => m.id === "google-nb-2")!;
    const errors = validateStudioSettings(nb2, { aspect_ratio: "7:3", image_size: "2K", count: 2 });
    expect(errors.aspect).toBeTruthy();
  });

  it("passes validation on a valid Seedream combo", () => {
    const seedream = fallbackConfig.models.find((m) => m.id === "seedream-5-pro")!;
    const errors = validateStudioSettings(seedream, { aspect_ratio: "16:9", image_size: "2K", count: 2 });
    expect(hasStudioFieldErrors(errors)).toBe(false);
  });

  it("flags too many reference images", () => {
    const reve = fallbackConfig.models.find((m) => m.id === "reve-2-1")!;
    const errors = validateStudioSettings(reve, { aspect_ratio: "1:1", image_size: "", count: 1 }, { referenceCount: 20 });
    expect(errors.references).toMatch(/at most 8/);
  });
});
