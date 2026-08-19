import { useEffect, useMemo, useRef, useState } from "react";
import { Banner, Button, ButtonGroup, Card, Checkbox, Icon, PageHeader, Select, Text } from "../ds";
import { createEnhancement, createReference, uploadReferenceToStorage } from "../lib/api";
import { thumbnailUrl, upscaleModelsForMedia } from "../lib/studio";
import BeforeAfterSlider from "./BeforeAfterSlider";
import type { Asset, EnhanceSettings, StudioModel } from "../lib/types";

type MediaKind = "image" | "video";

interface EnhancerProps {
  models: StudioModel[];
  sessionId: string | null;
  connection: "online" | "offline" | "checking";
  /** The picked source, owned by App so the shared reference picker can fill it. */
  source: Asset | null;
  /** Opens the same reference picker the studio uses, in single-pick mode. */
  onPickSource: () => void;
  onSourceChange: (asset: Asset | null) => void;
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

export default function Enhancer({
  models,
  sessionId,
  connection,
  source,
  onPickSource,
  onSourceChange,
  onAssetsCreated,
  onStatus,
  onExpandAsset,
  onDownloadAsset
}: EnhancerProps) {
  const [media, setMedia] = useState<MediaKind>("image");
  const [modelId, setModelId] = useState<string>("");
  const [settings, setSettings] = useState<EnhanceSettings>(DEFAULTS.image);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [tick, setTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [results, setResults] = useState<Asset[]>([]);
  // Enhanced asset id -> the source image it came from, for the compare slider.
  const [sourceByResult, setSourceByResult] = useState<Record<string, string>>({});
  const [compareOff, setCompareOff] = useState<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const roster = useMemo(() => upscaleModelsForMedia(models, media), [models, media]);
  const model = useMemo(() => roster.find((entry) => entry.id === modelId) ?? roster[0] ?? null, [roster, modelId]);

  useEffect(() => {
    setModelId(roster[0]?.id ?? "");
    setSettings({ ...DEFAULTS[media] });
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media]);

  // Elapsed counter for the running card.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Paste an image straight into the upscaler.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (event.defaultPrevented) return;
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith(media === "video" ? "video/" : "image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file));
      if (!files.length) return;
      event.preventDefault();
      void handleUpload(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, sessionId, connection]);

  const controls = model?.upscale_controls ?? [];
  const canRun = Boolean(model && source && sessionId && connection === "online" && !running);
  const sourcePreview = source ? source.preview_url || source.remote_url || "" : "";
  const sourceIsVideo = source?.media_type === "video";

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
    setUploading(true);
    onStatus("Uploading source for the upscaler...");
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
      onSourceChange(asset);
      setError("");
      onStatus(`${file.name} is ready to upscale.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      onStatus("Source upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function run() {
    if (!model || !source || !sessionId) {
      return;
    }
    setRunning(true);
    setStartedAt(Date.now());
    setTick(Date.now());
    setError("");
    onStatus(`Upscaling with ${model.short_label ?? model.label}...`);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await createEnhancement(
        {
          session_id: sessionId,
          model: model.id,
          source_asset_id: source.id,
          // Library picks can lack a stored file (provider-URL-only outputs), so
          // always send a usable URL as a fallback for the backend.
          source_url: source.remote_url || source.preview_url || undefined,
          settings: { ...settings, media }
        },
        { signal: controller.signal }
      );
      if (response.status === "complete" && response.assets?.length) {
        const preview = source.preview_url || source.remote_url || "";
        if (preview) {
          setSourceByResult((current) => {
            const next = { ...current };
            for (const asset of response.assets!) next[asset.id] = preview;
            return next;
          });
        }
        setResults((current) => [...response.assets!, ...current]);
        onAssetsCreated(response.assets);
        onStatus(`Upscaled ${media} is ready.`);
      } else {
        const message = response.error?.message || "The upscaler returned no output.";
        setError(message);
        onStatus("Upscale failed.");
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Upscale failed.");
        onStatus("Upscale failed.");
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
    onStatus("Upscale stopped.");
  }

  const enumOptions = (values: (string | number)[] | undefined, format?: (v: string) => string) =>
    (values ?? []).map((v) => ({ value: String(v), label: format ? format(String(v)) : String(v) }));

  const elapsed = Math.max(0, Math.floor((tick - startedAt) / 1000));
  const elapsedLabel = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2, "0")}s`
    : `${elapsed}s`;

  return (
    <>
      <PageHeader
        title="Upscaler"
        subtitle="Drop a still or clip in, pick an upscaler on the right, and run it."
      />

      <div className="upscaler-columns">
        <div className="upscaler-main">
          <div className="upscaler-top">
            <div className="upscaler-drop-col">
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept={media === "video" ? "video/*" : "image/*"}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void handleUpload(files);
                }}
              />

              <button
                type="button"
                className={`upscaler-drop upscaler-drop--empty ${dragging ? "is-dragging" : ""}`}
                onClick={onPickSource}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void handleUpload(Array.from(event.dataTransfer.files || []));
                }}
                disabled={uploading}
              >
                <Icon source="arrow-up-tray" tone="inherit" size={24} />
                <strong>
                  {uploading
                    ? "Uploading…"
                    : `Drop ${media === "video" ? "a clip" : "an image"} here, or click to browse`}
                </strong>
                <span>
                  Pick from this session's generations and uploads, or drop / paste a file straight in.
                </span>
              </button>
            </div>

            <aside className="upscaler-rail" aria-label="Upscaler settings">
              <Card title="Upscaler" subtitle={model?.description}>
                <div className="rail-fields">
                  <ButtonGroup variant="segmented">
                    {(["image", "video"] as MediaKind[]).map((kind) => (
                      <Button key={kind} pressed={media === kind} onClick={() => setMedia(kind)}>
                        {kind === "image" ? "Image" : "Video"}
                      </Button>
                    ))}
                  </ButtonGroup>

                  <Select
                    label="Model"
                    value={model?.id ?? ""}
                    onChange={(event) => setModelId(event.target.value)}
                    options={roster.map((entry) => ({
                      value: entry.id,
                      label: entry.badge ? `${entry.label} · ${entry.badge}` : entry.label
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

                  {controls.includes("scale_factor") ? (
                    <Select
                      label="Scale factor"
                      value={String(settings.scale_factor ?? 2)}
                      onChange={(event) => patch({ scale_factor: Number(event.target.value) })}
                      options={enumOptions([2, 3, 4], (v) => `${v}×`)}
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
                              onChange={(event) => patch({ face_enhancement_strength: Number(event.target.value) })}
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
                              onChange={(event) => patch({ face_enhancement_creativity: Number(event.target.value) })}
                            />
                          </label>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  <div className="upscaler-run-actions">
                    {running ? (
                      <Button variant="secondary" icon="x-mark" onClick={stop}>
                        Stop
                      </Button>
                    ) : (
                      <Button variant="primary" icon="sparkles" disabled={!canRun} onClick={() => void run()}>
                        Upscale {media}
                      </Button>
                    )}
                    <Button size="micro" onClick={() => fileInputRef.current?.click()}>
                      Upload a file
                    </Button>
                  </div>

                  {source ? (
                    <div className="upscaler-source-chip">
                      <div className="upscaler-source-chip__thumb">
                        {sourceIsVideo ? (
                          <video src={sourcePreview} muted playsInline preload="metadata" />
                        ) : (
                          <img
                            src={thumbnailUrl(sourcePreview, 96, 60, "webp") || sourcePreview}
                            alt={source.title || "Source"}
                            decoding="async"
                          />
                        )}
                      </div>
                      <div className="upscaler-source-chip__meta">
                        <Text fontWeight="medium">{source.title || "Source"}</Text>
                        <Text variant="bodySm" tone="secondary">
                          {source.width && source.height ? `${source.width} × ${source.height}` : "Ready to upscale"}
                        </Text>
                      </div>
                      <button
                        type="button"
                        className="upscaler-source-chip__clear"
                        onClick={() => onSourceChange(null)}
                        aria-label="Remove source"
                      >
                        <Icon source="x-mark" size={16} />
                      </button>
                    </div>
                  ) : (
                    <Text variant="bodySm" tone="secondary" as="p">
                      Add a source {media} to enable the run.
                    </Text>
                  )}
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

          <section className="thread-surface" aria-label="Upscaled output">
            <div className="rounds-well-head" aria-hidden="true">
              <span className="rounds-well-title">Upscales — newest first</span>
              <span className="rounds-well-count">
                {results.length
                  ? `${results.length} result${results.length === 1 ? "" : "s"}`
                  : "No upscales yet"}
              </span>
            </div>

            {running ? (
              <article className="turn-card turn-card-pending" aria-live="polite" aria-busy="true">
                <div className="turn-card-body">
                  <div className="turn-side">
                    <div className="turn-copy">
                      <span className="status-dot pending" />
                      <div>
                        <p className="eyebrow">Upscaling</p>
                        <h3>{model?.short_label ?? model?.label ?? "Upscaler"}</h3>
                        <div className="turn-meta">
                          <span>Running</span>
                          <span>{elapsedLabel} elapsed</span>
                        </div>
                        <Button size="micro" onClick={stop}>
                          Stop
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="turn-visual">
                    <div className="upscaler-stage">
                      <div className="output-skeleton upscaler-stage__skeleton">
                        <span className="output-skeleton-shimmer" aria-hidden="true" />
                        <span className="output-skeleton-spinner" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ) : null}

            {results.length ? (
              results.map((asset) => {
                const preview = asset.preview_url || asset.remote_url || "";
                const beforeSrc = sourceByResult[asset.id] || "";
                const isImage = asset.media_type !== "video";
                const canCompare = isImage && Boolean(beforeSrc && preview) && !compareOff[asset.id];
                return (
                  <article key={asset.id} className="turn-card">
                    <div className="turn-card-body">
                      <div className="turn-side">
                        <div className="turn-copy">
                          <div>
                            <p className="eyebrow">Upscaled</p>
                            <h3>{asset.title || "Enhanced"}</h3>
                            <div className="turn-meta">
                              {asset.width && asset.height ? (
                                <span>{asset.width} × {asset.height}</span>
                              ) : null}
                              <span>{isImage ? "Image" : "Video"}</span>
                            </div>
                            <div className="upscaler-result__actions">
                              {isImage && beforeSrc ? (
                                <Button
                                  size="micro"
                                  icon="eye"
                                  onClick={() =>
                                    setCompareOff((current) => ({ ...current, [asset.id]: !current[asset.id] }))
                                  }
                                >
                                  {compareOff[asset.id] ? "Compare" : "Enhanced only"}
                                </Button>
                              ) : null}
                              {preview ? (
                                <Button size="micro" icon="arrow-down-tray" onClick={() => onDownloadAsset?.(asset)}>
                                  Download
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="turn-visual">
                        <div className="upscaler-stage">
                          {!isImage ? (
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
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : !running ? (
              <div className="empty-state empty-state--inset">
                <Text as="p" tone="secondary">
                  Nothing upscaled yet. Add a source above and run the upscaler.
                </Text>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
