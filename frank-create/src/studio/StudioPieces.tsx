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




import {
  isPlayableVideoAsset,
  parseJsonRecord
} from "./studioFormat";

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
