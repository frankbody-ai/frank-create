import { useEffect, useMemo, useRef, useState } from "react";
import { Banner, Button, ButtonGroup, Card, Checkbox, PageHeader, Select, Text } from "../ds";
import { createEnhancement, createReference, uploadReferenceToStorage } from "../lib/api";
import { upscaleModelsForMedia } from "../lib/studio";
import BeforeAfterSlider from "./BeforeAfterSlider";
import type { Asset, EnhanceSettings, StudioModel } from "../lib/types";

type MediaKind = "image" | "video";

interface EnhancerProps {
  models: StudioModel[];
  assets: Asset[];
  sessionId: string | null;
  connection: "online" | "offline" | "checking";
  onAssetsCreated: (assets: Asset[]) => void;
  onStatus: (text: string) => void;
  onExpandAsset?: (asset: Asset) => void;
  onDownloadAsset?: (asset: Asset) => void;
}

const DEFAULTS: Record<MediaKind, EnhanceSettings> = {
  image: {
    enhance_model: "Standard V2",
    upscale_factor: "2x",
    subject_detection: "None",
    output_format: "png",
    face_enhancement: false,
    face_enhancement_strength: 0.8,
    face_enhancement_creativity: 0
  },
  video: { target_resolution: "1080p", target_fps: 60, scale_factor: 2 }
};

function isVideoAsset(asset: Asset) {
  return asset.media_type === "video";
}

export default function Enhancer({
  models,
  assets,
  sessionId,
  connection,
  onAssetsCreated,
  onStatus,
  onExpandAsset,
  onDownloadAsset
}: EnhancerProps) {
  const [media, setMedia] = useState<MediaKind>("image");
  const [modelId, setModelId] = useState<string>("");
  const [settings, setSettings] = useState<EnhanceSettings>(DEFAULTS.image);
  const [sourceId, setSourceId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string>("");
  const [results, setResults] = useState<Asset[]>([]);
  // Enhanced asset id -> the source image it came from, for the compare slider.
  const [sourceByResult, setSourceByResult] = useState<Record<string, string>>({});
  const [compareOff, setCompareOff] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  const roster = useMemo(() => upscaleModelsForMedia(models, media), [models, media]);
  const model = useMemo(() => roster.find((entry) => entry.id === modelId) ?? roster[0] ?? null, [roster, modelId]);

  const sources = useMemo(
    () =>
      assets.filter((asset) =>
        media === "video" ? isVideoAsset(asset) : !isVideoAsset(asset) && Boolean(asset.preview_url || asset.remote_url)
      ),
    [assets, media]
  );
  const source = useMemo(() => sources.find((asset) => asset.id === sourceId) ?? null, [sources, sourceId]);

  useEffect(() => {
    setModelId(roster[0]?.id ?? "");
    setSettings({ ...DEFAULTS[media] });
    setSourceId("");
    setError("");
  }, [media]);

  useEffect(() => {
    if (sourceId && !sources.some((asset) => asset.id === sourceId)) {
      setSourceId("");
    }
  }, [sources, sourceId]);

  const controls = model?.upscale_controls ?? [];
  const canRun = Boolean(model && source && sessionId && connection === "online" && !running);

  function patch(next: Partial<EnhanceSettings>) {
    setSettings((current) => ({ ...current, ...next }));
  }

  async function handleUpload(files: File[]) {
    if (!files.length || !sessionId) {
      return;
    }
    if (connection !== "online") {
      setError("Uploading a source needs a live connection.");
      return;
    }
    onStatus("Uploading source for the enhancer...");
    try {
      const file = files[0];
      const { url, path } = await uploadReferenceToStorage(file, sessionId);
      const created = await createReference({
        session_id: sessionId,
        title: file.name,
        file_path: path,
        preview_url: url,
        media_type: file.type.startsWith("video") ? "video" : "image",
        sync_status: "cloud"
      });
      const asset: Asset = {
        ...created.asset,
        title: created.asset.title || file.name,
        preview_url: created.asset.remote_url || url,
        remote_url: created.asset.remote_url || url,
        file_path: created.asset.file_path || path,
        kind: "reference",
        media_type: file.type.startsWith("video") ? "video" : "image",
        favorite: created.asset.favorite ?? false,
        approval_status: created.asset.approval_status || "review",
        sync_status: "cloud"
      };
      onAssetsCreated([asset]);
      setSourceId(asset.id);
      onStatus(`${file.name} is ready to enhance.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      onStatus("Source upload failed.");
    }
  }

  async function run() {
    if (!model || !source || !sessionId) {
      return;
    }
    setRunning(true);
    setError("");
    onStatus(`Enhancing with ${model.short_label ?? model.label}...`);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await createEnhancement(
        {
          session_id: sessionId,
          model: model.id,
          source_asset_id: source.id,
          settings: { ...settings, media }
        },
        { signal: controller.signal }
      );
      if (response.status === "complete" && response.assets?.length) {
        const sourcePreview = source.preview_url || source.remote_url || "";
        if (sourcePreview) {
          setSourceByResult((current) => {
            const next = { ...current };
            for (const asset of response.assets!) next[asset.id] = sourcePreview;
            return next;
          });
        }
        setResults((current) => [...response.assets!, ...current]);
        onAssetsCreated(response.assets);
        onStatus(`Enhanced ${media} is ready.`);
      } else {
        const message = response.error?.message || "The enhancer returned no output.";
        setError(message);
        onStatus("Enhance failed.");
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Enhance failed.");
        onStatus("Enhance failed.");
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(false);
    onStatus("Enhance stopped.");
  }

  const enumOptions = (values: (string | number)[] | undefined, format?: (v: string) => string) =>
    (values ?? []).map((v) => ({ value: String(v), label: format ? format(String(v)) : String(v) }));

  return (
    <>
      <PageHeader
        title="Upscaler"
        subtitle="Upscale and clean up any still or clip in this session, or upload a fresh file."
        actions={
          <ButtonGroup variant="segmented">
            {(["image", "video"] as MediaKind[]).map((kind) => (
              <Button key={kind} pressed={media === kind} onClick={() => setMedia(kind)}>
                {kind === "image" ? "Image upscaler" : "Video upscaler"}
              </Button>
            ))}
          </ButtonGroup>
        }
      />

      <div className="upscaler-columns">
        <div className="upscaler-main">
          <Card
            title="Source"
            subtitle={`Pick one ${media === "video" ? "clip" : "still"} from this session, or upload a file.`}
            actions={
              <label className="file-button">
                <input
                  type="file"
                  accept={media === "video" ? "video/*" : "image/*"}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void handleUpload(files);
                  }}
                />
                <span className="as-btn as-btn--secondary as-btn--micro">
                  <span className="as-btn__label">Upload a file</span>
                </span>
              </label>
            }
          >
            {sources.length ? (
              <div className="source-grid">
                {sources.map((asset) => {
                  const preview = asset.preview_url || asset.remote_url || "";
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      className={`source-tile ${sourceId === asset.id ? "is-selected" : ""}`}
                      aria-pressed={sourceId === asset.id}
                      onClick={() => setSourceId(asset.id)}
                    >
                      <span className="source-tile__media">
                        {media === "video" ? (
                          <video src={preview} muted playsInline preload="metadata" />
                        ) : (
                          <img src={preview} alt="" loading="lazy" />
                        )}
                      </span>
                      <span className="source-tile__label">{asset.title || asset.kind}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state empty-state--inset">
                <Text as="p" tone="secondary">
                  No {media === "video" ? "clips" : "stills"} in this session yet. Generate one in the
                  studio, or upload a file above.
                </Text>
              </div>
            )}
          </Card>

          <Card
            title="Output"
            subtitle={results.length ? "Drag the handle to compare before and after." : undefined}
          >
            {results.length ? (
              <div className="upscaler-results">
                {results.map((asset) => {
                  const preview = asset.preview_url || asset.remote_url || "";
                  const beforeSrc = sourceByResult[asset.id] || "";
                  const isImage = asset.media_type !== "video";
                  const canCompare = isImage && Boolean(beforeSrc && preview) && !compareOff[asset.id];
                  return (
                    <figure key={asset.id} className="upscaler-result">
                      {asset.media_type === "video" ? (
                        <video src={preview} controls playsInline preload="metadata" />
                      ) : canCompare ? (
                        <BeforeAfterSlider
                          beforeSrc={beforeSrc}
                          afterSrc={preview}
                          alt={asset.title || "Enhanced asset"}
                          onExpand={() => onExpandAsset?.(asset)}
                        />
                      ) : (
                        <img
                          src={preview}
                          alt={asset.title || "Enhanced asset"}
                          onClick={() => onExpandAsset?.(asset)}
                        />
                      )}
                      <figcaption>
                        <Text fontWeight="medium">{asset.title || "Enhanced"}</Text>
                        {asset.width && asset.height ? (
                          <Text variant="bodySm" tone="secondary" numeric>
                            {asset.width} × {asset.height}
                          </Text>
                        ) : null}
                        <span className="upscaler-result__spacer" />
                        {isImage && beforeSrc ? (
                          <Button
                            size="micro"
                            icon="eye"
                            onClick={() =>
                              setCompareOff((current) => ({ ...current, [asset.id]: !current[asset.id] }))
                            }
                          >
                            {compareOff[asset.id] ? "Compare" : "Show enhanced only"}
                          </Button>
                        ) : null}
                        {preview ? (
                          <Button size="micro" icon="arrow-down-tray" onClick={() => onDownloadAsset?.(asset)}>
                            Download file
                          </Button>
                        ) : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state empty-state--inset">
                <Text as="p" tone="secondary">
                  Nothing enhanced in this session yet. Pick a source and run the enhancer.
                </Text>
              </div>
            )}
          </Card>
        </div>

        <aside className="upscaler-rail" aria-label="Enhancer settings">
          <Card title="Enhancer" subtitle={model?.description}>
            <div className="rail-fields">
              <Select
                label="Model"
                value={model?.id ?? ""}
                onChange={(event) => setModelId(event.target.value)}
                options={roster.map((entry) => ({
                  value: entry.id,
                  label: entry.badge ? `${entry.label} · ${entry.badge}` : entry.label,
                }))}
              />

              {controls.includes("enhance_model") ? (
                <Select
                  label="Enhance model"
                  value={settings.enhance_model ?? ""}
                  onChange={(event) => patch({ enhance_model: event.target.value })}
                  options={enumOptions(model?.allowed_enhance_models)}
                />
              ) : null}

              {controls.includes("upscale_factor") ? (
                <Select
                  label="Upscale factor"
                  value={settings.upscale_factor ?? ""}
                  onChange={(event) => patch({ upscale_factor: event.target.value })}
                  options={enumOptions(model?.allowed_upscale_factors)}
                />
              ) : null}

              {controls.includes("subject_detection") ? (
                <Select
                  label="Subject detection"
                  value={settings.subject_detection ?? ""}
                  onChange={(event) => patch({ subject_detection: event.target.value })}
                  options={enumOptions(model?.allowed_subject_detections)}
                />
              ) : null}

              {controls.includes("output_format") ? (
                <Select
                  label="Output format"
                  value={settings.output_format ?? ""}
                  onChange={(event) => patch({ output_format: event.target.value })}
                  options={enumOptions(model?.allowed_output_formats, (v) => v.toUpperCase())}
                />
              ) : null}

              {controls.includes("target_resolution") ? (
                <Select
                  label="Target resolution"
                  value={settings.target_resolution ?? ""}
                  onChange={(event) => patch({ target_resolution: event.target.value })}
                  options={enumOptions(model?.allowed_resolutions, (v) => v.toUpperCase())}
                />
              ) : null}

              {controls.includes("target_fps") ? (
                <Select
                  label="Target frame rate"
                  value={String(settings.target_fps ?? 60)}
                  onChange={(event) => patch({ target_fps: Number(event.target.value) })}
                  options={enumOptions(model?.allowed_target_fps ?? [24, 30, 60], (v) => `${v} fps`)}
                />
              ) : null}

              {controls.includes("face_enhancement") ? (
                <>
                  <Checkbox
                    label="Face enhancement"
                    checked={Boolean(settings.face_enhancement)}
                    onChange={(event) => patch({ face_enhancement: event.target.checked })}
                  />
                  {settings.face_enhancement ? (
                    <div className="rail-sliders">
                      <label className="rail-slider">
                        <span className="rail-slider__head">
                          <span>Strength</span>
                          <span className="as-tabular">
                            {Number(settings.face_enhancement_strength ?? 0.8).toFixed(2)}
                          </span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.face_enhancement_strength ?? 0.8}
                          onChange={(event) =>
                            patch({ face_enhancement_strength: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label className="rail-slider">
                        <span className="rail-slider__head">
                          <span>Creativity</span>
                          <span className="as-tabular">
                            {Number(settings.face_enhancement_creativity ?? 0).toFixed(2)}
                          </span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={settings.face_enhancement_creativity ?? 0}
                          onChange={(event) =>
                            patch({ face_enhancement_creativity: Number(event.target.value) })
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </>
              ) : null}

              {controls.includes("scale_factor") ? (
                <label className="rail-slider">
                  <span className="rail-slider__head">
                    <span>Scale factor</span>
                    <span className="as-tabular">{Number(settings.scale_factor ?? 2).toFixed(1)}x</span>
                  </span>
                  <input
                    type="range"
                    min={model?.scale_factor_min ?? 1}
                    max={model?.scale_factor_max ?? 8}
                    step={0.5}
                    value={settings.scale_factor ?? 2}
                    onChange={(event) => patch({ scale_factor: Number(event.target.value) })}
                  />
                </label>
              ) : null}

              {!controls.length ? (
                <Text variant="bodySm" tone="secondary" as="p">
                  This enhancer runs with no extra settings.
                </Text>
              ) : null}

              {running ? (
                <Button fullWidth tone="critical" icon="no-symbol" onClick={stop}>
                  Stop the run
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon="bolt"
                  fullWidth
                  disabled={!canRun}
                  onClick={() => void run()}
                >
                  Enhance {media}
                </Button>
              )}

              {!source ? (
                <Text variant="bodySm" tone="secondary" as="p">
                  Pick a source {media} to enable the run.
                </Text>
              ) : null}
              {media === "video" ? (
                <Text variant="bodySm" tone="secondary" as="p">
                  Video upscales can take several minutes.
                </Text>
              ) : null}
            </div>
          </Card>

          {error ? (
            <Banner tone="critical" title="The run didn't finish">
              <span>{error}</span>
            </Banner>
          ) : null}
        </aside>
      </div>
    </>
  );
}
