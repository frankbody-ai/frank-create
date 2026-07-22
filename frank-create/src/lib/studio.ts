import type { StudioModel, StudioSettings, TurnRequest } from "./types";

export interface BuildTurnRequestInput {
  sessionId?: string;
  modelId: string;
  prompt: string;
  promptMode: "generate" | "edit" | "masked_edit";
  frankBodyMode?: boolean;
  presetKey?: string;
  settings: StudioSettings;
  referenceAssetIds?: string[];
  editSourceAssetId?: string;
  maskAssetId?: string;
}

export function buildTurnRequest(input: BuildTurnRequestInput): TurnRequest {
  return {
    session_id: input.sessionId,
    kind: input.promptMode,
    model: input.modelId,
    prompt: input.prompt.trim(),
    frank_body_mode: input.frankBodyMode ?? false,
    preset_key: input.presetKey,
    settings: input.settings,
    reference_asset_ids: input.referenceAssetIds ?? [],
    edit_source_asset_id: input.editSourceAssetId,
    mask_asset_id: input.maskAssetId
  };
}

export function selectModelOptions(models: StudioModel[], selectedId: string) {
  const selectedModel = models.find((model) => model.id === selectedId) ?? models[0];

  return {
    model: selectedModel,
    allowedImageSizes: selectedModel?.allowed_image_sizes ?? [],
    allowedAspectRatios: selectedModel?.allowed_aspect_ratios ?? [],
    resolutionBadge: selectedModel?.badge ?? "",
    referenceLimit: selectedModel?.reference_image_limit ?? 0,
    canEdit: Boolean(selectedModel?.capabilities.edit),
    canMaskedEdit: Boolean(selectedModel?.capabilities.masked_edit),
    canVideo: Boolean(selectedModel?.capabilities.video)
  };
}

export function inferenceStatusCopy(result: {
  status: "queued" | "running" | "blocked" | "failed" | "complete";
  assetCount?: number;
  localEngine?: "comfy" | "fallback" | "frank_renderer";
  fallbackReason?: string;
}) {
  if (result.status === "blocked") {
    return "Server key needed.";
  }
  if (result.status === "failed") {
    return "Provider returned no usable image. Check the turn details or try local Comfy.";
  }
  if (result.status === "complete" && result.assetCount) {
    if (result.localEngine === "comfy") {
      return "Comfy round is on the wall.";
    }
    if (result.localEngine === "fallback") {
      return "Comfy was unavailable, so the fallback renderer made this round.";
    }
    if (result.localEngine === "frank_renderer") {
      return "Frank masked edit is on the wall.";
    }
    return "Round is on the wall.";
  }
  return "Round queued. Adapter handoff is ready.";
}

export function aspectRatioValue(aspect: string): number | null {
  const match = /^(\d+(?:\.\d+)?)[:x](\d+(?:\.\d+)?)$/i.exec(aspect.trim());
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!w || !h) return null;
  return w / h;
}

export function sizeMatchesAspect(size: string, aspect: string): boolean {
  // Only filter when size encodes explicit pixel dimensions like "1024x1536".
  const sizeRatio = aspectRatioValue(size);
  if (sizeRatio === null) return true; // tier-style sizes (1K, 2K, 4MP) apply to any aspect
  const aspectRatio = aspectRatioValue(aspect);
  if (aspectRatio === null) return true;
  return Math.abs(sizeRatio - aspectRatio) / aspectRatio < 0.05;
}

export function filterSizesForAspect(sizes: string[], aspect: string): string[] {
  const filtered = sizes.filter((s) => sizeMatchesAspect(s, aspect));
  return filtered.length ? filtered : sizes;
}

export function normalizeStudioSettingsForModel(settings: StudioSettings, model: StudioModel): StudioSettings {
  const count = Number.isFinite(settings.count) ? Math.trunc(settings.count) : 1;
  const aspect = model.allowed_aspect_ratios.includes(settings.aspect_ratio)
    ? settings.aspect_ratio
    : model.allowed_aspect_ratios[0] ?? "1:1";
  if (!model.allowed_image_sizes.length) {
    return {
      ...settings,
      aspect_ratio: aspect,
      image_size: "",
      count: Math.min(Math.max(count, 1), 4)
    };
  }
  const sizesForAspect = filterSizesForAspect(model.allowed_image_sizes, aspect);

  return {
    ...settings,
    aspect_ratio: aspect,
    image_size: sizesForAspect.includes(settings.image_size)
      ? settings.image_size
      : sizesForAspect[sizesForAspect.length - 1] ?? "1K",
    count: Math.min(Math.max(count, 1), 4)
  };
}

export interface StudioFieldErrors {
  aspect?: string;
  size?: string;
  count?: string;
  references?: string;
}

export function validateStudioSettings(
  model: StudioModel | undefined | null,
  settings: StudioSettings,
  opts: { referenceCount?: number } = {}
): StudioFieldErrors {
  const errors: StudioFieldErrors = {};
  if (!model) return errors;

  const aspect = settings.aspect_ratio;
  if (!aspect || !model.allowed_aspect_ratios.includes(aspect)) {
    errors.aspect = `Pick one of: ${model.allowed_aspect_ratios.join(", ") || "—"}`;
  }

  const size = settings.image_size;
  if (!model.allowed_image_sizes || model.allowed_image_sizes.length === 0) {
    if (size && String(size).trim() !== "") {
      errors.size = `${model.short_label ?? model.label} picks resolution from the aspect ratio — leave size empty.`;
    }
  } else if (!model.allowed_image_sizes.includes(size)) {
    errors.size = `Unsupported for ${model.short_label ?? model.label}. Allowed: ${model.allowed_image_sizes.join(", ")}.`;
  } else if (!errors.aspect && !sizeMatchesAspect(size, aspect)) {
    errors.size = `${size} doesn't match aspect ${aspect}.`;
  }

  const count = Number(settings.count);
  if (!Number.isFinite(count) || count < 1 || count > 4 || Math.trunc(count) !== count) {
    errors.count = "Pick 1–4 images.";
  }

  const refCount = opts.referenceCount ?? 0;
  if (refCount > (model.reference_image_limit ?? 0)) {
    errors.references = `${model.short_label ?? model.label} accepts at most ${model.reference_image_limit} reference image${model.reference_image_limit === 1 ? "" : "s"}.`;
  }

  return errors;
}

export function hasStudioFieldErrors(errors: StudioFieldErrors): boolean {
  return Boolean(errors.aspect || errors.size || errors.count || errors.references);
}


export function parseJsonList(value?: string) {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function defaultStudioSettings(model: StudioModel): StudioSettings {
  return {
    aspect_ratio: model.allowed_aspect_ratios[0] ?? "1:1",
    image_size: model.allowed_image_sizes[model.allowed_image_sizes.length - 1] ?? "",
    count: 4
  };
}

export function makeLocalId(prefix: string) {
  if ("crypto" in window && "randomUUID" in window.crypto) {
    return `${prefix}_${window.crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Date.now()}`;
}
