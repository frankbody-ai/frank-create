// Request builders for OpenRouter's dedicated media APIs.
//
// Kept free of Deno globals so the payload rules are unit-testable from the
// SPA's vitest suite (see frank-create/src/lib/openrouterPayload.test.ts).
//
// Every enum below is transcribed from the live capability endpoints:
//   GET https://openrouter.ai/api/v1/images/models
//   GET https://openrouter.ai/api/v1/videos/models
// OpenRouter rejects a request with 400 when a parameter is outside the
// chosen model's envelope — including sending a parameter the model has no
// knob for at all — so anything not listed here must be dropped, not guessed.

/** Studio image model id -> OpenRouter slug. */
export const OPENROUTER_IMAGE_MAP: Record<string, string> = {
  "google-nb-pro": "google/gemini-3-pro-image",
  "nano-banana-pro": "google/gemini-3-pro-image",
  "google-nb-2": "google/gemini-3.1-flash-image",
  "nano-banana-2": "google/gemini-3.1-flash-image",
  "openai-gpt-image-2": "openai/gpt-image-2",
  "seedream-4-5": "bytedance-seed/seedream-4.5",
  "flux-2-pro": "black-forest-labs/flux.2-pro",
  "flux-2-max": "black-forest-labs/flux.2-max",
  "riverflow-2-5-pro": "sourceful/riverflow-v2.5-pro",
  "qwen-image-3-pro": "qwen/qwen-image-3-pro",
  "krea-2-large": "krea/krea-2-large",
  "mai-image-2-5-pro": "microsoft/mai-image-2.5-pro",
  "grok-imagine-image": "x-ai/grok-imagine-image-quality",
};

/** Studio video model id -> OpenRouter slug. */
export const OPENROUTER_VIDEO_MAP: Record<string, string> = {
  "grok-imagine-video": "x-ai/grok-imagine-video",
  "grok-imagine-video-1-5": "x-ai/grok-imagine-video-1.5",
  "dreamina-seedance-2": "bytedance/seedance-2.0",
  "seedance-2-5": "bytedance/seedance-2.5",
  "happyhorse-1-0": "alibaba/happyhorse-1.0",
  "wan-2-7-i2v": "alibaba/wan-2.7",
  "hailuo-2-3": "minimax/hailuo-2.3",
};

export type ImageCaps = {
  /** Absent when the model exposes no `resolution` knob at all. */
  resolutions?: string[];
  aspectRatios: string[];
  /** Absent when the model exposes no `quality` knob at all. */
  qualities?: string[];
  outputFormats?: string[];
  maxN: number;
  maxReferences: number;
  supportsSeed: boolean;
};

// Verified against GET /api/v1/images/models.
export const OPENROUTER_IMAGE_CAPS: Record<string, ImageCaps> = {
  "google/gemini-3-pro-image": {
    resolutions: ["1K", "2K", "4K"],
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    maxN: 1,
    maxReferences: 14,
    supportsSeed: false,
  },
  "google/gemini-3.1-flash-image": {
    resolutions: ["512", "1K", "2K", "4K"],
    aspectRatios: [
      "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3",
      "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
    ],
    maxN: 1,
    maxReferences: 14,
    supportsSeed: false,
  },
  // No `resolution` knob — gpt-image-2 sizes via aspect_ratio + quality only.
  "openai/gpt-image-2": {
    aspectRatios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9", "auto"],
    qualities: ["auto", "low", "medium", "high"],
    maxN: 10,
    maxReferences: 16,
    supportsSeed: false,
  },
  "bytedance-seed/seedream-4.5": {
    resolutions: ["1K", "2K", "4K"],
    aspectRatios: [
      "1:1", "1:2", "2:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4",
      "9:16", "16:9", "9:19.5", "19.5:9", "9:20", "20:9", "9:21", "21:9", "auto",
    ],
    maxN: 10,
    maxReferences: 14,
    supportsSeed: true,
  },
  // FLUX.2 bills per megapixel and has no normalized resolution tier.
  "black-forest-labs/flux.2-pro": {
    aspectRatios: ["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "21:9", "auto"],
    outputFormats: ["png", "jpeg"],
    maxN: 1,
    maxReferences: 8,
    supportsSeed: true,
  },
  "black-forest-labs/flux.2-max": {
    aspectRatios: ["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "21:9", "auto"],
    outputFormats: ["png", "jpeg"],
    maxN: 1,
    maxReferences: 8,
    supportsSeed: true,
  },
  "sourceful/riverflow-v2.5-pro": {
    resolutions: ["1K", "2K", "4K"],
    aspectRatios: ["1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "21:9", "auto"],
    outputFormats: ["png", "jpeg", "webp"],
    maxN: 1,
    maxReferences: 10,
    supportsSeed: false,
  },
  "qwen/qwen-image-3-pro": {
    resolutions: ["1K", "2K"],
    aspectRatios: [
      "1:1", "1:2", "1:4", "2:1", "2:3", "3:2", "3:4",
      "4:1", "4:3", "4:5", "5:4", "9:16", "16:9",
    ],
    maxN: 6,
    maxReferences: 4,
    supportsSeed: true,
  },
  "krea/krea-2-large": {
    resolutions: ["1K"],
    aspectRatios: ["1:1", "4:3", "3:2", "16:9", "4:5", "2:3", "9:16"],
    maxN: 1,
    maxReferences: 1,
    supportsSeed: true,
  },
  "microsoft/mai-image-2.5-pro": {
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "auto"],
    maxN: 1,
    maxReferences: 1,
    supportsSeed: false,
  },
  "x-ai/grok-imagine-image-quality": {
    resolutions: ["1K", "2K"],
    aspectRatios: [
      "1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2",
      "9:19.5", "19.5:9", "9:20", "20:9", "1:2", "2:1", "auto",
    ],
    maxN: 1,
    maxReferences: 3,
    supportsSeed: false,
  },
};

export type VideoCaps = {
  resolutions: string[];
  defaultResolution: string;
  aspects: string[];
  defaultAspect: string;
  /** Discrete list, not a range — Hailuo accepts only 6 or 10. */
  durations: number[];
  defaultDuration: number;
  frameTypes: Array<"first_frame" | "last_frame">;
  supportsAudio: boolean;
  maxReferences: number;
};

// Verified against GET /api/v1/videos/models.
export const OPENROUTER_VIDEO_CAPS: Record<string, VideoCaps> = {
  "x-ai/grok-imagine-video": {
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    defaultAspect: "16:9",
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 5,
    frameTypes: ["first_frame"],
    supportsAudio: false,
    maxReferences: 1,
  },
  "x-ai/grok-imagine-video-1.5": {
    resolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    defaultAspect: "16:9",
    durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 5,
    frameTypes: ["first_frame"],
    supportsAudio: false,
    maxReferences: 1,
  },
  "bytedance/seedance-2.0": {
    resolutions: ["480p", "720p", "1080p", "4K"],
    defaultResolution: "1080p",
    aspects: ["1:1", "3:4", "9:16", "4:3", "16:9", "21:9", "9:21"],
    defaultAspect: "16:9",
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 5,
    frameTypes: ["first_frame", "last_frame"],
    supportsAudio: true,
    maxReferences: 9,
  },
  "bytedance/seedance-2.5": {
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    aspects: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    defaultAspect: "16:9",
    // Long-form: every whole second from 4 to 30.
    durations: Array.from({ length: 27 }, (_, i) => i + 4),
    defaultDuration: 5,
    frameTypes: ["first_frame", "last_frame"],
    supportsAudio: true,
    maxReferences: 9,
  },
  "alibaba/happyhorse-1.0": {
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"],
    defaultAspect: "16:9",
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 5,
    frameTypes: ["first_frame"],
    supportsAudio: false,
    maxReferences: 1,
  },
  "alibaba/wan-2.7": {
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultAspect: "16:9",
    durations: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    defaultDuration: 5,
    frameTypes: ["first_frame", "last_frame"],
    supportsAudio: true,
    maxReferences: 2,
  },
  "minimax/hailuo-2.3": {
    resolutions: ["1080p"],
    defaultResolution: "1080p",
    aspects: ["16:9"],
    defaultAspect: "16:9",
    durations: [6, 10],
    defaultDuration: 6,
    frameTypes: ["first_frame"],
    supportsAudio: false,
    maxReferences: 1,
  },
};

export type ImageContentPart = {
  type: "image_url";
  image_url: { url: string };
};

export type FrameImagePart = ImageContentPart & {
  frame_type: "first_frame" | "last_frame";
};

export function imageRefParts(urls: string[]): ImageContentPart[] {
  return urls.map((url) => ({ type: "image_url", image_url: { url } }));
}

function inEnum(value: unknown, allowed: string[] | undefined): string | undefined {
  if (!allowed) return undefined;
  const v = typeof value === "string" ? value.trim() : "";
  return v && allowed.includes(v) ? v : undefined;
}

// The Studio surfaces "4k"/"1k" lower-case and Replicate-era pixel strings.
// OpenRouter's tiers are "512" | "1K" | "2K" | "4K" exactly.
export function normalizeResolutionTier(value: unknown): string | undefined {
  const raw = typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (["512", "1K", "2K", "4K"].includes(upper)) return upper;
  // "1024x1024" and friends carry no tier — the caller falls back to `size`.
  return undefined;
}

/** `WIDTHxHEIGHT` shorthand accepted by both media endpoints. */
export function normalizePixelSize(value: unknown): string | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  const m = raw.match(/^(\d{2,5})\s*[x×]\s*(\d{2,5})$/i);
  return m ? `${m[1]}x${m[2]}` : undefined;
}

export type BuildImageOptions = {
  model: string;
  aspectRatio?: string;
  size?: string;
  quality?: string;
  n?: number;
  seed?: number;
  outputFormat?: string;
  referenceUrls?: string[];
};

/**
 * Build a POST /api/v1/images body that the chosen model will actually accept.
 * Unsupported knobs are omitted entirely rather than sent with a fallback
 * value, because OpenRouter 400s on unknown-for-this-model parameters.
 */
export function buildImagePayload(opts: BuildImageOptions): Record<string, unknown> {
  const caps = OPENROUTER_IMAGE_CAPS[opts.model];
  const payload: Record<string, unknown> = { model: opts.model };

  if (!caps) return payload;

  const aspect = inEnum(opts.aspectRatio, caps.aspectRatios);
  if (aspect) payload.aspect_ratio = aspect;

  // `resolution` is a normalized tier; `size` is the pixel-dimension shorthand.
  // Only one is meaningful, and only when the model exposes the knob.
  const tier = inEnum(normalizeResolutionTier(opts.size), caps.resolutions);
  if (tier) {
    payload.resolution = tier;
  } else if (caps.resolutions) {
    const pixels = normalizePixelSize(opts.size);
    if (pixels) payload.size = pixels;
  }

  const quality = inEnum(opts.quality, caps.qualities);
  if (quality) payload.quality = quality;

  const outputFormat = inEnum(opts.outputFormat, caps.outputFormats);
  if (outputFormat) payload.output_format = outputFormat;

  const requestedN = Math.round(Number(opts.n ?? 1));
  if (Number.isFinite(requestedN) && requestedN > 1) {
    const n = Math.min(requestedN, caps.maxN);
    if (n > 1) payload.n = n;
  }

  if (caps.supportsSeed && Number.isFinite(Number(opts.seed))) {
    payload.seed = Math.round(Number(opts.seed));
  }

  const refs = (opts.referenceUrls ?? []).filter(Boolean).slice(0, caps.maxReferences);
  if (refs.length) payload.input_references = imageRefParts(refs);

  return payload;
}

/** How many images a single call can return for this model. */
export function imageCallsFor(model: string, count: number): { calls: number; n: number } {
  const caps = OPENROUTER_IMAGE_CAPS[model];
  const wanted = Math.max(1, Math.round(Number(count) || 1));
  if (!caps || caps.maxN <= 1) return { calls: wanted, n: 1 };
  const n = Math.min(wanted, caps.maxN);
  // One native call covers `n`; anything above the native ceiling fans out.
  const calls = Math.ceil(wanted / n);
  return { calls, n };
}

/** Snap to the nearest value the model actually accepts (ties round down). */
export function snapDuration(caps: VideoCaps, requested: unknown): number {
  const value = Number(requested);
  if (!Number.isFinite(value)) return caps.defaultDuration;
  let best = caps.durations[0];
  let bestDelta = Math.abs(value - best);
  for (const candidate of caps.durations) {
    const delta = Math.abs(value - candidate);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return best;
}

export type BuildVideoOptions = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
  generateAudio?: boolean;
  seed?: number;
};

export function buildVideoPayload(opts: BuildVideoOptions): Record<string, unknown> {
  const caps = OPENROUTER_VIDEO_CAPS[opts.model];
  const payload: Record<string, unknown> = { model: opts.model, prompt: opts.prompt };
  if (!caps) return payload;

  payload.aspect_ratio = inEnum(opts.aspectRatio, caps.aspects) ?? caps.defaultAspect;

  // "4k" from the Studio's resolution picker vs OpenRouter's "4K".
  const requestedRes = typeof opts.resolution === "string" && opts.resolution.toLowerCase() === "4k"
    ? "4K"
    : opts.resolution;
  payload.resolution = inEnum(requestedRes, caps.resolutions) ?? caps.defaultResolution;

  payload.duration = snapDuration(caps, opts.duration);

  const frames: FrameImagePart[] = [];
  if (opts.firstFrameUrl && caps.frameTypes.includes("first_frame")) {
    frames.push({ type: "image_url", image_url: { url: opts.firstFrameUrl }, frame_type: "first_frame" });
  }
  if (opts.lastFrameUrl && caps.frameTypes.includes("last_frame")) {
    frames.push({ type: "image_url", image_url: { url: opts.lastFrameUrl }, frame_type: "last_frame" });
  }
  if (frames.length) {
    // frame_images wins over input_references upstream, so never send both.
    payload.frame_images = frames;
  } else {
    const refs = (opts.referenceUrls ?? []).filter(Boolean).slice(0, caps.maxReferences);
    if (refs.length) payload.input_references = imageRefParts(refs);
  }

  if (caps.supportsAudio && typeof opts.generateAudio === "boolean") {
    payload.generate_audio = opts.generateAudio;
  }

  if (Number.isFinite(Number(opts.seed))) payload.seed = Math.round(Number(opts.seed));

  return payload;
}

/**
 * `polling_url` comes back as a site-relative path (`/api/v1/videos/<id>`), so
 * it must be resolved against the API origin before fetch() will accept it.
 */
export function resolvePollingUrl(base: string, pollingUrl: unknown, jobId: unknown): string {
  const origin = base.replace(/\/api\/v1\/?$/, "");
  const raw = typeof pollingUrl === "string" ? pollingUrl.trim() : "";
  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    return `${origin}${raw.startsWith("/") ? "" : "/"}${raw}`;
  }
  const id = typeof jobId === "string" ? jobId.trim() : "";
  return id ? `${base}/videos/${id}` : "";
}

const TERMINAL_FAILURE_STATES = new Set(["failed", "cancelled", "canceled", "expired"]);
const TERMINAL_SUCCESS_STATES = new Set(["completed", "succeeded"]);

export function classifyVideoJobStatus(status: unknown): "completed" | "failed" | "pending" {
  const state = String(status ?? "").toLowerCase();
  if (TERMINAL_SUCCESS_STATES.has(state)) return "completed";
  if (TERMINAL_FAILURE_STATES.has(state)) return "failed";
  return "pending";
}

/**
 * The clip URL in `unsigned_urls` points back at OpenRouter's own content
 * endpoint, which requires the API key. Only attach it for OpenRouter hosts so
 * the key never leaks to a third-party CDN.
 */
export function shouldAuthorizeDownload(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase().endsWith("openrouter.ai");
  } catch {
    return false;
  }
}
