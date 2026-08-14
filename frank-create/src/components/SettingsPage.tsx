import React, { useEffect, useMemo, useState } from "react";

import { Banner, Card, PageHeader, Select, Text, ThemePicker } from "../ds";
import { Shell } from "../Shell";
import { fetchConfig } from "../lib/api";
import { fallbackConfig } from "../lib/presets";
import { maxCountForModel, modelsForMedia } from "../lib/studio";
import { readRunDefaults, updateRunDefaults } from "../lib/preferences";
import type { StudioModel } from "../lib/types";

/**
 * Workspace settings.
 *
 * Two cards, both of which do something. The design also calls for a Guardrails
 * card — approval-before-export, history retention, a spend cap — and there is
 * no backend for any of it, so it is left out rather than shipped as switches
 * that look live and are not.
 */
export function SettingsPage() {
  const [models, setModels] = useState<StudioModel[]>(fallbackConfig.models);
  const [defaults, setDefaults] = useState(() => readRunDefaults());

  useEffect(() => {
    let live = true;
    fetchConfig()
      .then((config) => {
        if (live && config?.models?.length) setModels(config.models);
      })
      .catch(() => {
        /* the fallback roster is a complete list; a failed fetch is not an error here */
      });
    return () => {
      live = false;
    };
  }, []);

  const imageModels = useMemo(() => modelsForMedia(models, "image"), [models]);
  const model = useMemo(
    () => imageModels.find((m) => m.id === defaults.model_id) ?? imageModels[0],
    [imageModels, defaults.model_id],
  );

  const set = (patch: Parameters<typeof updateRunDefaults>[0]) => setDefaults(updateRunDefaults(patch));

  const countOptions = Array.from({ length: maxCountForModel(model) }, (_, i) => String(i + 1));

  return (
    <Shell screen="settings" maxWidth="var(--content-max-width-one-column)">
      <PageHeader title="Settings" subtitle="Workspace defaults for this tenant." />

      <Card
        title="Theme"
        subtitle="A theme re-points the accent, canvas and navigation tint. Status colours never change."
      >
        <ThemePicker />
      </Card>

      <Card title="Run defaults" subtitle="What the composer starts from. A model that can't honour a default corrects it.">
        <div className="settings-grid">
          <Select
            label="Default model"
            options={imageModels.map((m) => ({ value: m.id, label: m.label }))}
            value={model?.id ?? ""}
            onChange={(e) => set({ model_id: e.target.value })}
          />
          <Select
            label="Default aspect ratio"
            options={model?.allowed_aspect_ratios ?? []}
            value={defaults.aspect_ratio ?? model?.allowed_aspect_ratios?.[0] ?? ""}
            onChange={(e) => set({ aspect_ratio: e.target.value })}
          />
          <Select
            label="Default resolution"
            options={model?.allowed_image_sizes ?? []}
            value={defaults.image_size ?? model?.allowed_image_sizes?.[0] ?? ""}
            onChange={(e) => set({ image_size: e.target.value })}
          />
          <Select
            label="Picks per run"
            options={countOptions}
            value={String(defaults.count ?? 1)}
            onChange={(e) => set({ count: Number(e.target.value) })}
          />
        </div>
        <Text variant="bodySm" tone="secondary" as="p" style={{ marginTop: "var(--space-300)" }}>
          Defaults and theme are stored in this browser. They do not follow you to another device.
        </Text>
      </Card>

      <Banner tone="info" title="Guardrails are not available yet">
        <span>
          Approval before export, run-history retention and a monthly spend cap are designed but have
          nothing behind them. They will appear here once the backend supports them.
        </span>
      </Banner>
    </Shell>
  );
}
