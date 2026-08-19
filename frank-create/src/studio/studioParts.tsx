import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

import {
  Icon,

  Spinner,
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
import { createBriefPayload } from "../lib/frankWorkflow";
import {
  buildTurnRequest,
  aspectRatioParts,
  makeLocalId,
  buildReferenceManifest,
  expandReferenceTags,
  thumbnailUrl
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




export function ReferencePickerCard({
  asset,
  active,
  selected,
  onPick
}: {
  asset: Asset;
  active: boolean;
  selected: boolean;
  onPick: () => void | Promise<void>;
}) {
  const full = asset.preview_url || asset.remote_url;
  const [src, setSrc] = useState(() => thumbnailUrl(full, 150, 25, "webp"));
  return (
    <button
      type="button"
      className={`reference-picker-card${active ? " is-active" : ""}${selected ? " is-selected" : ""}`}
      onClick={() => { void onPick(); }}
      title={asset.title}
      aria-pressed={selected}
      disabled={active}
    >
      {src ? (
        <img
          src={src}
          alt={asset.title}
          loading="lazy"
          decoding="async"
          width={150}
          height={150}
          onError={() => {
            // Transformed variants aren't available for every source; fall back
            // to the original URL so the tile still renders.
            if (full && src !== full) setSrc(full);
          }}
        />
      ) : (
        <span className="reference-picker-card-fallback"><Icon source="photo" tone="inherit" size={18} /></span>
      )}
      <span className="reference-picker-card-title">{asset.title}</span>
      {active ? (
        <span className="reference-picker-card-flag">In use</span>
      ) : selected ? (
        <span className="reference-picker-card-check"><Icon source="check-circle" tone="inherit" size={16} /></span>
      ) : null}
    </button>
  );
}



export function SessionCancelDialog({
  session,
  onCancel,
  onConfirm
}: {
  session: StudioSession;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="session-cancel-modal" role="dialog" aria-modal="true" aria-label="Cancel session confirmation">
      <section className="session-cancel-card">
        <button className="lightbox-close" type="button" onClick={onCancel} aria-label="Close cancel dialog">
          <Icon source="x-mark" tone="inherit" size={18} />
        </button>
        <p className="eyebrow">Session control</p>
        <h2>Cancel this session?</h2>
        <p>
          <strong>{session.name}</strong> will be archived and removed from the active session list. Generated files,
          exports, and receipts stay on disk.
        </p>
        <div className="session-cancel-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>
            Keep session
          </button>
          <button className="secondary-button danger-button" type="button" onClick={onConfirm}>
            <Icon source="x-mark" tone="inherit" size={16} />
            Cancel session
          </button>
        </div>
      </section>
    </div>
  );
}


export function CompareDialog({
  baseAsset,
  targetAsset,
  onClose,
  onEdit
}: {
  baseAsset: Asset;
  targetAsset: Asset;
  onClose: () => void;
  onEdit: (asset: Asset) => void;
}) {

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="compare-modal" role="dialog" aria-modal="true" aria-label="Compare picks">
      <div className="compare-modal-inner">
        <header className="compare-header">
          <div>
            <p className="eyebrow">Review</p>
            <h2>Compare picks</h2>
          </div>
          <button className="lightbox-close" type="button" onClick={onClose} aria-label="Close compare">
            <Icon source="x-mark" tone="inherit" size={18} />
          </button>
        </header>
        <div className="compare-grid">
          <ComparePane label="Base pick" asset={baseAsset} onEdit={onEdit} />
          <ComparePane label="Challenger" asset={targetAsset} onEdit={onEdit} />

        </div>
      </div>
    </div>
  );
}

export function ComparePane({
  label,
  asset,
  onEdit
}: {
  label: string;
  asset: Asset;
  onEdit: (asset: Asset) => void;
}) {
  const settings = parseJsonRecord(asset.settings_json);
  const dimensions = asset.width && asset.height ? `${asset.width} x ${asset.height}` : "size pending";

  return (
    <section className="compare-pane">
      <div className="compare-image">
        <AssetPreviewMedia asset={asset} fallbackIconSize={38} />
      </div>
      <div className="compare-copy">
        <p className="eyebrow">{label}</p>
        <h3>{asset.title}</h3>
        <div className="compare-meta">
          <span>{asset.model ?? "model pending"}</span>
          <span>{dimensions}</span>
          {settings.aspect_ratio ? <span>{String(settings.aspect_ratio)}</span> : null}
        </div>
        {asset.notes ? <p>{asset.notes}</p> : <p>No notes yet.</p>}
        <div className="compare-actions">
          <button type="button" onClick={() => onEdit(asset)}>
            <Icon source="sparkles" tone="inherit" size={15} />
            Edit

          </button>
        </div>
      </div>
    </section>
  );
}

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


export function AssetPreviewMedia({
  asset,
  controls = false,
  fallbackIconSize = 24,
  variant = "full"
}: {
  asset: Asset;
  controls?: boolean;
  fallbackIconSize?: number;
  variant?: "thumb" | "full";
}) {
  if (!asset.preview_url) {
    if (controls) {
      return (
        <div className="asset-preview-placeholder">
          <Icon source="photo" tone="inherit" size={fallbackIconSize} />
          <span>{asset.title}</span>
        </div>
      );
    }
    return <Icon source="photo" tone="inherit" size={fallbackIconSize} />;
  }

  const isThumb = variant === "thumb";

  if (isPlayableVideoAsset(asset)) {
    return (
      <video
        aria-label={asset.title}
        autoPlay={!controls && !isThumb}
        className="asset-preview-media"
        controls={controls}
        loop
        muted={!controls}
        playsInline
        preload="metadata"
        src={asset.preview_url}
      />
    );
  }

  if (isThumb) {
    return <AssetThumbImage asset={asset} />;
  }

  return <img className="asset-preview-media" src={asset.preview_url} alt={asset.title} />;
}

export function AssetThumbImage({ asset }: { asset: Asset }) {
  const full = asset.preview_url ?? "";
  const [src, setSrc] = useState(() => thumbnailUrl(full, 320, 40, "webp") || full);
  useEffect(() => {
    setSrc(thumbnailUrl(full, 320, 40, "webp") || full);
  }, [full]);
  return (
    <img
      className="asset-preview-media"
      src={src}
      alt={asset.title}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (full && src !== full) setSrc(full);
      }}
    />
  );
}


export function MaskPainterDialog({
  asset,
  busy,
  onClose,
  onSave
}: {
  asset: Asset;
  busy: boolean;
  onClose: () => void;
  onSave: (file: File) => void | Promise<void>;
}) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintingRef = useRef(false);
  const [brushSize, setBrushSize] = useState(54);
  const [canvasReady, setCanvasReady] = useState(false);
  const [hasMask, setHasMask] = useState(false);

  useEffect(() => {
    setBrushSize(54);
    setCanvasReady(false);
    setHasMask(false);
    paintingRef.current = false;
  }, [asset.id]);

  function prepareCanvas() {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) {
      return;
    }

    canvas.width = image.naturalWidth || 1200;
    canvas.height = image.naturalHeight || 1200;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasReady(true);
    setHasMask(false);
  }

  function pointForEvent(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function paintAt(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = pointForEvent(event);
    if (!canvas || !point) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(196, 17, 47, 0.72)";
    ctx.beginPath();
    ctx.arc(point.x, point.y, brushSize, 0, Math.PI * 2);
    ctx.fill();
    setHasMask(true);
  }

  function startPainting(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!canvasReady || busy) {
      return;
    }

    paintingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic browser-QA events do not always create an active pointer capture target.
    }
    paintAt(event);
  }

  function continuePainting(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!paintingRef.current || busy) {
      return;
    }
    paintAt(event);
  }

  function stopPainting(event: ReactPointerEvent<HTMLCanvasElement>) {
    paintingRef.current = false;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Pointer capture can already be gone after synthetic or interrupted input.
    }
  }

  function clearMask() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
  }

  function saveMask() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !hasMask) {
      return;
    }

    const output = document.createElement("canvas");
    output.width = canvas.width;
    output.height = canvas.height;
    const outputCtx = output.getContext("2d");
    if (!outputCtx) {
      return;
    }

    outputCtx.fillStyle = "#000000";
    outputCtx.fillRect(0, 0, output.width, output.height);
    const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = outputCtx.getImageData(0, 0, output.width, output.height);
    for (let index = 0; index < source.data.length; index += 4) {
      if (source.data[index + 3] > 0) {
        mask.data[index] = 255;
        mask.data[index + 1] = 255;
        mask.data[index + 2] = 255;
        mask.data[index + 3] = 255;
      }
    }
    outputCtx.putImageData(mask, 0, 0);
    output.toBlob((blob) => {
      if (!blob) {
        return;
      }
      void onSave(new File([blob], `painted-mask-${asset.id}.png`, { type: "image/png" }));
    }, "image/png");
  }

  return (
    <div className="mask-painter-backdrop" role="dialog" aria-modal="true" aria-label="Paint edit mask" onClick={onClose}>
      <div className="mask-painter" onClick={(event) => event.stopPropagation()}>
        <div className="mask-painter-header">
          <div>
            <p className="eyebrow">Masked Edit</p>
            <h3>Paint the bits to change</h3>
            <span>{asset.title}</span>
          </div>
          <button className="lightbox-close" type="button" onClick={onClose} aria-label="Close mask painter">
            <Icon source="x-mark" tone="inherit" size={18} />
          </button>
        </div>
        <div className="mask-painter-stage">
          {asset.preview_url ? <img ref={imageRef} src={asset.preview_url} alt="" onLoad={prepareCanvas} /> : <Icon source="photo" tone="inherit" size={42} />}
          <canvas
            ref={canvasRef}
            aria-label="Painted edit mask"
            onPointerDown={startPainting}
            onPointerMove={continuePainting}
            onPointerUp={stopPainting}
            onPointerCancel={stopPainting}
          />
        </div>
        <div className="mask-painter-controls">
          <label>
            <span>Brush</span>
            <input
              type="range"
              min="12"
              max="140"
              step="2"
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
            />
          </label>
          <button className="secondary-button" type="button" onClick={clearMask} disabled={!hasMask || busy}>
            Clear
          </button>
          <button className="primary-button" type="button" onClick={saveMask} disabled={!hasMask || !canvasReady || busy}>
            {busy ? <Spinner size="small" /> : <Icon source="pencil-square" tone="inherit" size={16} />}
            Use mask
          </button>
        </div>
      </div>
    </div>
  );
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

export function OutputStrip({
  assets,
  emptyLabel = "Waiting for provider output",
  pending = false,
  pendingCount = 1,
  pendingAspect,
  selectedAssetId,
  onSelect
}: {
  assets: Asset[];
  emptyLabel?: string;
  pending?: boolean;
  pendingCount?: number;
  pendingAspect?: string;
  selectedAssetId?: string;
  onSelect: (asset: Asset) => void;


}) {
  if (!assets.length && !pending) {
    return (
      <div className="output-placeholder">
        <Icon source="arrow-path" tone="inherit" size={18} />
        {emptyLabel}
      </div>
    );
  }

  const aspectParts = pendingAspect ? aspectRatioParts(pendingAspect) : null;
  const fallbackAsset = assets.find((asset) => asset.width && asset.height);
  const pendingRatio = aspectParts
    ? `${aspectParts.width} / ${aspectParts.height}`
    : fallbackAsset
      ? `${fallbackAsset.width} / ${fallbackAsset.height}`
      : "1 / 1";
  const skeletonCount = pending ? Math.max(0, Math.min(24, pendingCount) - assets.length) : 0;

  return (
    <div className="output-grid">

      {assets.map((asset) => {
        const ratio = asset.width && asset.height ? `${asset.width} / ${asset.height}` : undefined;
        return (
          <div
            className={`output-tile${selectedAssetId === asset.id ? " selected" : ""}`}

            key={asset.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-frank-asset", asset.id);
              event.dataTransfer.effectAllowed = "copy";
            }}
            title={`${asset.title} — drag onto "Add references" to reuse`}
            style={ratio ? ({ ["--asset-aspect" as string]: ratio } as React.CSSProperties) : undefined}
          >

            <button
              type="button"
              className="output-tile-select"
              onClick={() => onSelect(asset)}
              aria-label={`Open ${asset.title}`}
            >
              <AssetPreviewMedia asset={asset} fallbackIconSize={24} variant="thumb" />
            </button>
            {asset.width && asset.height ? (
              <span className="output-tile-resolution" title="Resolution returned by the provider">
                {asset.width} × {asset.height}
              </span>
            ) : null}

          </div>

        );
      })}
      {Array.from({ length: skeletonCount }).map((_, index) => (
        <div
          className="output-skeleton"
          key={`pending-${index}`}
          style={{ ["--asset-aspect" as string]: pendingRatio } as React.CSSProperties}
        >
          <span className="output-skeleton-shimmer" aria-hidden="true" />
          <span className="output-skeleton-spinner" aria-hidden="true" />
        </div>
      ))}
    </div>

  );
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
