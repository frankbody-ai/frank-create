import React from "react";

import { Badge, Button, ButtonGroup, Card, Checkbox, Select, Text } from "../ds";
import type { PromptPreset, StudioModel, StudioSettings } from "../lib/types";
import { estimateVideoCost, filterSizesForAspect, maxCountForModel, modelCostBadge, modelRateLabel } from "../lib/studio";
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

/** Long edge of the aspect thumbnail, in px. Matches --aspect-tile-cap in app.css. */
const ASPECT_TILE_CAP = 30;

function ratioBoxStyle(aspect: string) {
  const parts = /^(\d+(?:\.\d+)?)[:x](\d+(?:\.\d+)?)$/i.exec(aspect.trim());
  const ratio = parts ? Number(parts[1]) / Number(parts[2]) : 1;
  const cap = ASPECT_TILE_CAP;
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



  const chip = (label: React.ReactNode, on: boolean, onClick: () => void, key?: string) => (
    <button
      key={key ?? String(label)}
      type="button"
      className={`filter-chip ${on ? "is-selected" : ""}`}
      aria-pressed={on}
      onClick={onClick}
    >
      {label}
    </button>
  );

  return (
    <Card padding="none" className="run-settings">
      <div className="run-settings__head">
        <ButtonGroup variant="segmented">
          <Button pressed={mediaKind === "image"} onClick={() => onMediaKindChange("image")}>
            Image
          </Button>
          <Button pressed={mediaKind === "video"} onClick={() => onMediaKindChange("video")}>
            Video
          </Button>
          <Button pressed={isCompare} onClick={() => onMediaKindChange("compare")}>
            Compare
          </Button>
        </ButtonGroup>
      </div>

      <div className="run-settings__section">
        {isCompare ? (
          <div className="run-settings__field">
            <span className="run-settings__label">Compare on</span>
            <div className="chip-row">
              {chip("Images", compareMedia === "image", () => onCompareMediaChange?.("image"))}
              {chip("Videos", compareMedia === "video", () => onCompareMediaChange?.("video"))}
            </div>
            <Text variant="bodySm" tone="secondary" as="p">
              Compare runs one output per side from the same brief and settings.
            </Text>
          </div>
        ) : null}

        <Select
          label={isCompare ? "Model A" : "Model"}
          value={model?.id ?? ""}
          onChange={(event) => onModelChange(event.target.value)}
          options={models.map((entry) => ({
            value: entry.id,
            label: [
              entry.short_label || entry.label,
              modelCostBadge(entry),
              entry.status === "disabled" ? "(soon)" : entry.degraded ? "(provider issue)" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          helpText={model?.description}
        />

        <div className="run-settings__badges">
          {Array.from(
            new Set([model?.badge, model?.max_resolution_label].filter(Boolean) as string[])
          ).map((label) => (
            <Badge key={label} tone="neutral">{label}</Badge>
          ))}
          {model?.reference_image_limit ? (
            <Badge tone="neutral">{model.reference_image_limit} references</Badge>
          ) : null}
          {badge ? <Badge tone={model?.price_tier === "premium" ? "warning" : "success"}>{badge.label}</Badge> : null}
        </div>

        {model?.degraded && model.degraded_note ? (
          <Text variant="bodySm" tone="warning" as="p">
            {model.degraded_note}
          </Text>
        ) : null}

        {isCompare ? (
          <Select
            label="Model B"
            value={compareModelBId ?? ""}
            onChange={(event) => onCompareModelBChange?.(event.target.value)}
            error={fieldErrors.compare}
            options={[{ value: "", label: "Pick a second model" }].concat(
              models
                .filter((entry) => entry.id !== model?.id)
                .map((entry) => ({ value: entry.id, label: entry.short_label || entry.label }))
            )}
            helpText={modelB?.description}
          />
        ) : null}
      </div>

      {isCompare && pendingAdjustments.length ? (
        <div className="run-settings__section">
          <span className="run-settings__label">Settings to adjust</span>
          {pendingAdjustments.map((entry) => (
            <div key={entry.side} className="run-settings__adjust">
              <Text variant="headingXs" as="h4">
                {entry.modelLabel}
              </Text>
              <ul>
                {entry.items.map((item) => (
                  <li key={item.field}>
                    {item.label}: {item.from} → <strong>{item.to}</strong>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <Checkbox
            label="Use the closest supported settings"
            checked={compareApproved}
            onChange={(event) => onCompareApprovedChange?.(event.target.checked)}
          />
        </div>
      ) : null}

      <div className="run-settings__section">
        {aspects.length ? (
          <div className="run-settings__field">
            <span className="run-settings__label">{isVideo ? "Video dimensions" : "Aspect ratio"}</span>
            <div className="aspect-tiles">
              {aspects.map((aspect) => {
                const on = settings.aspect_ratio === aspect;
                return (
                  <button
                    key={aspect}
                    type="button"
                    className={`aspect-tile ${on ? "is-selected" : ""}`}
                    aria-pressed={on}
                    onClick={() => onAspectChange(aspect)}
                  >
                    <span className="aspect-tile__box" style={ratioBoxStyle(aspect)} aria-hidden="true" />
                    <span className="aspect-tile__label as-tabular">{aspect}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {isVideo && durations.length ? (
          <div className="run-settings__field">
            <span className="run-settings__label">Duration</span>
            <div className="chip-row">
              {durations.map((value) =>
                chip(
                  `${value}s`,
                  settings.duration === value,
                  () => onSettingsChange({ duration: value }),
                  String(value)
                )
              )}
            </div>
          </div>
        ) : null}

        {isVideo && resolutions.length ? (
          <div className="run-settings__field">
            <span className="run-settings__label">Quality</span>
            <div className="chip-row">
              {resolutions.map((value) =>
                chip(
                  value.toUpperCase(),
                  settings.video_resolution === value,
                  () => onSettingsChange({ video_resolution: value }),
                  value
                )
              )}
            </div>
          </div>
        ) : null}

        {!isVideo && sizes.length ? (
          <div className="run-settings__field">
            <span className="run-settings__label">Resolution</span>
            <div className="chip-row">
              {sizes.map((value) =>
                chip(value, settings.image_size === value, () => onSettingsChange({ image_size: value }), value)
              )}
            </div>
          </div>
        ) : null}

        {counts.length > 1 ? (
          <div className="run-settings__field">
            <span className="run-settings__label">Picks per run</span>
            <div className="chip-row">
              {counts.map((value) =>
                chip(
                  String(value),
                  settings.count === value,
                  () => onSettingsChange({ count: value }),
                  String(value)
                )
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="run-settings__section">
        <Select
          label="Style preset"
          value={selectedPresetKey ?? ""}
          onChange={(event) => onPresetChange(event.target.value || null)}
          options={[{ value: "", label: "No preset" }].concat(
            presets.map((preset) => ({ value: preset.key, label: preset.label }))
          )}
          helpText="Appended to the brief as an editable paragraph."
        />

        {settings.aspect_ratio ? (
          <AspectPreview
            aspect={settings.aspect_ratio}
            size={settings.image_size}
            label={model?.short_label || model?.label}
            count={settings.count}
          />
        ) : null}

        {fieldErrors.references ? (
          <Text variant="bodySm" tone="critical" as="p">
            {fieldErrors.references}
          </Text>
        ) : null}
        {fieldErrors.compare ? (
          <Text variant="bodySm" tone="critical" as="p">
            {fieldErrors.compare}
          </Text>
        ) : null}
      </div>

      <div className="run-settings__foot">
        <Text variant="bodySm" tone="secondary" numeric>
          {isCompare
            ? compareCostLabel ?? "Two runs, one per side"
            : costEstimate ?? [modelCostBadge(model), modelRateLabel(model)].filter(Boolean).join(" · ")}
        </Text>
        <Button variant="plain" icon="arrow-path" onClick={onReset}>
          Reset run settings
        </Button>
      </div>
    </Card>
  );
}
