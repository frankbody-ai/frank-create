import { Columns2, Film, Image as ImageIcon, RotateCcw } from "lucide-react";
import type { PromptPreset, StudioModel, StudioSettings } from "../lib/types";
import { estimateVideoCost, filterSizesForAspect, maxCountForModel, modelRateLabel } from "../lib/studio";
import type { StudioAdjustment, StudioFieldErrors } from "../lib/studio";
import { AspectPreview } from "./AspectPreview";


export type StudioMediaKind = "image" | "video" | "compare";

export interface CompareSideAdjustments {
  side: "A" | "B";
  modelLabel: string;
  items: StudioAdjustment[];
}

export interface StudioRailProps {
  mediaKind: StudioMediaKind;
  onMediaKindChange: (kind: StudioMediaKind) => void;
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
  /** Side-by-side: media the comparison runs on. */
  compareMedia?: "image" | "video";
  onCompareMediaChange?: (media: "image" | "video") => void;
  /** Side-by-side: second model. */
  compareModelBId?: string;
  onCompareModelBChange?: (id: string) => void;
  compareAdjustments?: CompareSideAdjustments[];
  compareApproved?: boolean;
  onCompareApprovedChange?: (approved: boolean) => void;
  compareCostLabel?: string | null;

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
    onPresetChange, fieldErrors, referenceCount, onReset,
    compareMedia = "image", onCompareMediaChange, compareModelBId, onCompareModelBChange,
    compareAdjustments = [], compareApproved = false, onCompareApprovedChange, compareCostLabel

  } = props;

  const isCompare = mediaKind === "compare";
  const model = models.find((item) => item.id === selectedModelId) ?? models[0];
  const modelB = models.find((item) => item.id === compareModelBId) ?? null;
  const isVideo = mediaKind === "video" || (isCompare && compareMedia === "video");
  const aspects = model?.allowed_aspect_ratios ?? [];
  const durations = model?.allowed_durations ?? [];
  const resolutions = model?.allowed_resolutions ?? [];
  const sizes = model?.allowed_image_sizes?.length
    ? filterSizesForAspect(model.allowed_image_sizes, settings.aspect_ratio)
    : [];
  const countCap = isVideo || isCompare ? 1 : maxCountForModel(model);
  const counts = Array.from({ length: Math.min(countCap, 10) }, (_, index) => index + 1);
  const costEstimate = isVideo ? estimateVideoCost(model, settings) : null;
  const badge = isVideo ? tierBadge(model) : null;
  const pendingAdjustments = compareAdjustments.filter((entry) => entry.items.length);



  return (
    <aside className="studio-settings-rail" aria-label="Studio settings">
      <div className="rail-header">
        <div className="rail-media-toggle" role="tablist" aria-label="Output media">
          <button
            type="button"
            role="tab"
            aria-selected={mediaKind === "image"}
            className={mediaKind === "image" ? "active" : ""}
            onClick={() => onMediaKindChange("image")}
          >
            <ImageIcon size={13} />
            <span>Image</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mediaKind === "video"}
            className={mediaKind === "video" ? "active" : ""}
            onClick={() => onMediaKindChange("video")}
          >
            <Film size={13} />
            <span>Video</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isCompare}
            className={isCompare ? "active" : ""}
            onClick={() => onMediaKindChange("compare")}
            title="Run two models on the same brief and compare the results"
          >
            <Columns2 size={13} />
            <span>Compare</span>
          </button>
        </div>
      </div>



      <div className="rail-scroll">
        {isCompare ? (
          <section className="rail-block">
            <p className="rail-label">Compare on</p>
            <div className="rail-chips">
              {(["image", "video"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`rail-chip${compareMedia === kind ? " active" : ""}`}
                  onClick={() => onCompareMediaChange?.(kind)}
                >
                  {kind === "image" ? "Images" : "Videos"}
                </button>
              ))}
            </div>
            <p className="rail-hint">One output per side, same brief and settings — a clean A/B.</p>
          </section>
        ) : null}
        <section className="rail-block">
          <p className="rail-label">{isCompare ? "Model A" : "Model"}</p>

          <div className="rail-model-card">
            <select
              aria-label="Model"
              value={model?.id ?? ""}
              onChange={(event) => onModelChange(event.target.value)}
            >
              {models.map((item) => {
                const rate = modelRateLabel(item);
                const cost = modelCostBadge(item);
                return (
                  <option key={item.id} value={item.id} disabled={item.status === "disabled"}>
                    {(item.short_label ?? item.label)
                      + (cost ? `  ${cost}` : "")
                      + (rate ? ` — ${rate}` : "")
                      + (item.price_tier === "cheapest" ? " · cheapest" : item.price_tier === "premium" ? " · premium" : "")
                      + (item.status === "disabled" ? " (soon)" : item.degraded ? " (provider issue)" : "")}
                  </option>
                );
              })}

            </select>
            <p className="rail-model-desc">{model?.description ?? ""}</p>
            <div className="rail-model-badges">
              <span>{model?.badge || (isVideo ? "video" : "image")}</span>
              <span>{model?.reference_image_limit ?? 0} refs</span>
              {isVideo ? <span>{durations.length ? `${durations[0]}–${durations[durations.length - 1]}s` : "auto"}</span> : null}
              {badge ? <span className={badge.className}>{badge.label}</span> : null}
            </div>
            {costEstimate ? (
              <p className="rail-model-price">
                <strong>{costEstimate}</strong>
                {modelRateLabel(model) ? <span> · {modelRateLabel(model)}</span> : null}
              </p>
            ) : null}
            {model?.degraded ? (
              <p className="model-degraded-note">{model.degraded_note ?? "This model is failing upstream."}</p>
            ) : null}

          </div>
        </section>

        {isCompare ? (
          <section className="rail-block">
            <p className="rail-label">Model B</p>
            <div className="rail-model-card">
              <select
                aria-label="Model B"
                value={modelB?.id ?? ""}
                onChange={(event) => onCompareModelBChange?.(event.target.value)}
              >
                <option value="">— Pick a second model —</option>
                {models.filter((item) => item.id !== model?.id).map((item) => {
                  const rate = modelRateLabel(item);
                  return (
                    <option key={item.id} value={item.id} disabled={item.status === "disabled"}>
                      {(item.short_label ?? item.label)
                        + (rate ? ` — ${rate}` : "")
                        + (item.status === "disabled" ? " (soon)" : item.degraded ? " (provider issue)" : "")}
                    </option>
                  );
                })}
              </select>
              <p className="rail-model-desc">{modelB?.description ?? "Both sides run the same prompt at the same time."}</p>
              {modelB ? (
                <div className="rail-model-badges">
                  <span>{modelB.badge || (isVideo ? "video" : "image")}</span>
                  <span>{modelB.reference_image_limit ?? 0} refs</span>
                  {tierBadge(modelB) ? <span className={tierBadge(modelB)!.className}>{tierBadge(modelB)!.label}</span> : null}
                </div>
              ) : null}
              {modelB?.degraded ? (
                <p className="model-degraded-note">{modelB.degraded_note ?? "This model is failing upstream."}</p>
              ) : null}
            </div>
            {compareCostLabel ? <p className="rail-model-price"><strong>{compareCostLabel}</strong></p> : null}
            {fieldErrors.compare ? <p className="field-error" role="alert">{fieldErrors.compare}</p> : null}
          </section>
        ) : null}

        {isCompare && pendingAdjustments.length ? (
          <section className="rail-block rail-adjustments">
            <p className="rail-label">Settings to adjust</p>
            {pendingAdjustments.map((entry) => (
              <div className="rail-adjust-side" key={entry.side}>
                <p className="rail-adjust-title">Side {entry.side} · {entry.modelLabel}</p>
                <ul>
                  {entry.items.map((item) => (
                    <li key={`${entry.side}-${item.field}`}>
                      <strong>{item.label}:</strong> {item.from} → {item.to}
                      <span>{item.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <label className="rail-adjust-approve">
              <input
                type="checkbox"
                checked={compareApproved}
                onChange={(event) => onCompareApprovedChange?.(event.target.checked)}
              />
              Use the closest supported settings for both sides
            </label>
          </section>
        ) : null}



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
                  <span className="rail-tile-label" title={aspect}>
                    {aspect === "match_input_image" ? "match input" : aspect === "adaptive" ? "adaptive" : aspect}
                  </span>
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

        {(() => {
          const hasPreview = /^\d+(?:\.\d+)?\s*[:x/]\s*\d+(?:\.\d+)?$/i.test(settings.aspect_ratio ?? "");
          const needsFrameError = Boolean(isVideo && model?.requires_source_image && referenceCount === 0);
          if (!hasPreview && !fieldErrors.references && !needsFrameError) return null;
          return (
            <section className="rail-block">
              {hasPreview ? (
                <AspectPreview
                  aspect={settings.aspect_ratio}
                  size={isVideo ? settings.video_resolution : (sizes.length ? settings.image_size : undefined)}
                  label={model?.short_label ?? model?.label}
                  count={isVideo ? 1 : settings.count}
                />
              ) : null}
              {fieldErrors.references ? <p className="field-error" role="alert">{fieldErrors.references}</p> : null}
              {needsFrameError ? (
                <p className="field-error" role="alert">
                  {model?.short_label ?? model?.label} only runs image-to-video — attach a reference image in the brief.
                </p>
              ) : null}
            </section>
          );
        })()}

        <button className="rail-reset" type="button" onClick={onReset}>
          <RotateCcw size={14} />
          Reset to defaults
        </button>
      </div>
    </aside>
  );
}
