
export interface FrankTask {
  key: string;
  label: string;
  description: string;
  providers: string[];
}

export interface FrankProvider {
  key: string;
  label: string;
  type: "local" | "api";
  status: "ready" | "curated" | "later";
}

export interface ExportPreset {
  key: string;
  label: string;
  size: string;
  format: string;
  media_types?: Array<"image" | "video">;
}

export interface StudioCapabilities {
  generation: boolean;
  edit: boolean;
  masked_edit: boolean;
  video: boolean;
  /** Upscale/enhance-only model — shows up in the Enhancer tab. */
  upscale?: boolean;
}

/** Controls an upscale model exposes, matching its Replicate schema exactly. */
export type UpscaleControl =
  | "enhance_model"
  | "upscale_factor"
  | "subject_detection"
  | "output_format"
  | "face_enhancement"
  | "target_resolution"
  | "target_fps"
  | "scale_factor";

export interface EnhanceSettings {
  enhance_model?: string;
  upscale_factor?: string;
  subject_detection?: string;
  output_format?: string;
  face_enhancement?: boolean;
  face_enhancement_strength?: number;
  face_enhancement_creativity?: number;
  target_resolution?: string;
  target_fps?: number;
  scale_factor?: number;
}


export interface StudioModel {
  id: string;
  label: string;
  short_label?: string;
  provider: string;
  provider_model?: string;
  provider_api_version?: string;
  provider_video_model?: string;
  env_vars?: string[];
  status: "ready" | "disabled" | "experimental";
  /** Superseded model: kept for history labels, hidden from the pickers. */
  legacy?: boolean;

  badge: string;
  max_resolution_label: string;
  description?: string;
  capabilities: StudioCapabilities;
  /** "image" (default) or "video" — drives which rail the model appears in. */
  media?: "image" | "video";
  allowed_aspect_ratios: string[];
  allowed_image_sizes: string[];
  /** Video-only: clip lengths in seconds the provider accepts. */
  allowed_durations?: number[];
  /** Video-only: provider resolution enum, e.g. ["720p", "1080p"]. */
  allowed_resolutions?: string[];
  /** Video-only: model cannot run text-to-video, a source frame is required. */
  requires_source_image?: boolean;
  /** Video-only: provider schema accepts a last/end frame alongside the first frame. */
  supports_last_frame?: boolean;
  /** Upscale-only: which controls this model's Replicate schema exposes. */
  upscale_controls?: UpscaleControl[];
  /** Upscale-only: enums straight from the provider schema. */
  allowed_enhance_models?: string[];
  allowed_upscale_factors?: string[];
  allowed_subject_detections?: string[];
  allowed_output_formats?: string[];
  allowed_target_fps?: number[];
  /** Upscale-only: numeric scale factor bounds (Crystal). */
  scale_factor_min?: number;
  scale_factor_max?: number;

  reference_image_limit: number;
  max_count?: number;
  cost_label: string;
  /** Video-only: provider rate in USD per output second. */
  price_per_second?: number;
  /** Video-only: upper bound when the provider bills a hardware-dependent range. */
  price_max_per_second?: number;
  /** Video-only: per-second USD rate keyed by resolution, e.g. { "480p": 0.08 }. */
  price_per_second_by_resolution?: Record<string, number>;
  /** Video-only: flat USD price per output video. */
  price_flat?: number;
  /** Video-only: exact USD prices keyed as `${duration}@${resolution}`. */
  price_table?: Record<string, number>;
  /** Image-only: relative cost band, 1 ($) to 3 ($$$). */
  cost_tier?: 1 | 2 | 3;
  /** Relative price band, drives the Cheapest / Premium badges. */
  price_tier?: "cheapest" | "standard" | "premium";
  configured?: boolean;
  configured_env_var?: string;
  missing_env_vars?: string[];

  lora_candidate?: boolean;
  /** Provider-side outage flag: model stays selectable but is clearly marked. */
  degraded?: boolean;
  degraded_note?: string;
}

export interface PromptPreset {
  key: string;
  label: string;
  description: string;
  prompt: string;
}


export interface BrandKit {
  style_guidance: string;
  negative_prompt: string;
  reference_notes: string;
  sync_status?: string;
  remote_id?: string | null;
  updated_at?: string;
}


export interface FrankConfig {
  tasks: FrankTask[];
  providers: FrankProvider[];
  exportPresets: ExportPreset[];
  models: StudioModel[];
  backlogModels: StudioModel[];
  promptPresets: PromptPreset[];
  voice: {
    appTitle: string;
    labTitle: string;
    primaryAction: string;
    emptyState: string;
    approved: string;
  };
}














export interface Brief {
  id: string;
  project_id: string;
  title: string;
  product_name?: string;
  task_type: string;
  channel?: string;
  tone?: string;
  prompt?: string;
  negative_prompt?: string;
  reference_image_path?: string;
  status: string;
  sync_status?: string;
  remote_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  brief_id: string;
  workflow_key: string;
  provider: string;
  prompt_id?: string;
  status: string;
  notes?: string;
  sync_status?: string;
  remote_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudioSession {
  id: string;
  project_id?: string | null;
  name: string;
  mode: string;
  status: string;
  summary?: string | null;
  sync_status?: string;
  remote_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudioTurn {
  id: string;
  session_id: string;
  kind: "generate" | "edit" | "masked_edit" | "video";
  provider?: string;
  model: string;
  prompt: string;
  settings_json?: string;
  source_asset_id?: string | null;
  reference_asset_ids_json?: string;
  output_asset_ids_json?: string;
  frank_body_mode: boolean;
  preset_key?: string | null;
  status: "queued" | "running" | "complete" | "blocked" | "failed" | "review";
  error_json?: string | null;
  /** Sanitised JSON body that was posted to the model provider (JSON chip). */
  provider_request_json?: string | null;

  sync_status?: string;
  remote_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  run_id?: string;
  brief_id?: string;
  session_id?: string;
  turn_id?: string;
  kind: string;
  title: string;
  media_type?: "image" | "video";
  provider?: string;
  model?: string;
  prompt?: string;
  settings_json?: string;
  source_asset_id?: string;
  reference_asset_ids_json?: string;
  file_path?: string;
  preview_url?: string;
  remote_url?: string;
  /** True when the file was too large to store, so the URL above is temporary. */
  storage_missing?: boolean;
  temporary_url?: boolean;
  /** Real pixel size of the file the provider returned. */
  width?: number;
  height?: number;
  /** Aspect ratio requested for this asset, e.g. "3:4". */
  aspect_ratio?: string;
  bytes?: number;

  favorite: boolean;
  notes?: string;
  sync_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ExportRecord {
  id: string;
  asset_id: string;
  preset: string;
  file_path: string;
  download_url?: string;
  metadata_json: string;
  sync_status?: string;
  remote_id?: string;
  created_at: string;
}



export interface StudioSettings {
  aspect_ratio: string;
  image_size: string;
  count: number;
  /** Gemini "Nano Banana Pro" thinking budget (tokens). 0 = off, 1000 = low, 5000 = high. */
  thinking_budget?: number;
  /** Video-only: clip length in seconds. */
  duration?: number;
  /** Video-only: provider resolution enum value. */
  video_resolution?: string;
  /** Side-by-side: id shared by the two turns of one comparison run. */
  compare_group?: string;
  /** Side-by-side: which half of the comparison this turn is. */
  compare_side?: "A" | "B";
}


export interface TurnRequest {
  session_id?: string;
  kind: "generate" | "edit" | "masked_edit";
  model: string;
  prompt: string;
  /** Prompt actually sent to the provider: reference manifest + expanded @ref tags. */
  provider_prompt?: string;
  frank_body_mode: boolean;
  preset_key?: string;
  settings: StudioSettings;
  reference_asset_ids: string[];
  reference_image_urls?: string[];
  edit_source_asset_id?: string;
  mask_asset_id?: string;
}

export interface VideoRequest {
  session_id?: string;
  model?: string;
  prompt: string;
  settings: StudioSettings;
  source_asset_id?: string;
  /** Video-only: explicit end frame; only sent for models whose schema accepts it. */
  last_frame_asset_id?: string;
  reference_asset_ids: string[];
  /** Prompt actually sent to the provider: reference manifest + expanded @ref tags. */
  provider_prompt?: string;
}
