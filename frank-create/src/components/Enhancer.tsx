import { useEffect, useMemo, useRef, useState } from "react";
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
  onExpandAsset
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

  return (
    <main className="conversation-column enhancer-view">
      <header className="panel-head">
        <div>
          <h2>Enhancer</h2>
          <p className="panel-sub">Upscale and clean up any still or clip from this session — or upload a fresh file.</p>
        </div>
        <div className="enhancer-media-toggle" role="tablist" aria-label="Enhancer media">
          {(["image", "video"] as MediaKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={media === kind}
              className={`pill-toggle${media === kind ? " is-active" : ""}`}
              onClick={() => setMedia(kind)}
            >
              {kind === "image" ? "Image" : "Video"}
            </button>
          ))}
        </div>
      </header>

      <div className="enhancer-grid">
        <div className="enhancer-block">
          <div className="enhancer-block-head">
            <h3>1 · Source {media}</h3>
            <label className="upload-button enhancer-upload">
              <input
                type="file"
                accept={media === "video" ? "video/*" : "image/*"}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  void handleUpload(files);
                }}
              />
              Upload
            </label>
          </div>
          {sources.length ? (
            <div className="enhancer-source-grid">
              {sources.map((asset) => {
                const preview = asset.preview_url || asset.remote_url || "";
                return (
                  <button
                    key={asset.id}
                    type="button"
                    className={`enhancer-source${sourceId === asset.id ? " is-selected" : ""}`}
                    onClick={() => setSourceId(asset.id)}
                    title={asset.title || asset.id}
                  >
                    {media === "video" ? (
                      <video src={preview} muted playsInline preload="metadata" />
                    ) : (
                      <img src={preview} alt={asset.title || "Source asset"} loading="lazy" />
                    )}
                    <span className="enhancer-source-label">{asset.title || asset.kind}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="empty-note">
              No {media === "video" ? "clips" : "stills"} in this session yet. Generate one in Studio or upload a file.
            </p>
          )}
        </div>

        <div className="enhancer-block">
          <h3>2 · Enhancer model</h3>
          <label className="field">
            <span>Model</span>
            <select value={model?.id ?? ""} onChange={(event) => setModelId(event.target.value)}>
              {roster.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                  {entry.badge ? ` · ${entry.badge}` : ""}
                </option>
              ))}
            </select>
          </label>
          {model?.description ? <p className="field-hint">{model.description}</p> : null}

          {controls.includes("enhance_model") ? (
            <label className="field">
              <span>Enhance model</span>
              <select
                value={settings.enhance_model ?? ""}
                onChange={(event) => patch({ enhance_model: event.target.value })}
              >
                {(model?.allowed_enhance_models ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {controls.includes("upscale_factor") ? (
            <label className="field">
              <span>Upscale factor</span>
              <select
                value={settings.upscale_factor ?? ""}
                onChange={(event) => patch({ upscale_factor: event.target.value })}
              >
                {(model?.allowed_upscale_factors ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {controls.includes("subject_detection") ? (
            <label className="field">
              <span>Subject detection</span>
              <select
                value={settings.subject_detection ?? ""}
                onChange={(event) => patch({ subject_detection: event.target.value })}
              >
                {(model?.allowed_subject_detections ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {controls.includes("output_format") ? (
            <label className="field">
              <span>Output format</span>
              <select
                value={settings.output_format ?? ""}
                onChange={(event) => patch({ output_format: event.target.value })}
              >
                {(model?.allowed_output_formats ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {controls.includes("face_enhancement") ? (
            <>
              <label className="field field-check">
                <input
                  type="checkbox"
                  checked={Boolean(settings.face_enhancement)}
                  onChange={(event) => patch({ face_enhancement: event.target.checked })}
                />
                <span>Face enhancement</span>
              </label>
              {settings.face_enhancement ? (
                <div className="enhancer-slider-row">
                  <label className="field">
                    <span>Strength {Number(settings.face_enhancement_strength ?? 0.8).toFixed(2)}</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={settings.face_enhancement_strength ?? 0.8}
                      onChange={(event) => patch({ face_enhancement_strength: Number(event.target.value) })}
                    />
                  </label>
                  <label className="field">
                    <span>Creativity {Number(settings.face_enhancement_creativity ?? 0).toFixed(2)}</span>
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

          {controls.includes("target_resolution") ? (
            <label className="field">
              <span>Target resolution</span>
              <select
                value={settings.target_resolution ?? ""}
                onChange={(event) => patch({ target_resolution: event.target.value })}
              >
                {(model?.allowed_resolutions ?? []).map((value) => (
                  <option key={value} value={value}>
                    {value.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {controls.includes("target_fps") ? (
            <label className="field">
              <span>Target fps</span>
              <select
                value={String(settings.target_fps ?? 60)}
                onChange={(event) => patch({ target_fps: Number(event.target.value) })}
              >
                {(model?.allowed_target_fps ?? [24, 30, 60]).map((value) => (
                  <option key={value} value={String(value)}>
                    {value} fps
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {controls.includes("scale_factor") ? (
            <label className="field">
              <span>Scale factor {Number(settings.scale_factor ?? 2).toFixed(1)}x</span>
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

          {!controls.length ? <p className="field-hint">This enhancer runs with no extra settings.</p> : null}

          <div className="enhancer-actions">
            <button type="button" className="primary-button" onClick={() => void run()} disabled={!canRun}>
              {running ? "Enhancing..." : `Enhance ${media}`}
            </button>
            {running ? (
              <button type="button" className="ghost-button" onClick={stop}>
                Stop
              </button>
            ) : null}
          </div>
          {!source ? <p className="field-hint">Pick a source {media} to enable the run.</p> : null}
          {media === "video" ? <p className="field-hint">Video upscales can take several minutes.</p> : null}
          {error ? <p className="error-note">{error}</p> : null}
        </div>
      </div>

      <div className="enhancer-block">
        <h3>3 · Enhanced output</h3>
        {results.length ? (
          <div className="enhancer-result-grid">
            {results.map((asset) => {
              const preview = asset.preview_url || asset.remote_url || "";
              const beforeSrc = sourceByResult[asset.id] || "";
              const isImage = asset.media_type !== "video";
              const canCompare = isImage && Boolean(beforeSrc && preview) && !compareOff[asset.id];
              return (
                <figure key={asset.id} className="enhancer-result">
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
                    <span>{asset.title || "Enhanced"}</span>
                    {isImage && beforeSrc ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          setCompareOff((current) => ({ ...current, [asset.id]: !current[asset.id] }))
                        }
                      >
                        {compareOff[asset.id] ? "Compare" : "Enhanced only"}
                      </button>
                    ) : null}
                    {preview ? (
                      <a href={preview} target="_blank" rel="noreferrer" download>
                        Download
                      </a>
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : (
          <p className="empty-note">Nothing enhanced yet in this session.</p>
        )}
      </div>
    </main>
  );
}
