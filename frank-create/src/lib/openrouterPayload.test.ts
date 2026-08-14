import { describe, expect, it } from "vitest";

import { fallbackConfig } from "./presets";
import {
  OPENROUTER_IMAGE_CAPS,
  OPENROUTER_IMAGE_MAP,
  OPENROUTER_VIDEO_CAPS,
  OPENROUTER_VIDEO_MAP,
  buildImagePayload,
  buildVideoPayload,
  classifyVideoJobStatus,
  imageCallsFor,
  resolvePollingUrl,
  shouldAuthorizeDownload,
  snapDuration,
} from "../../../supabase/functions/frank-api/openrouter_payload";

const BASE = "https://openrouter.ai/api/v1";

describe("roster wiring", () => {
  it("has a capability envelope for every routed image slug", () => {
    for (const [studioId, slug] of Object.entries(OPENROUTER_IMAGE_MAP)) {
      expect(OPENROUTER_IMAGE_CAPS[slug], `${studioId} -> ${slug}`).toBeDefined();
    }
  });

  it("has a capability envelope for every routed video slug", () => {
    for (const [studioId, slug] of Object.entries(OPENROUTER_VIDEO_MAP)) {
      expect(OPENROUTER_VIDEO_CAPS[slug], `${studioId} -> ${slug}`).toBeDefined();
    }
  });

  it("routes every OpenRouter model the Studio offers", () => {
    const routed = { ...OPENROUTER_IMAGE_MAP, ...OPENROUTER_VIDEO_MAP };
    for (const model of fallbackConfig.models) {
      if (model.provider !== "openrouter") continue;
      expect(routed[model.id], `${model.id} is offered but not routed`).toBe(model.provider_model);
    }
  });

  // The Studio must never offer a control the provider will reject: the server
  // drops out-of-enum values, which would silently ignore the user's choice.
  it("only offers aspect ratios the provider accepts", () => {
    for (const model of fallbackConfig.models) {
      if (model.provider !== "openrouter") continue;
      const imageCaps = OPENROUTER_IMAGE_CAPS[OPENROUTER_IMAGE_MAP[model.id] ?? ""];
      const videoCaps = OPENROUTER_VIDEO_CAPS[OPENROUTER_VIDEO_MAP[model.id] ?? ""];
      const allowed = imageCaps?.aspectRatios ?? videoCaps?.aspects;
      if (!allowed) continue;
      for (const ratio of model.allowed_aspect_ratios ?? []) {
        expect(allowed, `${model.id} offers unsupported aspect ${ratio}`).toContain(ratio);
      }
    }
  });

  it("only offers resolutions the provider accepts", () => {
    for (const model of fallbackConfig.models) {
      if (model.provider !== "openrouter") continue;
      const caps = OPENROUTER_IMAGE_CAPS[OPENROUTER_IMAGE_MAP[model.id] ?? ""];
      if (!caps) continue;
      const sizes = model.allowed_image_sizes ?? [];
      if (!caps.resolutions) {
        // No resolution knob upstream — the picker must be empty.
        expect(sizes, `${model.id} offers sizes but has no resolution knob`).toEqual([]);
        continue;
      }
      for (const size of sizes) {
        expect(caps.resolutions, `${model.id} offers unsupported size ${size}`).toContain(size);
      }
    }
  });

  it("never offers more reference slots than the provider accepts", () => {
    for (const model of fallbackConfig.models) {
      if (model.provider !== "openrouter") continue;
      const caps = OPENROUTER_IMAGE_CAPS[OPENROUTER_IMAGE_MAP[model.id] ?? ""];
      if (!caps) continue;
      expect(model.reference_image_limit ?? 0, `${model.id} reference limit`).toBeLessThanOrEqual(caps.maxReferences);
    }
  });

  it("only offers durations the video model accepts", () => {
    for (const model of fallbackConfig.models) {
      const caps = OPENROUTER_VIDEO_CAPS[OPENROUTER_VIDEO_MAP[model.id] ?? ""];
      if (!caps) continue;
      for (const duration of model.allowed_durations ?? []) {
        expect(caps.durations, `${model.id} offers unsupported duration ${duration}s`).toContain(duration);
      }
    }
  });

  it("only advertises last-frame control where the model supports it", () => {
    for (const model of fallbackConfig.models) {
      const caps = OPENROUTER_VIDEO_CAPS[OPENROUTER_VIDEO_MAP[model.id] ?? ""];
      if (!caps || !model.supports_last_frame) continue;
      expect(caps.frameTypes, `${model.id} advertises last-frame control`).toContain("last_frame");
    }
  });
});

describe("buildImagePayload", () => {
  it("sends model and prompt for the simplest call", () => {
    const p = buildImagePayload({ model: "google/gemini-3-pro-image" });
    expect(p.model).toBe("google/gemini-3-pro-image");
    expect(Object.keys(p)).toEqual(["model"]);
  });

  it("keeps an aspect ratio the model supports", () => {
    const p = buildImagePayload({ model: "google/gemini-3-pro-image", aspectRatio: "21:9" });
    expect(p.aspect_ratio).toBe("21:9");
  });

  it("drops an aspect ratio outside the model's enum instead of 400ing", () => {
    // Krea has no 3:4 — the Studio used to offer it anyway.
    const p = buildImagePayload({ model: "krea/krea-2-large", aspectRatio: "3:4" });
    expect(p).not.toHaveProperty("aspect_ratio");
  });

  it("drops the pseudo-ratios the Replicate era used", () => {
    for (const ratio of ["match_input_image", "adaptive", "auto"]) {
      const p = buildImagePayload({ model: "google/gemini-3-pro-image", aspectRatio: ratio });
      expect(p).not.toHaveProperty("aspect_ratio");
    }
  });

  it("omits resolution entirely for models with no resolution knob", () => {
    for (const model of ["openai/gpt-image-2", "black-forest-labs/flux.2-pro", "microsoft/mai-image-2.5-pro"]) {
      const p = buildImagePayload({ model, size: "2K" });
      expect(p, model).not.toHaveProperty("resolution");
      expect(p, model).not.toHaveProperty("size");
    }
  });

  it("normalises resolution tier casing", () => {
    expect(buildImagePayload({ model: "google/gemini-3-pro-image", size: "4k" }).resolution).toBe("4K");
    expect(buildImagePayload({ model: "google/gemini-3.1-flash-image", size: "512" }).resolution).toBe("512");
  });

  it("clamps a resolution the model does not offer", () => {
    // Krea is 1K only.
    expect(buildImagePayload({ model: "krea/krea-2-large", size: "4K" })).not.toHaveProperty("resolution");
  });

  it("falls back to the pixel-size shorthand when the value is not a tier", () => {
    const p = buildImagePayload({ model: "google/gemini-3-pro-image", size: "1024x1536" });
    expect(p.size).toBe("1024x1536");
    expect(p).not.toHaveProperty("resolution");
  });

  it("only sends quality to models that expose it", () => {
    expect(buildImagePayload({ model: "openai/gpt-image-2", quality: "high" }).quality).toBe("high");
    expect(buildImagePayload({ model: "google/gemini-3-pro-image", quality: "high" })).not.toHaveProperty("quality");
  });

  it("omits n for single-image models and caps it for batch models", () => {
    expect(buildImagePayload({ model: "google/gemini-3-pro-image", n: 4 })).not.toHaveProperty("n");
    expect(buildImagePayload({ model: "openai/gpt-image-2", n: 4 }).n).toBe(4);
    expect(buildImagePayload({ model: "qwen/qwen-image-3-pro", n: 99 }).n).toBe(6);
  });

  it("shapes references as image_url content parts", () => {
    const p = buildImagePayload({
      model: "google/gemini-3-pro-image",
      referenceUrls: ["https://example.com/a.png"],
    });
    expect(p.input_references).toEqual([
      { type: "image_url", image_url: { url: "https://example.com/a.png" } },
    ]);
  });

  it("truncates references to the model's limit", () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}.png`);
    // MAI accepts exactly one reference.
    expect((buildImagePayload({ model: "microsoft/mai-image-2.5-pro", referenceUrls: urls }).input_references as unknown[])).toHaveLength(1);
    expect((buildImagePayload({ model: "x-ai/grok-imagine-image-quality", referenceUrls: urls }).input_references as unknown[])).toHaveLength(3);
  });

  it("never sends seed to a model that does not support it", () => {
    expect(buildImagePayload({ model: "bytedance-seed/seedream-4.5", seed: 7 }).seed).toBe(7);
    expect(buildImagePayload({ model: "google/gemini-3-pro-image", seed: 7 })).not.toHaveProperty("seed");
  });

  it("produces only spec-allowed keys for every model in the roster", () => {
    const allowed = new Set([
      "model", "prompt", "aspect_ratio", "resolution", "size", "quality",
      "output_format", "n", "seed", "input_references",
    ]);
    for (const model of Object.keys(OPENROUTER_IMAGE_CAPS)) {
      const p = buildImagePayload({
        model,
        aspectRatio: "16:9",
        size: "4K",
        quality: "high",
        n: 10,
        seed: 3,
        outputFormat: "png",
        referenceUrls: ["https://example.com/a.png"],
      });
      for (const key of Object.keys(p)) {
        expect(allowed.has(key), `${model} emitted unexpected key ${key}`).toBe(true);
      }
    }
  });
});

describe("imageCallsFor", () => {
  it("fans out single-image models into one call each", () => {
    expect(imageCallsFor("google/gemini-3-pro-image", 4)).toEqual({ calls: 4, n: 1 });
  });

  it("uses one native batch when the model supports it", () => {
    expect(imageCallsFor("openai/gpt-image-2", 6)).toEqual({ calls: 1, n: 6 });
  });

  it("splits a request above the native ceiling across calls", () => {
    expect(imageCallsFor("qwen/qwen-image-3-pro", 8)).toEqual({ calls: 2, n: 6 });
  });
});

describe("snapDuration", () => {
  const hailuo = OPENROUTER_VIDEO_CAPS["minimax/hailuo-2.3"];

  it("snaps to a value the model actually accepts", () => {
    // Hailuo takes 6 or 10 only; 8 used to be sent verbatim and 400'd.
    expect(hailuo.durations).toEqual([6, 10]);
    expect(snapDuration(hailuo, 8)).toBe(6);
    expect(snapDuration(hailuo, 9)).toBe(10);
    expect(snapDuration(hailuo, 6)).toBe(6);
  });

  it("raises a too-short request to the model minimum", () => {
    expect(snapDuration(OPENROUTER_VIDEO_CAPS["bytedance/seedance-2.0"], 3)).toBe(4);
  });

  it("lowers a too-long request to the model maximum", () => {
    expect(snapDuration(OPENROUTER_VIDEO_CAPS["alibaba/wan-2.7"], 15)).toBe(10);
  });

  it("falls back to the default for junk input", () => {
    expect(snapDuration(hailuo, undefined)).toBe(6);
    expect(snapDuration(hailuo, Number.NaN)).toBe(6);
  });
});

describe("buildVideoPayload", () => {
  it("always sends a valid resolution, aspect and duration", () => {
    const p = buildVideoPayload({
      model: "minimax/hailuo-2.3",
      prompt: "a clip",
      aspectRatio: "9:16",
      resolution: "480p",
      duration: 3,
    });
    // Hailuo is 1080p / 16:9 / 6s or 10s only.
    expect(p.resolution).toBe("1080p");
    expect(p.aspect_ratio).toBe("16:9");
    expect(p.duration).toBe(6);
  });

  it("maps the Studio's lower-case 4k onto OpenRouter's 4K", () => {
    const p = buildVideoPayload({ model: "bytedance/seedance-2.0", prompt: "x", resolution: "4k" });
    expect(p.resolution).toBe("4K");
  });

  it("tags frame images with their frame_type", () => {
    const p = buildVideoPayload({
      model: "alibaba/wan-2.7",
      prompt: "x",
      firstFrameUrl: "https://example.com/first.png",
      lastFrameUrl: "https://example.com/last.png",
    });
    expect(p.frame_images).toEqual([
      { type: "image_url", image_url: { url: "https://example.com/first.png" }, frame_type: "first_frame" },
      { type: "image_url", image_url: { url: "https://example.com/last.png" }, frame_type: "last_frame" },
    ]);
  });

  it("drops a last frame for models that only accept a first frame", () => {
    const p = buildVideoPayload({
      model: "x-ai/grok-imagine-video",
      prompt: "x",
      firstFrameUrl: "https://example.com/first.png",
      lastFrameUrl: "https://example.com/last.png",
    });
    expect(p.frame_images).toHaveLength(1);
    expect((p.frame_images as Array<{ frame_type: string }>)[0].frame_type).toBe("first_frame");
  });

  it("never sends frame_images and input_references together", () => {
    const p = buildVideoPayload({
      model: "alibaba/wan-2.7",
      prompt: "x",
      firstFrameUrl: "https://example.com/first.png",
      referenceUrls: ["https://example.com/ref.png"],
    });
    expect(p).toHaveProperty("frame_images");
    expect(p).not.toHaveProperty("input_references");
  });

  it("uses input_references in reference-to-video mode", () => {
    const p = buildVideoPayload({
      model: "bytedance/seedance-2.0",
      prompt: "x",
      referenceUrls: ["https://example.com/ref.png"],
    });
    expect(p.input_references).toEqual([
      { type: "image_url", image_url: { url: "https://example.com/ref.png" } },
    ]);
  });

  it("only sends generate_audio to models with audio support", () => {
    expect(buildVideoPayload({ model: "alibaba/wan-2.7", prompt: "x", generateAudio: false }).generate_audio).toBe(false);
    expect(buildVideoPayload({ model: "minimax/hailuo-2.3", prompt: "x", generateAudio: false })).not.toHaveProperty("generate_audio");
  });

  it("produces only spec-allowed keys for every video model", () => {
    const allowed = new Set([
      "model", "prompt", "aspect_ratio", "resolution", "duration",
      "frame_images", "input_references", "generate_audio", "seed",
    ]);
    for (const model of Object.keys(OPENROUTER_VIDEO_CAPS)) {
      const p = buildVideoPayload({
        model,
        prompt: "x",
        aspectRatio: "16:9",
        resolution: "1080p",
        duration: 5,
        firstFrameUrl: "https://example.com/a.png",
        generateAudio: true,
        seed: 1,
      });
      for (const key of Object.keys(p)) {
        expect(allowed.has(key), `${model} emitted unexpected key ${key}`).toBe(true);
      }
    }
  });
});

describe("resolvePollingUrl", () => {
  it("absolutises the site-relative polling_url OpenRouter returns", () => {
    expect(resolvePollingUrl(BASE, "/api/v1/videos/job-abc123", "job-abc123"))
      .toBe("https://openrouter.ai/api/v1/videos/job-abc123");
  });

  it("passes an absolute polling_url through untouched", () => {
    expect(resolvePollingUrl(BASE, "https://openrouter.ai/api/v1/videos/x", "x"))
      .toBe("https://openrouter.ai/api/v1/videos/x");
  });

  it("falls back to the job id when polling_url is missing", () => {
    expect(resolvePollingUrl(BASE, undefined, "job-1"))
      .toBe("https://openrouter.ai/api/v1/videos/job-1");
  });

  it("returns empty when there is nothing to poll", () => {
    expect(resolvePollingUrl(BASE, undefined, undefined)).toBe("");
  });

  it("always yields a URL fetch() can parse", () => {
    const url = resolvePollingUrl(BASE, "/api/v1/videos/job-abc123", "job-abc123");
    expect(() => new URL(url)).not.toThrow();
  });
});

describe("classifyVideoJobStatus", () => {
  it("treats every terminal failure state as failed", () => {
    for (const s of ["failed", "cancelled", "canceled", "expired"]) {
      expect(classifyVideoJobStatus(s), s).toBe("failed");
    }
  });

  it("treats queued and running states as pending", () => {
    for (const s of ["pending", "in_progress", undefined, ""]) {
      expect(classifyVideoJobStatus(s)).toBe("pending");
    }
  });

  it("recognises completion", () => {
    expect(classifyVideoJobStatus("completed")).toBe("completed");
  });
});

describe("shouldAuthorizeDownload", () => {
  it("authorises OpenRouter's own content endpoint", () => {
    expect(shouldAuthorizeDownload("https://openrouter.ai/api/v1/videos/abc/content?index=0")).toBe(true);
  });

  it("does not leak the key to third-party hosts", () => {
    expect(shouldAuthorizeDownload("https://cdn.example.com/clip.mp4")).toBe(false);
    expect(shouldAuthorizeDownload("https://openrouter.ai.evil.com/clip.mp4")).toBe(false);
    expect(shouldAuthorizeDownload("not a url")).toBe(false);
  });
});
