import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

import {
  Icon,

} from "../ds";
import { Shell } from "../Shell";
import { modeFromUrl, navigate } from "../nav";
import type { InAppScreen, Screen } from "../nav";

import {
  createInferenceTurn,
  fetchTurnStatus,
  createReference,
  createSession,
  createVideoStoryboard,
  deleteAsset,
  deleteTurn,
  fetchConfig,
  fetchHealth,
  listAssets,
  listSessions,
  listTurns,
  updateSession
} from "../lib/api";

import { fallbackBrandKit, fallbackConfig } from "../lib/presets";
import { supabase, hardSignOut } from "../lib/supabaseClient";
import {
  buildTurnRequest,
  makeLocalId,
  buildReferenceManifest,
  expandReferenceTags,
} from "../lib/studio";
import type { StudioFieldErrors } from "../lib/studio";

import { StudioRail } from "../components/StudioRail";


import { PromptGenerator } from "../components/PromptGenerator";
import Enhancer from "../components/Enhancer";

import type {
  Asset,
  FrankConfig,
  FrankTask,
  StudioModel,
  StudioSession,
  StudioSettings,
  StudioTurn
} from "../lib/types";
import { loadLocalAssets, saveLocalAssets } from "../lib/localAssets";
import { SessionFolders } from "../components/SessionFolders";
import { clampWords } from "../lib/clampWords";




export function promptForTask(task: FrankTask) {
  const prompts: Record<string, string> = {
    "background-remove":
      "Background sweep: isolate the product cleanly for a transparent PNG and PDP-safe product cutout. Keep packaging edges sharp, shadows soft, and label details honest.",
    "background-replace":
      "Background glow-up: keep the product truthful, replace the set with a Frank Body pink/coffee lifestyle backdrop, and leave useful campaign negative space.",
    "product-cleanup":
      "Product polish: clean dust, label edges, smudges, and small lighting issues while keeping the packaging real and recognizable.",
    "campaign-variants":
      "Campaign remix: create a bolder Frank Body campaign direction from the same product truth, with cheeky attitude and room for headline copy.",
    "aspect-crops":
      "Crop the goods: prepare channel-ready PDP, email hero, Instagram feed/story, and paid social compositions without cutting off the product.",
    "upscale-enhance":
      "Make it bigger: produce a high-res master with crisp packaging, clean texture detail, and no over-sharpened plastic finish.",
    "prompt-remix":
      "Brief remix: rewrite this into sharper creative directions for the Art Dept., keeping the product truth, channel, mood, and Frank voice clear."
  };

  return prompts[task.key] ?? `${task.label}: ${task.description}`;
}

export function settingsForTask(taskKey: string, current: StudioSettings, model?: StudioModel): StudioSettings {
  const next = { ...current };
  if (["background-remove", "upscale-enhance"].includes(taskKey)) {
    next.count = 1;
    next.image_size = supportedOption(model?.allowed_image_sizes, "4K", current.image_size);
  } else if (taskKey === "product-cleanup") {
    next.count = 2;
    next.image_size = supportedOption(model?.allowed_image_sizes, "4K", current.image_size);
  } else if (["background-replace", "campaign-variants", "aspect-crops"].includes(taskKey)) {
    next.count = 4;
    next.aspect_ratio = supportedOption(model?.allowed_aspect_ratios, "4:5", current.aspect_ratio);
  }
  return next;
}

export function supportedOption(options: string[] | undefined, preferred: string, fallback: string) {
  if (options?.includes(preferred)) {
    return preferred;
  }
  return fallback;
}

export function taskShortcutIcon(taskKey: string) {
  if (taskKey === "background-remove") {
    return <Icon source="photo" tone="inherit" size={15} />;
  }
  if (taskKey === "background-replace" || taskKey === "campaign-variants") {
    return <Icon source="bolt" tone="inherit" size={15} />;
  }
  if (taskKey === "product-cleanup" || taskKey === "upscale-enhance") {
    return <Icon source="sparkles" tone="inherit" size={15} />;
  }
  if (taskKey === "aspect-crops") {
    return <Icon source="rectangle-stack" tone="inherit" size={15} />;
  }
  return <Icon source="arrow-path" tone="inherit" size={15} />;
}

export function isPlayableVideoAsset(asset: Asset) {
  if (asset.media_type !== "video") {
    return false;
  }
  const haystack = decodeURIComponent(`${asset.preview_url ?? ""} ${asset.file_path ?? ""}`).toLowerCase();
  return /\.(mp4|webm|mov|m4v)(?:$|[?#\s&])/.test(haystack) || /filename=[^&\s]+\.(mp4|webm|mov|m4v)/.test(haystack);
}

export function turnExpectedCount(turn: StudioTurn) {
  const parsed = parseJsonRecord(turn.settings_json) as { count?: unknown };
  const raw = Number(parsed.count);
  return Number.isFinite(raw) && raw > 0 ? Math.min(24, Math.floor(raw)) : 1;
}

/** Human label for the aspect chip; passes through provider enums like "match_input_image". */

export function formatAspectChip(value: string) {
  if (!value) return "";
  if (/^\d+(\.\d+)?\s*:\s*\d+(\.\d+)?$/.test(value)) return value.replace(/\s+/g, "");
  return value.replace(/[_-]+/g, " ").toLowerCase();
}

/** Pretty-print the stored provider request body for the JSON chip modal. */

export function formatProviderPayload(turn?: StudioTurn) {
  if (!turn) return "No request body was captured for this round.";
  if (turn.provider_request_json) {
    try {
      return JSON.stringify(JSON.parse(turn.provider_request_json), null, 2);
    } catch {
      return turn.provider_request_json;
    }
  }
  // Still running (or captured before this feature existed): show the request as
  // it was composed client-side, so the round can be troubleshot right away.
  const settings = parseJsonRecord(turn.settings_json);
  const pending = {
    note: "Provider response not captured yet — this is the request composed for this round.",
    model: turn.model,
    prompt: turn.prompt,
    settings,
    reference_asset_ids: (() => {
      try { return JSON.parse((turn as { reference_asset_ids_json?: string }).reference_asset_ids_json || "[]"); } catch { return []; }
    })(),
  };
  return JSON.stringify(pending, null, 2);
}

export function turnAspect(turn: StudioTurn) {

  const parsed = parseJsonRecord(turn.settings_json) as { aspect_ratio?: unknown };
  return typeof parsed.aspect_ratio === "string" ? parsed.aspect_ratio : "";
}

export function mergeModels(remote: StudioModel[] | undefined, fallback: StudioModel[]): StudioModel[] {
  const localById = new Map(fallback.map((m) => [m.id, m]));
  // Provider-outage flags live in the local model roster, so re-apply them onto
  // remote entries — otherwise a backend config refresh silently clears them.
  const out: StudioModel[] = remote?.length
    ? remote.map((m) => {
        const local = localById.get(m.id);
        let merged = m;
        if (local?.degraded) merged = { ...merged, degraded: true, degraded_note: local.degraded_note };
        // Legacy/superseded flags are curated locally; never let a backend
        // roster refresh resurrect a retired model in the pickers.
        if (local?.legacy) merged = { ...merged, legacy: true };
        return merged;
      })
    : [];

  const seen = new Set(out.map((m) => m.id));
  for (const m of fallback) {
    if (!seen.has(m.id)) out.push(m);
  }
  return out.length ? out : fallback;
}

export function mergeConfig(config: FrankConfig): FrankConfig {
  return {
    ...fallbackConfig,
    ...config,
    models: mergeModels(config.models, fallbackConfig.models),
    backlogModels: config.backlogModels ?? fallbackConfig.backlogModels,
    promptPresets: config.promptPresets?.length ? config.promptPresets : fallbackConfig.promptPresets,
    exportPresets: config.exportPresets?.length ? config.exportPresets : fallbackConfig.exportPresets,
    tasks: config.tasks?.length ? config.tasks : fallbackConfig.tasks,
    providers: config.providers?.length ? config.providers : fallbackConfig.providers,
    voice: { ...fallbackConfig.voice, ...config.voice }
  };
}

export function isMainDemoSession(session: StudioSession) {
  return session.name.trim().toLowerCase() === "frank body demo studio";
}

export function chooseLaunchSession(sessions: StudioSession[]) {
  return sessions.find(isMainDemoSession) ?? sessions[0];
}

export function firstReviewableAsset(assets: Asset[]) {
  const outputAssets = assets.filter((asset) => !["reference", "mask"].includes(asset.kind));
  return outputAssets.find((asset) => (asset.media_type ?? "image") !== "video") ?? outputAssets[0] ?? null;
}

export const LAST_MODEL_KEY = "frank.lastUsedModelId";

export const LAST_MODEL_BY_MEDIA_KEY = "frank.lastUsedModelIdByMedia";

export function readLastUsedModelId(media?: "image" | "video"): string | null {
  try {
    if (typeof window === "undefined") return null;
    if (media) {
      const raw = window.localStorage.getItem(LAST_MODEL_BY_MEDIA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        const stored = parsed?.[media];
        if (typeof stored === "string" && stored) return stored;
      }
      return null;
    }
    return window.localStorage.getItem(LAST_MODEL_KEY);
  } catch {
    return null;
  }
}

export function writeLastUsedModelId(id: string, media?: "image" | "video"): void {
  try {
    window.localStorage.setItem(LAST_MODEL_KEY, id);
    if (media) {
      let parsed: Record<string, string> = {};
      try {
        parsed = JSON.parse(window.localStorage.getItem(LAST_MODEL_BY_MEDIA_KEY) ?? "{}") ?? {};
      } catch {
        parsed = {};
      }
      parsed[media] = id;
      window.localStorage.setItem(LAST_MODEL_BY_MEDIA_KEY, JSON.stringify(parsed));
    }
  } catch {
    /* storage blocked — the default just doesn't persist */
  }
}

export function preferredStudioModel(models: StudioModel[], preferredId?: string | null) {
  // A stored preference can point at a retired model (e.g. Seedream 4.5 after
  // 5.0 Pro landed); those are hidden from the pickers, so never restore one.
  const usable = (model: StudioModel) => model.configured !== false && model.legacy !== true;
  return (
    (preferredId ? models.find((model) => model.id === preferredId && usable(model)) : undefined) ??
    models.find((model) => model.id === "google-nb-pro" && usable(model)) ??
    models.find(usable) ??
    models[0] ??
    fallbackConfig.models[0]
  );
}

export function modelName(config: FrankConfig, modelId: string) {
  return config.models.find((model) => model.id === modelId)?.short_label ?? modelId;
}

export function safeFileStem(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || "frank-create-workflow"
  );
}

export function turnEmptyLabel(turn: StudioTurn) {
  if (turn.status === "blocked") {
    let code: string | undefined;
    try {
      code = turn.error_json ? (JSON.parse(turn.error_json)?.code as string | undefined) : undefined;
    } catch {
      code = undefined;
    }
    if (code === "offline") {
      return "Staged locally — preview backend offline";
    }
    return "Provider setup needed";
  }
  if (turn.status === "failed") {
    const detail = turnErrorCopy(turn);
    return detail || "Provider returned no image";
  }
  return "Waiting for provider output";
}

export function turnKindLabel(turn: StudioTurn) {
  if (turn.kind === "edit") {
    return "Edit round";
  }
  if (turn.kind === "video") {
    return "Motion round";
  }
  return "Generate round";
}

export function referenceCountLabel(count: number) {
  return `${count} reference${count === 1 ? "" : "s"}`;
}

export function turnErrorCopy(turn: StudioTurn) {
  if (!turn.error_json) {
    return "";
  }

  try {
    const error = JSON.parse(turn.error_json) as { code?: string; env_vars?: string[]; message?: string };
    if (error.code === "missing_key" && error.env_vars?.length) {
      return `Needs ${error.env_vars.join(" or ")}`;
    }
    return error.message ?? error.code ?? "";
  } catch {
    return turn.error_json;
  }
}

export function parseJsonRecord(value?: unknown) {
  if (!value) {
    return {} as Record<string, unknown>;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") {
    return {} as Record<string, unknown>;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function modelMissingKeyAction(model?: StudioModel) {
  if (!model || model.provider === "local" || model.configured !== false) {
    return "";
  }

  const envVars = (model.missing_env_vars?.length ? model.missing_env_vars : model.env_vars) ?? [];
  if (!envVars.length) {
    return `${model.short_label ?? model.label} needs a server key before live API rounds.`;
  }

  return `Add ${envVars.join(" or ")} in the server key file, then reload keys.`;
}

export function modelReferenceLimitAction(model: StudioModel | undefined, referenceCount: number) {
  const limit = Number(model?.reference_image_limit ?? 0);
  if (!model || !Number.isFinite(limit) || limit <= 0 || referenceCount <= limit) {
    return "";
  }

  const extraCount = referenceCount - limit;
  return `${model.short_label ?? model.label} can use ${limit} references. Remove ${extraCount} ${
    extraCount === 1 ? "reference" : "references"
  } before making this round.`;
}

export function parseReadyStatusLink(text: string) {
  const match = text.match(/^(.+?) link ready: (.+)$/);
  if (!match) {
    return null;
  }
  return { label: match[1], url: match[2] };
}

export function referenceUrlForGeneration(asset: Asset) {
  return asset.remote_url || asset.preview_url || asset.file_path;
}

export function composeVideoReferencePrompt(
  prompt: string,
  references: Asset[],
  firstFrame?: Asset | null,
  lastFrame?: Asset | null
) {
  const frames: string[] = [];
  if (firstFrame) frames.push(`First frame (@first) = ${firstFrame.title}`);
  if (lastFrame) frames.push(`Last frame (@last) = ${lastFrame.title}`);
  let body = prompt
    .replace(/@first\b/gi, "the first frame image (@first)")
    .replace(/@last\b/gi, "the last frame image (@last)");
  if (references.length) {
    body = [buildReferenceManifest(references), expandReferenceTags(body, references)].join("\n");
  }
  return frames.length ? [...frames, body].join("\n") : body;
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read image preview."));
    reader.readAsDataURL(file);
  });
}

export function makeLocalSession(): StudioSession {
  const now = new Date().toISOString();
  return {
    id: makeLocalId("session"),
    name: "Local image session",
    mode: "image",
    status: "preview",
    created_at: now,
    updated_at: now,
    sync_status: "local"
  };
}

export function makeLocalTurn(sessionId: string, request: ReturnType<typeof buildTurnRequest>): StudioTurn {
  const now = new Date().toISOString();
  return {
    id: makeLocalId("turn"),
    session_id: sessionId,
    kind: request.kind,
    provider: "local-preview",
    model: request.model,
    prompt: request.prompt,
    settings_json: JSON.stringify(request.settings),
    reference_asset_ids_json: JSON.stringify(request.reference_asset_ids),
    output_asset_ids_json: "[]",
    frank_body_mode: request.frank_body_mode,
    preset_key: request.preset_key,
    status: "blocked",
    error_json: JSON.stringify({ code: "offline" }),
    sync_status: "local",
    created_at: now,
    updated_at: now
  };
}
