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
  referenceImageUrls?: string[];
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
    reference_image_urls: input.referenceImageUrls ?? [],
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
  localEngine?: "fallback" | "frank_renderer";
  fallbackReason?: string;
}) {
  if (result.status === "blocked") {
    return "Server key needed.";
  }
  if (result.status === "failed") {
    return "Provider returned no usable image. Check the turn details and retry.";
  }
  if (result.status === "complete" && result.assetCount) {
    if (result.localEngine === "fallback") {
      return "The fallback renderer made this round.";
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

export function aspectRatioParts(aspect: string): { width: number; height: number } | null {
  const match = /^(\d+(?:\.\d+)?)[:x](\d+(?:\.\d+)?)$/i.exec(aspect.trim());
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return { width, height };
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
  const cap = maxCountForModel(model);
  const aspect = model.allowed_aspect_ratios.includes(settings.aspect_ratio)
    ? settings.aspect_ratio
    : model.allowed_aspect_ratios[0] ?? "1:1";
  if (!model.allowed_image_sizes.length) {
    return {
      ...settings,
      aspect_ratio: aspect,
      image_size: "",
      count: Math.min(Math.max(count, 1), cap)
    };
  }
  const sizesForAspect = filterSizesForAspect(model.allowed_image_sizes, aspect);

  return {
    ...settings,
    aspect_ratio: aspect,
    image_size: sizesForAspect.includes(settings.image_size)
      ? settings.image_size
      : sizesForAspect[sizesForAspect.length - 1] ?? "1K",
    count: Math.min(Math.max(count, 1), cap)
  };
}

export function isVideoModel(model: StudioModel | undefined | null): boolean {
  return model?.media === "video";
}

export function modelsForMedia(models: StudioModel[], media: "image" | "video"): StudioModel[] {
  return models.filter((model) => (media === "video" ? isVideoModel(model) : !isVideoModel(model)));
}

export function normalizeVideoSettings(settings: StudioSettings, model: StudioModel): StudioSettings {
  const durations = model.allowed_durations ?? [];
  const resolutions = model.allowed_resolutions ?? [];
  const aspects = model.allowed_aspect_ratios ?? [];
  return {
    ...settings,
    count: 1,
    aspect_ratio: aspects.length
      ? (aspects.includes(settings.aspect_ratio) ? settings.aspect_ratio : aspects[0])
      : settings.aspect_ratio,
    duration: durations.length
      ? (settings.duration && durations.includes(settings.duration) ? settings.duration : durations[0])
      : undefined,
    video_resolution: resolutions.length
      ? (settings.video_resolution && resolutions.includes(settings.video_resolution)
        ? settings.video_resolution
        : resolutions[resolutions.length - 1])
      : undefined
  };
}

export function maxCountForModel(model: StudioModel | undefined | null): number {
  const value = Number(model?.max_count);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 4;
}

function usd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Per-second rate label for a video model, e.g. "$0.05/s" or "$0.08–1.00/s". */
export function modelRateLabel(model: StudioModel | undefined | null): string | null {
  if (!model || !isVideoModel(model)) return null;
  if (model.price_per_second_by_resolution) {
    const values = Object.values(model.price_per_second_by_resolution);
    if (values.length) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      return min === max ? `${usd(min)}/s` : `${usd(min)}–${max.toFixed(2)}/s`;
    }
  }
  if (model.price_per_second) {
    return model.price_max_per_second && model.price_max_per_second > model.price_per_second
      ? `${usd(model.price_per_second)}–${model.price_max_per_second.toFixed(2)}/s`
      : `${usd(model.price_per_second)}/s`;
  }
  if (model.price_table) {
    const values = Object.values(model.price_table);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${usd(min)}/video` : `${usd(min)}–${max.toFixed(2)}/video`;
  }
  if (model.price_flat) return `${usd(model.price_flat)}/video`;
  return null;
}

/** Live estimate for the current duration / resolution selection. */
export function estimateVideoCost(
  model: StudioModel | undefined | null,
  settings: StudioSettings
): string | null {
  if (!model || !isVideoModel(model)) return null;
  const duration = Number(settings.duration) || model.allowed_durations?.[0] || 5;
  const resolution = settings.video_resolution ?? model.allowed_resolutions?.[0] ?? "";
  const suffix = `${duration}s${resolution ? ` @ ${resolution}` : ""}`;

  if (model.price_table) {
    const exact = model.price_table[`${duration}@${resolution}`];
    if (typeof exact === "number") return `~${usd(exact)} · ${suffix}`;
  }
  const byRes = model.price_per_second_by_resolution?.[resolution.toLowerCase()]
    ?? model.price_per_second_by_resolution?.[resolution];
  if (typeof byRes === "number") {
    return `~${usd(byRes * duration)} · ${suffix} · ${usd(byRes)}/s`;
  }
  if (model.price_per_second) {
    const low = model.price_per_second * duration;
    const high = (model.price_max_per_second ?? model.price_per_second) * duration;
    return high > low
      ? `~${usd(low)}–${high.toFixed(2)} · ${suffix}`
      : `~${usd(low)} · ${suffix}`;
  }
  if (model.price_flat) return `~${usd(model.price_flat)} · ${suffix}`;
  return null;
}



export interface StudioFieldErrors {
  aspect?: string;
  size?: string;
  count?: string;
  references?: string;
  compare?: string;
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
  const cap = maxCountForModel(model);
  if (!Number.isFinite(count) || count < 1 || count > cap || Math.trunc(count) !== count) {
    errors.count = `Pick 1–${cap} images.`;
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

// Preflight compatibility check — returns actionable messages BEFORE the
// request is sent to the provider. Focused on Reve (which has a strict
// aspect enum and rejects any `size`/`quality` param), but generalizes to
// other models via `allowed_aspect_ratios` / `allowed_image_sizes`.
export function preflightModel(
  model: StudioModel | undefined | null,
  settings: StudioSettings,
  opts: { referenceCount?: number } = {}
): string[] {
  if (!model) return [];
  const issues: string[] = [];
  const name = model.short_label ?? model.label ?? "This model";
  const isReve = model.id === "reve-2-1" || /^reve\//i.test(model.provider_model ?? "");

  const aspect = settings.aspect_ratio;
  if (!aspect) {
    issues.push(`${name}: pick an aspect ratio (${(model.allowed_aspect_ratios ?? []).slice(0, 6).join(", ")}${(model.allowed_aspect_ratios?.length ?? 0) > 6 ? ", …" : ""}).`);
  } else if (!(model.allowed_aspect_ratios ?? []).includes(aspect)) {
    issues.push(`${name} does not support aspect ${aspect}. Allowed: ${(model.allowed_aspect_ratios ?? []).join(", ") || "—"}.`);
  }

  const size = settings.image_size;
  const modelSizes = model.allowed_image_sizes ?? [];
  if (modelSizes.length === 0) {
    if (size && String(size).trim() !== "") {
      const hint = isReve
        ? `Reve picks its own resolution from the aspect ratio — remove the quality override (currently "${size}").`
        : `${name} picks its own resolution — leave quality empty (currently "${size}").`;
      issues.push(hint);
    }
  } else if (size && !modelSizes.includes(size)) {
    issues.push(`${name} does not support quality "${size}". Allowed: ${modelSizes.join(", ")}.`);
  } else if (size && aspect && !sizeMatchesAspect(size, aspect)) {
    issues.push(`Quality ${size} does not match aspect ${aspect} — pick a matching size or change the aspect.`);
  }

  const refCount = opts.referenceCount ?? 0;
  const refLimit = model.reference_image_limit ?? 0;
  if (refCount > refLimit) {
    issues.push(`${name} accepts at most ${refLimit} reference image${refLimit === 1 ? "" : "s"} (you attached ${refCount}).`);
  }

  const count = Number(settings.count);
  const cap = maxCountForModel(model);
  if (!Number.isFinite(count) || count < 1 || count > cap || Math.trunc(count) !== count) {
    issues.push(`Pick between 1 and ${cap} images per round.`);
  }

  return issues;
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

/* ---------------------------------------------------------------- *
 * Side-by-side: resolve shared settings against one model's limits
 * ---------------------------------------------------------------- */

export interface StudioAdjustment {
  field: "aspect_ratio" | "image_size" | "video_resolution" | "duration" | "references";
  label: string;
  from: string;
  to: string;
  message: string;
}

function ratioValue(aspect: string): number | null {
  const parts = /^(\d+(?:\.\d+)?)[:x](\d+(?:\.\d+)?)$/i.exec(aspect.trim());
  if (!parts) return null;
  const w = Number(parts[1]);
  const h = Number(parts[2]);
  return h > 0 ? w / h : null;
}

/** Nearest supported aspect ratio by numeric closeness, falling back to the first option. */
export function closestAspect(target: string, allowed: string[]): string {
  if (!allowed.length) return target;
  if (allowed.includes(target)) return target;
  const wanted = ratioValue(target);
  if (wanted == null) return allowed[0];
  let best = allowed[0];
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const option of allowed) {
    const value = ratioValue(option);
    if (value == null) continue;
    const delta = Math.abs(Math.log(value / wanted));
    if (delta < bestDelta) {
      bestDelta = delta;
      best = option;
    }
  }
  return best;
}

function resolutionRank(value: string): number {
  const digits = /(\d+)\s*p/i.exec(value);
  if (digits) return Number(digits[1]);
  if (/^(\d+)k$/i.test(value)) return Number(/^(\d+)k$/i.exec(value)![1]) * 1000;
  return 0;
}

function closestByRank(target: string, allowed: string[]): string {
  if (!allowed.length) return target;
  if (allowed.includes(target)) return target;
  const wanted = resolutionRank(target);
  if (!wanted) return allowed[allowed.length - 1];
  return allowed.reduce((best, option) =>
    Math.abs(resolutionRank(option) - wanted) < Math.abs(resolutionRank(best) - wanted) ? option : best
  , allowed[0]);
}

function closestNumber(target: number, allowed: number[]): number {
  if (!allowed.length) return target;
  if (allowed.includes(target)) return target;
  return allowed.reduce((best, option) =>
    Math.abs(option - target) < Math.abs(best - target) ? option : best
  , allowed[0]);
}

export interface ResolvedForModel {
  settings: StudioSettings;
  adjustments: StudioAdjustment[];
  /** How many of the selected references this model can actually accept. */
  referenceLimit: number;
}

/**
 * Snap shared studio settings to what a single model accepts, reporting every
 * change so the UI can ask the user to approve it before running.
 */
export function resolveForModel(
  model: StudioModel,
  settings: StudioSettings,
  options: { referenceCount?: number } = {}
): ResolvedForModel {
  const adjustments: StudioAdjustment[] = [];
  const name = model.short_label ?? model.label;
  const video = isVideoModel(model);
  const next: StudioSettings = { ...settings, count: 1 };

  const aspects = model.allowed_aspect_ratios ?? [];
  if (aspects.length) {
    const aspect = closestAspect(settings.aspect_ratio, aspects);
    if (aspect !== settings.aspect_ratio) {
      adjustments.push({
        field: "aspect_ratio",
        label: "Aspect ratio",
        from: settings.aspect_ratio,
        to: aspect,
        message: `${name} doesn't support ${settings.aspect_ratio} — closest match is ${aspect}.`
      });
    }
    next.aspect_ratio = aspect;
  }

  if (video) {
    const resolutions = model.allowed_resolutions ?? [];
    if (resolutions.length) {
      const current = settings.video_resolution ?? resolutions[resolutions.length - 1];
      const resolution = closestByRank(current, resolutions);
      if (settings.video_resolution && resolution !== settings.video_resolution) {
        adjustments.push({
          field: "video_resolution",
          label: "Quality",
          from: settings.video_resolution,
          to: resolution,
          message: `${name} doesn't render ${settings.video_resolution} — closest match is ${resolution}.`
        });
      }
      next.video_resolution = resolution;
    } else {
      next.video_resolution = undefined;
    }

    const durations = model.allowed_durations ?? [];
    if (durations.length) {
      const current = settings.duration ?? durations[0];
      const duration = closestNumber(current, durations);
      if (settings.duration && duration !== settings.duration) {
        adjustments.push({
          field: "duration",
          label: "Duration",
          from: `${settings.duration}s`,
          to: `${duration}s`,
          message: `${name} can't run ${settings.duration}s clips — closest match is ${duration}s.`
        });
      }
      next.duration = duration;
    } else {
      next.duration = undefined;
    }
    next.image_size = "";
  } else {
    const sizes = model.allowed_image_sizes ?? [];
    if (sizes.length) {
      const forAspect = filterSizesForAspect(sizes, next.aspect_ratio);
      const current = settings.image_size || forAspect[forAspect.length - 1];
      const size = forAspect.includes(current) ? current : closestByRank(current, forAspect);
      if (settings.image_size && size !== settings.image_size) {
        adjustments.push({
          field: "image_size",
          label: "Quality",
          from: settings.image_size,
          to: size,
          message: `${name} doesn't offer ${settings.image_size} — closest match is ${size}.`
        });
      }
      next.image_size = size;
    } else {
      next.image_size = "";
    }
    next.duration = undefined;
    next.video_resolution = undefined;
  }

  const referenceCount = options.referenceCount ?? 0;
  const referenceLimit = model.reference_image_limit ?? 0;
  if (referenceCount > referenceLimit) {
    adjustments.push({
      field: "references",
      label: "References",
      from: `${referenceCount} refs`,
      to: `${referenceLimit} refs`,
      message: referenceLimit === 0
        ? `${name} takes no reference images — they'll be dropped for this side.`
        : `${name} accepts ${referenceLimit} reference image${referenceLimit === 1 ? "" : "s"} — only the first ${referenceLimit} will be sent.`
    });
  }

  return { settings: next, adjustments, referenceLimit };
}

export interface CompareMeta {
  group?: string;
  side?: "A" | "B";
}

/** Read the side-by-side markers a compare run wrote into a turn's settings JSON. */
export function parseCompareMeta(settingsJson?: string | null): CompareMeta {
  if (!settingsJson) return {};
  try {
    const parsed = JSON.parse(settingsJson) as StudioSettings;
    const group = typeof parsed?.compare_group === "string" ? parsed.compare_group : undefined;
    const side = parsed?.compare_side === "A" || parsed?.compare_side === "B" ? parsed.compare_side : undefined;
    return { group, side };
  } catch {
    return {};
  }
}

/**
 * Collapse a turn list into rows: comparison pairs become one two-item row,
 * everything else stays a single-item row. Input order is preserved.
 */
export function groupCompareRows<T extends { id: string; settings_json?: string | null }>(turns: T[]): T[][] {
  const rows: T[][] = [];
  const seenGroups = new Set<string>();
  for (const turn of turns) {
    const { group } = parseCompareMeta(turn.settings_json);
    if (!group) {
      rows.push([turn]);
      continue;
    }
    if (seenGroups.has(group)) continue;
    seenGroups.add(group);
    const members = turns.filter((item) => parseCompareMeta(item.settings_json).group === group);
    members.sort((a, b) => (parseCompareMeta(a.settings_json).side ?? "A").localeCompare(parseCompareMeta(b.settings_json).side ?? "A"));
    rows.push(members);
  }
  return rows;
}
