import { Film, Plus, X } from "lucide-react";
import type { Asset } from "../lib/types";

export type FrameSlotKind = "first" | "last";

export interface FrameSlotsProps {
  /** Whether the selected model's schema accepts an end frame. */
  supportsLastFrame: boolean;
  /** Whether the model refuses text-to-video. */
  requiresFirstFrame: boolean;
  firstFrame: Asset | null;
  lastFrame: Asset | null;
  armedSlot: FrameSlotKind | null;
  onArm: (slot: FrameSlotKind | null) => void;
  onClear: (slot: FrameSlotKind) => void;
  onDropAsset: (slot: FrameSlotKind, assetId: string) => void;
}

function Slot({
  kind,
  label,
  asset,
  armed,
  disabled,
  onArm,
  onClear,
  onDropAsset,
}: {
  kind: FrameSlotKind;
  label: string;
  asset: Asset | null;
  armed: boolean;
  disabled: boolean;
  onArm: () => void;
  onClear: () => void;
  onDropAsset: (assetId: string) => void;
}) {
  const preview = asset?.preview_url ?? null;
  return (
    <div
      className={`frame-slot${armed ? " armed" : ""}${asset ? " filled" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={(event) => {
        if (disabled) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        const id = event.dataTransfer?.getData("application/x-frank-asset") || "";
        if (id) onDropAsset(id);
      }}
    >
      <button
        type="button"
        className="frame-slot-well"
        onClick={onArm}
        disabled={disabled}
        aria-label={armed ? `Cancel picking ${label}` : `Pick ${label}`}
        title={disabled ? "Set a first frame first" : `Pick ${label}`}
      >
        {preview ? (
          <img src={preview} alt={asset?.title ?? label} />
        ) : (
          <span className="frame-slot-empty">
            {armed ? <Film size={14} /> : <Plus size={14} />}
            {armed ? "pick an image" : "pick a frame"}
          </span>
        )}
      </button>
      <span className="frame-slot-label">{label}</span>
      {asset ? (
        <button type="button" className="frame-slot-clear" onClick={onClear} aria-label={`Clear ${label}`}>
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

export function FrameSlots(props: FrameSlotsProps) {
  const { supportsLastFrame, requiresFirstFrame, firstFrame, lastFrame, armedSlot, onArm, onClear, onDropAsset } = props;

  return (
    <section className="rail-block frame-slots-block">
      <p className="rail-label">{supportsLastFrame ? "Frames" : "Source frame"}</p>
      <div className="frame-slots">
        <Slot
          kind="first"
          label={supportsLastFrame ? "first frame" : "source frame"}
          asset={firstFrame}
          armed={armedSlot === "first"}
          disabled={false}
          onArm={() => onArm(armedSlot === "first" ? null : "first")}
          onClear={() => onClear("first")}
          onDropAsset={(id) => onDropAsset("first", id)}
        />
        {supportsLastFrame ? (
          <Slot
            kind="last"
            label="last frame"
            asset={lastFrame}
            armed={armedSlot === "last"}
            disabled={!firstFrame}
            onArm={() => onArm(armedSlot === "last" ? null : "last")}
            onClear={() => onClear("last")}
            onDropAsset={(id) => onDropAsset("last", id)}
          />
        ) : null}
      </div>
      <p className="rail-hint">
        {armedSlot
          ? "Now click any image in the thread or reference dock."
          : supportsLastFrame
            ? "Optional — the last frame needs a first frame. Drag an image onto a slot, or click the slot then an image."
            : requiresFirstFrame
              ? "Required — this model only runs image-to-video."
              : "Optional — leave empty for text-to-video."}
      </p>
    </section>
  );
}
