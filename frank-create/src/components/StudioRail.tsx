import { ChevronLeft, Film, Image as ImageIcon, RotateCcw } from "lucide-react";
import type { PromptPreset, StudioModel, StudioSettings } from "../lib/types";
import { estimateVideoCost, filterSizesForAspect, maxCountForModel, modelRateLabel } from "../lib/studio";
import type { StudioFieldErrors } from "../lib/studio";
import { AspectPreview } from "./AspectPreview";


export interface StudioRailProps {
  mediaKind: "image" | "video";
  onMediaKindChange: (kind: "image" | "video") => void;
  models: StudioModel[];
  selectedModelId: string;
  onModelChange: (id: string) => void;
  settings: StudioSettings;
  onSettingsChange: (patch: Partial<StudioSettings>) => void;
  onAspectChange: (aspect: string) => void;
  presets: PromptPreset[];
  selectedPresetKey: string | null;
  onPresetChange: (key: string | null) => void;
  fieldErrors: StudioFieldErrors;
  referenceCount: number;
  onReset: () => void;
  onClose: () => void;
}

function ratioBoxStyle(aspect: string) {
  const parts = /^(\d+(?:\.\d+)?)[:x](\d+(?:\.\d+)?)$/i.exec(aspect.trim());
  const ratio = parts ? Number(parts[1]) / Number(parts[2]) : 1;
  const cap = 34;
  const width = ratio >= 1 ? cap : Math.round(cap * ratio);
  const height = ratio >= 1 ? Math.round(cap / ratio) : cap;
  return { width: `${width}px`, height: `${height}px` };
}

function tierBadge(model: StudioModel | undefined) {
  if (model?.price_tier === "cheapest") return { label: "Cheapest", className: "rail-price-tag cheapest" };
  if (model?.price_tier === "premium") return { label: "Most expensive", className: "rail-price-tag premium" };
  return null;
}


export function StudioRail(props: StudioRailProps) {
  const {
    mediaKind, onMediaKindChange, models, selectedModelId, onModelChange,
    settings, onSettingsChange, onAspectChange, presets, selectedPresetKey,
    onPresetChange, fieldErrors, referenceCount, onReset, onClose
  } = props;

  const model = models.find((item) => item.id === selectedModelId) ?? models[0];
  const isVideo = mediaKind === "video";
  const aspects = model?.allowed_aspect_ratios ?? [];
  const durations = model?.allowed_durations ?? [];
  const resolutions = model?.allowed_resolutions ?? [];
  const sizes = model?.allowed_image_sizes?.length
    ? filterSizesForAspect(model.allowed_image_sizes, settings.aspect_ratio)
    : [];
  const countCap = isVideo ? 1 : maxCountForModel(model);
  const counts = Array.from({ length: Math.min(countCap, 10) }, (_, index) => index + 1);

  return (
    <aside className="studio-settings-rail" aria-label="Studio settings">
      <div className="rail-media-toggle" role="tablist" aria-label="Output media">
        <button
          type="button"
          role="tab"
          aria-selected={!isVideo}
          className={!isVideo ? "active" : ""}
          onClick={() => onMediaKindChange("image")}
        >
          <ImageIcon size={14} />
          Image
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isVideo}
          className={isVideo ? "active" : ""}
          onClick={() => onMediaKindChange("video")}
        >
          <Film size={14} />
          Video
        </button>
        <button className="rail-close" type="button" onClick={onClose} aria-label="Close studio settings">
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="rail-scroll">
        <section className="rail-block">
          <p className="rail-label">Model</p>
          <div className="rail-model-card">
            <select
              aria-label="Model"
              value={model?.id ?? ""}
              onChange={(event) => onModelChange(event.target.value)}
            >
              {models.map((item) => (
                <option key={item.id} value={item.id} disabled={item.status === "disabled"}>
                  {(item.short_label ?? item.label)
                    + (item.status === "disabled" ? " (soon)" : item.degraded ? " (provider issue)" : "")}
                </option>
              ))}
            </select>
            <p className="rail-model-desc">{model?.description ?? ""}</p>
            <div className="rail-model-badges">
              <span>{model?.badge || (isVideo ? "video" : "image")}</span>
              <span>{model?.reference_image_limit ?? 0} refs</span>
              {isVideo ? <span>{durations.length ? `${durations[0]}–${durations[durations.length - 1]}s` : "auto"}</span> : null}
            </div>
            {model?.degraded ? (
              <p className="model-degraded-note">{model.degraded_note ?? "This model is failing upstream."}</p>
            ) : null}
          </div>
        </section>

        {aspects.length ? (
          <section className="rail-block">
            <p className="rail-label">{isVideo ? "Video dimensions" : "Aspect ratio"}</p>
            <div className="rail-tiles">
              {aspects.map((aspect) => (
                <button
                  key={aspect}
                  type="button"
                  className={`rail-tile${settings.aspect_ratio === aspect ? " active" : ""}`}
                  onClick={() => onAspectChange(aspect)}
                >
                  <span className="rail-tile-box" style={ratioBoxStyle(aspect)} aria-hidden="true" />
                  <span className="rail-tile-label">{aspect}</span>
                </button>
              ))}
            </div>
            {fieldErrors.aspect ? <p className="field-error" role="alert">{fieldErrors.aspect}</p> : null}
          </section>
        ) : null}

        {isVideo && durations.length ? (
          <section className="rail-block">
            <p className="rail-label">Duration</p>
            <div className="rail-chips">
              {durations.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  className={`rail-chip${settings.duration === duration ? " active" : ""}`}
                  onClick={() => onSettingsChange({ duration })}
                >
                  {duration}s
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {isVideo && resolutions.length ? (
          <section className="rail-block">
            <p className="rail-label">Quality</p>
            <div className="rail-chips">
              {resolutions.map((resolution) => (
                <button
                  key={resolution}
                  type="button"
                  className={`rail-chip${settings.video_resolution === resolution ? " active" : ""}`}
                  onClick={() => onSettingsChange({ video_resolution: resolution })}
                >
                  {resolution}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {!isVideo && sizes.length ? (
          <section className="rail-block">
            <p className="rail-label">Quality</p>
            <div className="rail-chips">
              {sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={`rail-chip${settings.image_size === size ? " active" : ""}`}
                  onClick={() => onSettingsChange({ image_size: size })}
                >
                  {size}
                </button>
              ))}
            </div>
            {fieldErrors.size ? <p className="field-error" role="alert">{fieldErrors.size}</p> : null}
          </section>
        ) : null}

        {!isVideo ? (
          <section className="rail-block">
            <p className="rail-label">Generation count</p>
            <div className="rail-chips">
              {counts.map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`rail-chip${settings.count === count ? " active" : ""}`}
                  onClick={() => onSettingsChange({ count })}
                >
                  {count}
                </button>
              ))}
            </div>
            {fieldErrors.count ? <p className="field-error" role="alert">{fieldErrors.count}</p> : null}
          </section>
        ) : null}

        <section className="rail-block">
          <p className="rail-label">Style preset</p>
          <select
            aria-label="Style preset"
            value={selectedPresetKey ?? ""}
            onChange={(event) => onPresetChange(event.target.value || null)}
          >
            <option value="">— None —</option>
            {presets.map((preset) => (
              <option key={preset.key} value={preset.key}>{preset.label}</option>
            ))}
          </select>
          <p className="rail-hint">Appended as an editable paragraph to your brief.</p>
        </section>

        <section className="rail-block">
          <AspectPreview
            aspect={settings.aspect_ratio}
            size={isVideo ? settings.video_resolution : (sizes.length ? settings.image_size : undefined)}
            label={model?.short_label ?? model?.label}
            count={isVideo ? 1 : settings.count}
          />
          {fieldErrors.references ? <p className="field-error" role="alert">{fieldErrors.references}</p> : null}
          {isVideo && model?.requires_source_image && !referenceCount ? (
            <p className="field-error" role="alert">
              {model.short_label ?? model.label} needs a source frame — pick a reference or an image from the thread.
            </p>
          ) : null}
        </section>

        <button className="rail-reset" type="button" onClick={onReset}>
          <RotateCcw size={14} />
          Reset to defaults
        </button>
      </div>
    </aside>
  );
}
