// Frank Create unified backend — Supabase Edge Function.
// Serves every /api/frank/* call the SPA makes from a single endpoint.
// Mirrors the dev-time Vite plugin at frank-create/server/frankApi.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildManifest, manifestToCsv, validateManifest } from "./handoff.ts";
import { loadPromptAgentConfig, buildPromptAgentSystem, DEFAULT_CONFIG } from "./promptAgent.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";
const BUCKET = "studio-images";
const ALLOWED_EMAIL_DOMAINS = ["frankbody.com", "autosolutions.ai"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

const supabase = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

class AuthError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

const USER_CACHE = new Map<string, { id: string; email: string; exp: number }>();

async function requireUser(req: Request): Promise<string> {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m ? m[1] : null;
  if (!token) throw new AuthError(401, "Missing bearer token");
  const cached = USER_CACHE.get(token);
  const now = Date.now();
  if (cached && cached.exp > now) return cached.id;

  const sb = supabase();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new AuthError(401, "Invalid session");
  const email = (data.user.email || "").toLowerCase();
  const ok = ALLOWED_EMAIL_DOMAINS.some((d) => email.endsWith(`@${d}`));
  if (!ok) throw new AuthError(403, `Email ${email} is not in the allow-list`);
  USER_CACHE.set(token, { id: data.user.id, email, exp: now + 60_000 });
  return data.user.id;
}

async function signed(path: string): Promise<string> {
  const { data } = await supabase().storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? "";
}

const DEFAULT_MODEL = {
  id: "nano-banana-pro",
  label: "Lovable AI · Nano Banana",
  short_label: "Nano Banana",
  provider: "lovable",
  provider_model: "google/gemini-2.5-flash-image",
  status: "ready" as const,
  badge: "Ready",
  max_resolution_label: "1024×1024",
  description: "Lovable AI image generation (Gemini 2.5 Flash Image).",
  capabilities: { generation: true, edit: true, masked_edit: false, video: false },
  allowed_aspect_ratios: ["1:1", "3:4", "4:3", "16:9", "9:16"],
  allowed_image_sizes: ["512x512", "1024x1024", "1024x1536", "1536x1024"],
  reference_image_limit: 3,
  cost_label: "Lovable credits",
  configured: true,
  configured_env_var: "LOVABLE_API_KEY",
  missing_env_vars: [],
};

const DEFAULT_CONFIG = {
  tasks: [
    { key: "generate", label: "Generate", description: "Create a new image from a prompt.", providers: ["lovable"] },
    { key: "edit", label: "Edit", description: "Edit an existing image.", providers: ["lovable"] },
  ],
  providers: [{ key: "lovable", label: "Lovable AI", type: "api", status: "ready" }],
  exportPresets: [
    { key: "original", label: "Original", size: "source", format: "png", media_types: ["image"] },
    { key: "square_1080", label: "Square 1080", size: "1080x1080", format: "jpg", media_types: ["image"] },
  ],
  models: [DEFAULT_MODEL],
  backlogModels: [],
  promptPresets: [
    {
      key: "product-shot-lab",
      label: "🧪 Product Shot Lab",
      description: "Clean product image for PDP, retouching, and channel crops.",
      prompt:
        "Frank Body [PRODUCT NAME] product-first composition. Clean label facing camera, honest skin-care texture, Frank pink accent, channel-ready negative space. Studio photography, soft realistic shadow, high-conversion PDP finish. 4K, photorealistic.",
    },
    {
      key: "clean-ecom",
      label: "🛒 Clean Ecom",
      description: "Crisp commerce frame with readable packaging.",
      prompt:
        "Frank Body [PRODUCT NAME] product hero image for e-commerce PDP. High-gloss plastic packaging, centred in frame, clean white or soft off-white background, soft box lighting, no harsh shadows, full product visible, label legible. Studio photography style. 4K, photorealistic. Professional beauty brand e-commerce standard. No props, no model, no hands.",
    },
    {
      key: "fb-lifestyle",
      label: "📸 FB Lifestyle",
      description: "Warm editorial lifestyle moment.",
      prompt:
        "Frank Body [PRODUCT NAME] warm editorial lifestyle image. Human skin or product-only flat lay — specify which. Warm natural light, bathroom or bedroom setting or marble surface. Product as supporting element or hero. Dried botanicals, minimal props. Vogue Beauty editorial feel, warm cream and terracotta tones. 4K, photorealistic.",
    },
    {
      key: "fb-model-image",
      label: "👤 FB Model Image",
      description: "Campaign hero with a real body-care model moment.",
      prompt:
        "Frank Body campaign hero. Young woman, radiant glowing skin, applying or holding [PRODUCT NAME], warm natural light, beauty editorial mood. Authentic skin texture — not AI-smooth. Inclusive casting, confident body-care moment, warm direct flash, tactile product use, no plastic retouching. 4K, photorealistic.",
    },
    {
      key: "campaign-variants",
      label: "🎯 Campaign Variants",
      description: "Creative rounds from one approved product direction.",
      prompt:
        "Frank Body [PRODUCT NAME] campaign variant. Keep product recognizable and label clean, push set styling, leave channel-ready headline space in the composition. Sharpen the Frank Body attitude — cheeky, warm, director-ready. Editorial realism, warm flash, tactile surfaces. 4K, photorealistic.",
    },
    {
      key: "product-texture",
      label: "🧴 Product Texture",
      description: "Macro scrub, cream, and tactile swipes.",
      prompt:
        "Extreme close-up macro photography of [INGREDIENT/TEXTURE] — e.g. coffee grounds, shea butter, vitamin C crystals, creamy body-care texture, tactile swipes. Warm studio light, soft shadows, high detail, editorial beauty feel. Delicious but skin-care appropriate. 4K, photorealistic.",
    },
    {
      key: "retail-mock",
      label: "🏪 Retail Mock",
      description: "Packaging, shelf, display, and type exploration.",
      prompt:
        "Realistic retail shelf or branded display mock for Frank Body [PRODUCT NAME]. Pharmacy or beauty retailer environment — e.g. Chemist Warehouse, MECCA, Target. Correct shelf height, accurate product facings, packaging readable, brand block clear, campaign headline space, sharp typography.",
    },
  ],
  localEngine: {
    active_engine: "lovable",
    diffusion_ready: true,
    checkpoint_count: 0,
    checkpoints: [],
    note: "Running on Lovable AI Gateway — no local checkpoints required.",
  },
  voice: {
    appTitle: "Frank Create",
    labTitle: "Studio",
    primaryAction: "Generate",
    emptyState: "Describe an image to get started.",
    approved: "Approved",
  },
  advancedGraphUrl: "",
};

function rowToAsset(row: any, signedUrl = ""): any {
  const meta = row.metadata_json || {};
  return {
    id: row.id,
    session_id: row.session_id,
    turn_id: row.message_id ?? undefined,
    kind: row.asset_type || "output",
    title: meta.title || "Generated image",
    media_type: meta.media_type || "image",
    provider: "lovable",
    model: row.model_key || undefined,
    prompt: row.prompt_snapshot || undefined,
    file_path: row.storage_path,
    preview_url: signedUrl,
    remote_url: signedUrl,
    width: meta.width,
    height: meta.height,
    favorite: !!meta.favorite,
    approval_status: meta.approval_status || "review",
    notes: meta.notes,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}

function rowToTurn(row: any): any {
  const settings = row.settings_snapshot_json || {};
  const errorMsg = settings.error;
  return {
    id: row.id,
    session_id: row.session_id,
    kind: settings.kind || "generate",
    provider: "lovable",
    model: settings.model || "nano-banana-pro",
    prompt: row.prompt_text || "",
    settings_json: JSON.stringify(settings.settings || {}),
    frank_body_mode: !!settings.frank_body_mode,
    preset_key: settings.preset_key ?? null,
    status: settings.status || "complete",
    output_asset_ids_json: JSON.stringify(settings.output_asset_ids || []),
    reference_asset_ids_json: JSON.stringify(settings.reference_asset_ids || []),
    error_json: errorMsg
      ? JSON.stringify({ code: settings.error_code || "provider_error", message: String(errorMsg) })
      : null,
    partial_errors_json: Array.isArray(settings.partial_errors) && settings.partial_errors.length
      ? JSON.stringify(settings.partial_errors)
      : null,
    requested_count: typeof settings.requested_count === "number" ? settings.requested_count : null,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
}

function rowToSession(row: any): any {
  return {
    id: row.id,
    project_id: null,
    name: row.title,
    mode: "studio",
    status: "active",
    summary: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function lovableChat(messages: any[], model = "google/gemini-3-flash-preview") {
  const body: Record<string, unknown> = { model, messages };
  if (model.startsWith("openai/gpt-5.6")) body.reasoning_effort = "none";
  const r = await fetch(`${LOVABLE_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Lovable chat ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  return j.choices?.[0]?.message?.content || "";
}


const MODEL_MAP: Record<string, string> = {
  // Kept only for the local placeholder.
};

// OpenRouter is the primary provider for every image and video model in the
// roster, through its dedicated /v1/images and /v1/videos endpoints. Only the
// upscaler path stays on Replicate.
const OPENROUTER_IMAGE_MAP: Record<string, string> = {
  "google-nb-pro": "google/gemini-3-pro-image",
  "nano-banana-pro": "google/gemini-3-pro-image",
  "google-nb-2": "google/gemini-3.1-flash-image",
  "nano-banana-2": "google/gemini-3.1-flash-image",
  "openai-gpt-image-2": "openai/gpt-image-2",
  "seedream-4-5": "bytedance-seed/seedream-4.5",
  "flux-2-pro": "black-forest-labs/flux.2-pro",
  "flux-2-max": "black-forest-labs/flux.2-max",
  "riverflow-2-5-pro": "sourceful/riverflow-v2.5-pro",
  "qwen-image-3-pro": "qwen/qwen-image-3-pro",
  "krea-2-large": "krea/krea-2-large",
  "mai-image-2-5-pro": "microsoft/mai-image-2.5-pro",
  "grok-imagine-image": "x-ai/grok-imagine-image-quality",
};

// Models that accept n > 1 natively; everything else is fanned out as parallel
// single-image calls.
const OPENROUTER_NATIVE_N = new Set<string>([
  "openai/gpt-image-2",
  "bytedance-seed/seedream-4.5",
  "qwen/qwen-image-3-pro",
]);

const REPLICATE_MAP: Record<string, string> = {
  // Image models all run on OpenRouter now; kept empty so the fallback branch
  // stays wired for any future Replicate-only image model.
};



// Video models on OpenRouter, with the capability envelope each one actually
// accepts (verified against GET /api/v1/videos/models).
type VideoCaps = {
  model: string;
  resolutions: string[];
  defaultResolution: string;
  aspects: string[];
  defaultAspect: string;
  minDuration: number;
  maxDuration: number;
  defaultDuration: number;
};

const OPENROUTER_VIDEO_MAP: Record<string, VideoCaps> = {
  "grok-imagine-video": {
    model: "x-ai/grok-imagine-video",
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    defaultAspect: "16:9",
    minDuration: 1, maxDuration: 15, defaultDuration: 5,
  },
  "grok-imagine-video-1-5": {
    model: "x-ai/grok-imagine-video-1.5",
    resolutions: ["480p", "720p", "1080p"],
    defaultResolution: "720p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"],
    defaultAspect: "16:9",
    minDuration: 1, maxDuration: 15, defaultDuration: 5,
  },
  "dreamina-seedance-2": {
    model: "bytedance/seedance-2.0",
    resolutions: ["480p", "720p", "1080p", "4K"],
    defaultResolution: "1080p",
    aspects: ["1:1", "3:4", "9:16", "4:3", "16:9", "21:9", "9:21"],
    defaultAspect: "16:9",
    minDuration: 3, maxDuration: 15, defaultDuration: 5,
  },
  "happyhorse-1-0": {
    model: "alibaba/happyhorse-1.0",
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"],
    defaultAspect: "16:9",
    minDuration: 3, maxDuration: 15, defaultDuration: 5,
  },
  "wan-2-7-i2v": {
    model: "alibaba/wan-2.7",
    resolutions: ["720p", "1080p"],
    defaultResolution: "1080p",
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"],
    defaultAspect: "16:9",
    minDuration: 2, maxDuration: 15, defaultDuration: 5,
  },
  "hailuo-2-3": {
    model: "minimax/hailuo-2.3",
    resolutions: ["1080p"],
    defaultResolution: "1080p",
    aspects: ["16:9"],
    defaultAspect: "16:9",
    minDuration: 6, maxDuration: 10, defaultDuration: 6,
  },
};

function pick<T>(value: T | undefined, allowed: T[], fallback: T): T {
  return value !== undefined && allowed.includes(value) ? value : fallback;
}

// Normalise the client's settings onto what the chosen model accepts.
function clampVideoSettings(
  caps: VideoCaps,
  opts: { aspect_ratio?: string; duration?: number; resolution?: string },
): { aspectRatio: string; resolution: string; duration: number } {
  const requestedRes = String(opts.resolution ?? "").toLowerCase() === "4k"
    ? "4K"
    : String(opts.resolution ?? "");
  const duration = Number(opts.duration);
  return {
    aspectRatio: pick(opts.aspect_ratio, caps.aspects, caps.defaultAspect),
    resolution: pick(requestedRes, caps.resolutions, caps.defaultResolution),
    duration: Number.isFinite(duration) && duration >= caps.minDuration && duration <= caps.maxDuration
      ? Math.round(duration)
      : caps.defaultDuration,
  };
}



async function handleVideo(body: any, userId: string) {
  const sb = supabase();
  let sessionId: string = body.session_id;
  if (!sessionId) sessionId = (await getOrCreateDefaultSession(userId)).id;

  const prompt: string = body.prompt || "";
  if (!prompt.trim()) throw new Error("Prompt is required");

  const modelId: string = body.model || "grok-imagine-video";
  const caps = OPENROUTER_VIDEO_MAP[modelId];
  if (!caps) {
    return {
      turn: null, status: "failed" as const,
      error: { code: "model_unavailable", message: `${modelId} is not a supported video model.` },
    };
  }
  const slug = caps.model;
  if (!Deno.env.get("OPENROUTER_API_KEY")) {
    return {
      turn: null, status: "blocked" as const,
      error: { code: "missing_key", env_vars: ["OPENROUTER_API_KEY"], message: "OpenRouter is not connected yet." },
    };
  }


  const reqSettings: any = body.settings || {};
  const turnId = crypto.randomUUID();
  const settingsSnapshot: any = {
    kind: "video",
    model: modelId,
    settings: reqSettings,
    preset_key: body.preset_key ?? null,
    reference_asset_ids: body.reference_asset_ids || [],
    status: "running",
  };
  const msgIns = await sb.from("messages").insert({
    id: turnId,
    user_id: userId,
    session_id: sessionId,
    role: "user",
    message_type: "video",
    prompt_text: prompt,
    settings_snapshot_json: settingsSnapshot,
  }).select("seq").single();
  if (msgIns.error) throw msgIns.error;
  const nextSeq = (msgIns.data as any)?.seq ?? 0;

  // Frames are explicit: source_asset_id is the first frame, last_frame_asset_id
  // the optional end frame (only honoured by schemas that accept one).
  const firstFrameId: string | undefined = body.source_asset_id || undefined;
  const lastFrameId: string | undefined = body.last_frame_asset_id || undefined;
  const sourceIds: string[] = [
    ...(firstFrameId ? [firstFrameId] : []),
    ...(lastFrameId ? [lastFrameId] : []),
    ...((body.reference_asset_ids as string[]) || []),
  ];
  const sourceUrls = await loadReferenceDataUrls(sourceIds, userId);
  const firstFrameUrl = firstFrameId ? sourceUrls[0] : undefined;
  const lastFrameUrl = firstFrameId && lastFrameId ? sourceUrls[1] : undefined;

  const failTurn = (code: string, message: string) => {
    const snapshot = { ...settingsSnapshot, status: "failed", error: message, error_code: code };
    return sb.from("messages").update({ settings_snapshot_json: snapshot }).eq("id", turnId).then(() => ({
      turn: rowToTurn({
        id: turnId, session_id: sessionId, role: "user", message_type: "video",
        prompt_text: prompt, settings_snapshot_json: snapshot, seq: nextSeq, created_at: nowIso(),
      }),
      status: "failed" as const,
      error: { code, message },
    }));
  };

  let videoUrl: string | undefined;
  try {
    const videoProviderPrompt = typeof body.provider_prompt === "string" && body.provider_prompt.trim()
      ? body.provider_prompt.trim()
      : prompt;
    const clamped = clampVideoSettings(caps, {
      aspect_ratio: reqSettings.aspect_ratio,
      duration: Number(reqSettings.duration ?? 5),
      resolution: reqSettings.video_resolution || reqSettings.image_size,
    });
    videoUrl = await openrouterVideo(videoProviderPrompt, {
      model: slug,
      aspectRatio: clamped.aspectRatio,
      resolution: clamped.resolution,
      duration: clamped.duration,
      firstFrameUrl,
      lastFrameUrl,
      referenceUrls: firstFrameUrl ? [] : sourceUrls,
    });
  } catch (err) {
    const mapped = mapReplicateError(err);
    return await failTurn(mapped.code, mapped.message);
  }

  if (!videoUrl) return await failTurn("empty_output", "The video model returned no clip.");

  const res = await fetch(videoUrl);
  if (!res.ok) return await failTurn("download_failed", `Could not download the clip (${res.status}).`);
  const mime = (res.headers.get("content-type") || "video/mp4").split(";")[0];
  const bytes = new Uint8Array(await res.arrayBuffer());
  const assetId = crypto.randomUUID();
  const storagePath = `${sessionId}/${assetId}.mp4`;
  const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (up.error) return await failTurn("storage_failed", up.error.message);

  const assetIns = await sb.from("assets").insert({
    id: assetId,
    user_id: userId,
    session_id: sessionId,
    message_id: turnId,
    storage_path: storagePath,
    asset_type: "generated",
    prompt_snapshot: prompt,
    model_key: modelId,
    metadata_json: {
      media_type: "video",
      mime,
      title: prompt.slice(0, 80) || "Generated clip",
      aspect_ratio: reqSettings.aspect_ratio,
      duration: reqSettings.duration ?? null,
      resolution: reqSettings.video_resolution ?? null,
    },
  }).select().single();
  if (assetIns.error) return await failTurn("db_failed", assetIns.error.message);

  const completedSnapshot = {
    ...settingsSnapshot,
    status: "complete",
    output_asset_ids: [assetId],
    requested_count: 1,
  };
  await sb.from("messages").update({ settings_snapshot_json: completedSnapshot }).eq("id", turnId);

  return {
    turn: rowToTurn({
      id: turnId, session_id: sessionId, role: "user", message_type: "video",
      prompt_text: prompt, settings_snapshot_json: completedSnapshot, seq: nextSeq, created_at: nowIso(),
    }),
    status: "complete" as const,
    assets: [rowToAsset(assetIns.data, await signed(storagePath))],
    providerPayload: { provider: "replicate", model: slug },
  };
}

// ---- Enhancer (upscale) ----------------------------------------------------

const UPSCALE_REPLICATE_MAP: Record<string, string> = {
  "recraft-crisp-upscale": "recraft-ai/recraft-crisp-upscale",
  "topaz-image-upscale": "topazlabs/image-upscale",
  "topaz-video-upscale": "topazlabs/video-upscale",
  "crystal-video-upscaler": "philz1337x/crystal-video-upscaler",
};

const UPSCALE_MEDIA: Record<string, "image" | "video"> = {
  "recraft-ai/recraft-crisp-upscale": "image",
  "topazlabs/image-upscale": "image",
  "topazlabs/video-upscale": "video",
  "philz1337x/crystal-video-upscaler": "video",
};

// Only fields each model's Replicate schema actually accepts.
function buildUpscaleInput(slug: string, sourceUrl: string, s: any = {}): Record<string, unknown> {
  if (slug === "recraft-ai/recraft-crisp-upscale") {
    return { image: sourceUrl };
  }
  if (slug === "topazlabs/image-upscale") {
    const input: Record<string, unknown> = {
      image: sourceUrl,
      enhance_model: pick(s.enhance_model, ["Standard V2", "Low Resolution V2", "CGI", "High Fidelity V2", "Text Refine"], "Standard V2"),
      upscale_factor: pick(s.upscale_factor, ["None", "2x", "4x", "6x"], "2x"),
      subject_detection: pick(s.subject_detection, ["None", "All", "Foreground", "Background"], "None"),
      output_format: pick(s.output_format, ["jpg", "png"], "png"),
      face_enhancement: !!s.face_enhancement,
    };
    if (s.face_enhancement) {
      const strength = Number(s.face_enhancement_strength);
      const creativity = Number(s.face_enhancement_creativity);
      input.face_enhancement_strength = Number.isFinite(strength) ? Math.min(1, Math.max(0, strength)) : 0.8;
      input.face_enhancement_creativity = Number.isFinite(creativity) ? Math.min(1, Math.max(0, creativity)) : 0;
    }
    return input;
  }
  if (slug === "topazlabs/video-upscale") {
    const fps = Number(s.target_fps);
    return {
      video: sourceUrl,
      target_resolution: pick(String(s.target_resolution || ""), ["720p", "1080p", "4k"], "1080p"),
      target_fps: Number.isFinite(fps) ? Math.min(120, Math.max(15, Math.round(fps))) : 60,
    };
  }
  if (slug === "philz1337x/crystal-video-upscaler") {
    const scale = Number(s.scale_factor);
    return {
      video: sourceUrl,
      scale_factor: Number.isFinite(scale) && scale >= 1 ? Math.min(8, scale) : 2,
    };
  }
  return { image: sourceUrl };
}

async function handleEnhance(body: any, userId: string) {
  const sb = supabase();
  let sessionId: string = body.session_id;
  if (!sessionId) sessionId = (await getOrCreateDefaultSession(userId)).id;

  const modelId: string = body.model || "";
  const slug = UPSCALE_REPLICATE_MAP[modelId];
  if (!slug) {
    return {
      turn: null, status: "failed" as const,
      error: { code: "model_unavailable", message: `${modelId || "This model"} is not a supported enhancer.` },
    };
  }
  const key = getReplicateGatewayKey();
  if (!key) {
    return {
      turn: null, status: "blocked" as const,
      error: { code: "missing_key", env_vars: ["REPLICATE_API_KEY"], message: "Replicate is not connected yet." },
    };
  }

  const media = UPSCALE_MEDIA[slug];
  const reqSettings: any = body.settings || {};
  const sourceAssetId: string | undefined = body.source_asset_id || undefined;
  let sourceUrl: string = typeof body.source_url === "string" ? body.source_url.trim() : "";
  let sourceTitle = "";
  if (sourceAssetId) {
    const { data: row } = await sb.from("assets").select("id,storage_path,metadata_json")
      .eq("user_id", userId).eq("id", sourceAssetId).maybeSingle();
    if (!row) {
      return {
        turn: null, status: "failed" as const,
        error: { code: "not_found", message: "The selected source asset is missing." },
      };
    }
    sourceUrl = await signed((row as any).storage_path);
    sourceTitle = ((row as any).metadata_json?.title as string) || "";
  }
  if (!sourceUrl) {
    return {
      turn: null, status: "failed" as const,
      error: { code: "missing_source", message: `Pick a source ${media} to enhance.` },
    };
  }

  const turnId = crypto.randomUUID();
  const promptText = `Enhance · ${sourceTitle || media} · ${modelId}`;
  const settingsSnapshot: any = {
    kind: "enhance",
    model: modelId,
    settings: { ...reqSettings, media, source_asset_id: sourceAssetId ?? null },
    preset_key: null,
    reference_asset_ids: sourceAssetId ? [sourceAssetId] : [],
    status: "running",
  };
  const msgIns = await sb.from("messages").insert({
    id: turnId,
    user_id: userId,
    session_id: sessionId,
    role: "user",
    message_type: "edit",
    prompt_text: promptText,
    settings_snapshot_json: settingsSnapshot,
  }).select("seq").single();
  if (msgIns.error) throw msgIns.error;
  const nextSeq = (msgIns.data as any)?.seq ?? 0;

  const failTurn = (code: string, message: string) => {
    const snapshot = { ...settingsSnapshot, status: "failed", error: message, error_code: code };
    return sb.from("messages").update({ settings_snapshot_json: snapshot }).eq("id", turnId).then(() => ({
      turn: rowToTurn({
        id: turnId, session_id: sessionId, role: "user", message_type: "edit",
        prompt_text: promptText, settings_snapshot_json: snapshot, seq: nextSeq, created_at: nowIso(),
      }),
      status: "failed" as const,
      error: { code, message },
    }));
  };

  let outputUrl: string | undefined;
  try {
    const input = buildUpscaleInput(slug, sourceUrl, reqSettings);
    // Topaz 4K video runs for several minutes; images are quick.
    const maxMs = media === "video" ? 540_000 : 180_000;
    outputUrl = await runReplicatePrediction(slug, input, key, maxMs);
  } catch (err) {
    const mapped = mapReplicateError(err);
    return await failTurn(mapped.code, mapped.message);
  }
  if (!outputUrl) return await failTurn("empty_output", "The enhancer returned no output.");

  const res = await fetch(outputUrl);
  if (!res.ok) return await failTurn("download_failed", `Could not download the enhanced ${media} (${res.status}).`);
  const mime = (res.headers.get("content-type") || (media === "video" ? "video/mp4" : "image/png")).split(";")[0];
  const bytes = new Uint8Array(await res.arrayBuffer());
  const assetId = crypto.randomUUID();
  const ext = media === "video" ? "mp4" : (mime.split("/")[1] || "png");
  const storagePath = `${sessionId}/${assetId}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (up.error) return await failTurn("storage_failed", up.error.message);

  const assetIns = await sb.from("assets").insert({
    id: assetId,
    user_id: userId,
    session_id: sessionId,
    message_id: turnId,
    storage_path: storagePath,
    asset_type: "edited",
    prompt_snapshot: promptText,
    model_key: modelId,
    metadata_json: {
      media_type: media,
      mime,
      title: `Enhanced · ${sourceTitle || media}`,
      enhanced: true,
      source_asset_id: sourceAssetId ?? null,
      enhance_settings: reqSettings,
    },
  }).select().single();
  if (assetIns.error) return await failTurn("db_failed", assetIns.error.message);

  const completedSnapshot = { ...settingsSnapshot, status: "complete", output_asset_ids: [assetId], requested_count: 1 };
  await sb.from("messages").update({ settings_snapshot_json: completedSnapshot }).eq("id", turnId);

  return {
    turn: rowToTurn({
      id: turnId, session_id: sessionId, role: "user", message_type: "edit",
      prompt_text: promptText, settings_snapshot_json: completedSnapshot, seq: nextSeq, created_at: nowIso(),
    }),
    status: "complete" as const,
    assets: [rowToAsset(assetIns.data, await signed(storagePath))],
    providerPayload: { provider: "replicate", model: slug },
  };
}

const OPENAI_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536", "auto"]);

function openaiSizeFromAspect(ar?: string): string {
  switch (ar) {
    case "3:2":
    case "16:9":
    case "4:3": return "1536x1024";
    case "2:3":
    case "9:16":
    case "3:4": return "1024x1536";
    default: return "1024x1024";
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const anyErr = err as any;
    return anyErr.message || anyErr.error_description || anyErr.details || JSON.stringify(err);
  }
  return String(err);
}

async function lovableImage(
  prompt: string,
  referenceImageDataUrls: string[] = [],
  opts: { gatewayModel?: string; aspectRatio?: string; size?: string; thinkingBudget?: number } = {},
): Promise<{ b64?: string; url?: string; mime: string }> {
  const gatewayModel = opts.gatewayModel || "google/gemini-2.5-flash-image";

  if (gatewayModel.startsWith("openai/gpt-image")) {
    const size = opts.size && OPENAI_SIZES.has(opts.size) ? opts.size : openaiSizeFromAspect(opts.aspectRatio);
    const r = await fetch(`${LOVABLE_BASE}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: gatewayModel, prompt, size, n: 1, quality: "low" }),
    });
    if (!r.ok) throw new Error(`Lovable image ${r.status}: ${await r.text()}`);
    const j: any = await r.json();
    const item = j?.data?.[0];
    if (item?.b64_json) return { b64: item.b64_json, mime: "image/png" };
    if (item?.url) {
      const m = String(item.url).match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (m) return { b64: m[2], mime: m[1] };
      return { url: String(item.url), mime: "image/png" };
    }
    throw new Error(`Lovable AI returned no image data. ${JSON.stringify(j).slice(0, 300)}`);
  }

  const hints: string[] = [];
  if (opts.aspectRatio && opts.aspectRatio !== "auto") {
    hints.push(`The final image canvas must be exactly ${opts.aspectRatio} aspect ratio. Do not use a square canvas unless ${opts.aspectRatio} is 1:1.`);
  }
  if (opts.size && ["1K", "2K", "4K"].includes(opts.size)) hints.push(`Output resolution: ${opts.size}.`);
  const fullText = hints.length ? `${prompt}\n\nOutput constraints: ${hints.join(" ")}` : prompt;

  const content: any[] = [{ type: "text", text: fullText }];
  for (const url of referenceImageDataUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }
  const payload: Record<string, unknown> = {
    model: gatewayModel,
    messages: [{ role: "user", content: content.length === 1 ? fullText : content }],
    modalities: ["image", "text"],
  };
  const budget = Number(opts.thinkingBudget ?? 0);
  if (budget > 0 && gatewayModel.includes("gemini-3-pro")) {
    payload.reasoning = { effort: budget >= 5000 ? "high" : "low" };
  }
  const r = await fetch(`${LOVABLE_BASE}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Lovable image ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  const item = j?.data?.[0];
  if (item?.b64_json) return { b64: item.b64_json, mime: "image/png" };
  const directUrl = item?.url;
  if (directUrl) {
    const m = String(directUrl).match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (m) return { b64: m[2], mime: m[1] };
    return { url: String(directUrl), mime: "image/png" };
  }
  const msg = j.choices?.[0]?.message;
  const images = msg?.images;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    const url: string = first.image_url?.url || first.url || "";
    const m = url.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (m) return { b64: m[2], mime: m[1] };
    if (url) return { url, mime: "image/png" };
  }
  throw new Error(`Lovable AI returned no image data. ${JSON.stringify(j).slice(0, 300)}`);
}

// ---- OpenRouter (primary image + video provider) ----
// Images go through the dedicated POST /v1/images endpoint (real aspect_ratio /
// resolution / n / input_references enums). Video goes through the async
// POST /v1/videos job API: submit → poll polling_url → download unsigned_urls[0].
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

function openrouterHeaders(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://frank-create.lovable.app",
    "X-Title": "autosolutions OS",
  };
}

function openrouterKey(): string {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new ProviderRunError("OpenRouter is not configured (missing OPENROUTER_API_KEY).", "auth_failed", false);
  return key;
}

function mapOpenrouterHttpError(status: number, text: string): ProviderRunError {
  const msg = extractProviderMessage(text);
  if (status === 401 || status === 403) return new ProviderRunError(`OpenRouter auth failed: ${msg}`, "auth_failed", false, status, text);
  if (status === 402) return new ProviderRunError("OpenRouter credits exhausted. Top up the OpenRouter account.", "quota_exhausted", false, status, text);
  if (status === 429) return new ProviderRunError("OpenRouter is rate limited. Try again in a moment.", "rate_limited", true, status, text);
  if (status === 400 || status === 422) return new ProviderRunError(`Invalid request: ${msg}`, "invalid_params", false, status, text);
  if (status >= 500) return new ProviderRunError(`OpenRouter is busy (${status}). Try again in a moment.`, "provider_unavailable", true, status, text);
  return new ProviderRunError(`OpenRouter error ${status}: ${msg}`, "provider_error", false, status, text);
}

// POST with retry/backoff on transient statuses. Returns the parsed JSON body.
async function openrouterPost(path: string, payload: Record<string, unknown>): Promise<any> {
  const key = openrouterKey();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${OPENROUTER_BASE}${path}`, {
        method: "POST",
        headers: openrouterHeaders(key),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastErr = err;
      if (attempt === 2) throw new ProviderRunError(`OpenRouter network error: ${errMessage(err)}`, "provider_unavailable", true);
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      continue;
    }
    if (res.ok) {
      const j: any = await res.json();
      if (j?.error) {
        throw new ProviderRunError(
          `OpenRouter error: ${j.error?.message || JSON.stringify(j.error).slice(0, 200)}`,
          "provider_error",
          true,
          undefined,
          JSON.stringify(j).slice(0, 800),
        );
      }
      return j;
    }
    const text = await res.text();
    const mapped = mapOpenrouterHttpError(res.status, text);
    if (mapped.retryable && attempt < 2) {
      console.warn("[frank-api] openrouter:transient", { path, status: res.status, body: text.slice(0, 300) });
      lastErr = mapped;
      await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      continue;
    }
    console.error("[frank-api] openrouter:failed", { path, status: res.status, body: text.slice(0, 800) });
    throw mapped;
  }
  throw (lastErr instanceof ProviderRunError ? lastErr : new ProviderRunError(`OpenRouter unreachable: ${errMessage(lastErr)}`, "provider_unavailable", true));
}

function imageRefParts(urls: string[]): Array<Record<string, unknown>> {
  return urls.map((url) => ({ type: "image_url", image_url: { url } }));
}

// Dedicated image endpoint. `n` is honoured natively where the model supports it.
async function openrouterImage(
  prompt: string,
  referenceImageUrls: string[] = [],
  opts: { model: string; aspectRatio?: string; size?: string; quality?: string; n?: number } = { model: "google/gemini-3.1-flash-image" },
): Promise<Array<{ b64?: string; url?: string; mime: string }>> {
  const payload: Record<string, unknown> = { model: opts.model, prompt };
  if (opts.aspectRatio && opts.aspectRatio !== "match_input_image" && opts.aspectRatio !== "adaptive") {
    payload.aspect_ratio = opts.aspectRatio;
  }
  if (opts.size) {
    const res = String(opts.size).toUpperCase().replace("512", "512");
    if (["512", "1K", "2K", "4K"].includes(res)) payload.resolution = res;
  }
  if (opts.quality && ["auto", "low", "medium", "high"].includes(opts.quality)) payload.quality = opts.quality;
  if (opts.n && opts.n > 1) payload.n = opts.n;
  if (referenceImageUrls.length) payload.input_references = imageRefParts(referenceImageUrls);

  const j = await openrouterPost("/images", payload);
  const out: Array<{ b64?: string; url?: string; mime: string }> = [];
  for (const item of (Array.isArray(j?.data) ? j.data : [])) {
    const mime = String(item?.media_type || "image/png").toLowerCase();
    if (item?.b64_json) out.push({ b64: item.b64_json, mime });
    else if (item?.url) out.push({ url: item.url, mime });
  }
  if (!out.length) {
    throw new ProviderRunError(
      `OpenRouter returned no image data. ${JSON.stringify(j).slice(0, 300)}`,
      "provider_error",
      true,
    );
  }
  return out;
}

// Async video job: submit, poll, return the finished clip URL.
async function openrouterVideo(
  prompt: string,
  opts: {
    model: string;
    aspectRatio?: string;
    resolution?: string;
    duration?: number;
    firstFrameUrl?: string;
    lastFrameUrl?: string;
    referenceUrls?: string[];
    generateAudio?: boolean;
  },
  maxMs = 600_000,
): Promise<string> {
  const payload: Record<string, unknown> = { model: opts.model, prompt };
  if (Number.isFinite(opts.duration) && Number(opts.duration) > 0) payload.duration = Math.round(Number(opts.duration));
  if (opts.resolution) payload.resolution = opts.resolution;
  if (opts.aspectRatio && opts.aspectRatio !== "auto" && opts.aspectRatio !== "match_input_image" && opts.aspectRatio !== "adaptive") {
    payload.aspect_ratio = opts.aspectRatio;
  }
  const frames: Array<Record<string, unknown>> = [];
  if (opts.firstFrameUrl) frames.push({ type: "image_url", image_url: { url: opts.firstFrameUrl }, frame_type: "first_frame" });
  if (opts.lastFrameUrl) frames.push({ type: "image_url", image_url: { url: opts.lastFrameUrl }, frame_type: "last_frame" });
  if (frames.length) {
    payload.frame_images = frames;
    // frame_images takes precedence over input_references upstream; sending both
    // is pointless, so only attach refs in reference-to-video mode.
  } else if (opts.referenceUrls?.length) {
    payload.input_references = imageRefParts(opts.referenceUrls);
  }
  if (opts.generateAudio === false) payload.generate_audio = false;

  const job = await openrouterPost("/videos", payload);
  const jobId: string | undefined = job?.id;
  const pollUrl: string = job?.polling_url || (jobId ? `${OPENROUTER_BASE}/videos/${jobId}` : "");
  if (!pollUrl) {
    throw new ProviderRunError(`OpenRouter did not return a video job id. ${JSON.stringify(job).slice(0, 300)}`, "provider_error", true);
  }

  const key = openrouterKey();
  const started = Date.now();
  let delay = 4_000;
  while (Date.now() - started < maxMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 2_000, 10_000);
    let res: Response;
    try {
      res = await fetch(pollUrl, { headers: openrouterHeaders(key) });
    } catch {
      continue; // transient poll failure — keep waiting
    }
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) continue;
      throw mapOpenrouterHttpError(res.status, await res.text());
    }
    const status: any = await res.json();
    const state = String(status?.status || "").toLowerCase();
    if (state === "completed" || state === "succeeded") {
      const url: string | undefined = status?.unsigned_urls?.[0] || status?.urls?.[0] || status?.output?.[0];
      if (!url) throw new ProviderRunError("The video job completed without a downloadable clip.", "empty_output", true);
      return url;
    }
    if (state === "failed" || state === "canceled" || state === "cancelled") {
      const msg = status?.error?.message || status?.error || "The video model failed to render this clip.";
      throw new ProviderRunError(String(msg).slice(0, 400), "provider_error", true);
    }
  }
  throw new ProviderRunError("The video job is still rendering after 10 minutes. Try a shorter clip or a lower resolution.", "timeout", true);
}




async function loadReferenceDataUrls(assetIds: string[], userId: string): Promise<string[]> {
  if (!assetIds.length) return [];
  const sb = supabase();
  const { data } = await sb.from("assets").select("id,storage_path,metadata_json")
    .eq("user_id", userId).in("id", assetIds);
  const out: string[] = [];
  for (const row of data || []) {
    const url = await signed(row.storage_path);
    if (url) out.push(url);
  }
  return out;
}

function normalizeReferenceUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const url = typeof item === "string" ? item.trim() : "";
    if (!url || seen.has(url)) continue;
    if (!/^https?:\/\//i.test(url) && !/^data:image\//i.test(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}


async function getOrCreateDefaultSession(userId: string) {
  const sb = supabase();
  const existing = await sb
    .from("sessions").select("*").eq("user_id", userId)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (existing.data) return existing.data;
  const ins = await sb.from("sessions").insert({
    user_id: userId,
    title: "Studio session",
    active_model_key: "nano-banana-pro",
    settings_json: {},
  }).select().single();
  if (ins.error) throw ins.error;
  return ins.data;
}

function base64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function requestedDimensions(aspectRatio?: string, size?: string): { width: number; height: number } | null {
  const sizeMatch = String(size || "").match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (sizeMatch) {
    return { width: Number(sizeMatch[1]), height: Number(sizeMatch[2]) };
  }
  const ratioMatch = String(aspectRatio || "").match(/^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/i);
  if (!ratioMatch) return null;
  return { width: Number(ratioMatch[1]), height: Number(ratioMatch[2]) };
}

async function handleInference(body: any, userId: string) {
  const sb = supabase();
  let sessionId: string = body.session_id;
  if (!sessionId) sessionId = (await getOrCreateDefaultSession(userId)).id;

  const prompt: string = body.prompt || "";
  if (!prompt.trim()) throw new Error("Prompt is required");

  const turnId = crypto.randomUUID();
  const modelId: string = body.model || "nano-banana-pro";
  const gatewayModel = MODEL_MAP[modelId] || "google/gemini-2.5-flash-image";
  const reqSettings: any = body.settings || {};
  const settingsSnapshot: any = {
    kind: body.kind || "generate",
    model: modelId,
    settings: reqSettings,
    frank_body_mode: !!body.frank_body_mode,
    preset_key: body.preset_key ?? null,
    reference_asset_ids: body.reference_asset_ids || [],
    status: "running",
  };

  const msgIns = await sb.from("messages").insert({
    id: turnId,
    user_id: userId,
    session_id: sessionId,
    role: "user",
    message_type: settingsSnapshot.kind,
    prompt_text: prompt,
    settings_snapshot_json: settingsSnapshot,
  }).select("seq").single();
  if (msgIns.error) throw msgIns.error;
  const nextSeq = (msgIns.data as any)?.seq ?? 0;

  const MAX_COUNT_BY_MODEL: Record<string, number> = {
    "google-nb-pro": 4,
    "google-nb-2": 4,
    "openai-gpt-image-2": 10,
    "reve-2-1": 4,
    "seedream-5-pro": 6,
  };
  const modelCap = MAX_COUNT_BY_MODEL[modelId] ?? 4;
  const count = Math.min(Math.max(Number(reqSettings.count ?? body.count ?? 1) || 1, 1), modelCap);
  const generatedImages: Array<{ b64?: string; url?: string; mime: string }> = [];
  const partialErrors: Array<{ code: string; message: string; retryable: boolean; status?: number; request_id?: string }> = [];
  try {
    const refIds: string[] = [
      ...(body.edit_source_asset_id ? [body.edit_source_asset_id] : []),
      ...((body.reference_asset_ids as string[]) || []),
    ];
    const refUrls = normalizeReferenceUrls([
      ...normalizeReferenceUrls(body.reference_image_urls),
      ...(await loadReferenceDataUrls(refIds, userId)),
    ]);
    // The client composes a reference manifest (@ref1, @ref2 …) so a prompt can
    // target one specific attached image. Trust it when present, otherwise fall
    // back to the generic identity lock.
    const clientProviderPrompt = typeof body.provider_prompt === "string" ? body.provider_prompt.trim() : "";
    const providerPrompt = clientProviderPrompt
      ? clientProviderPrompt
      : (refUrls.length ? withReferenceIdentityLock(prompt, refUrls.length) : prompt);
    const openrouterModel = OPENROUTER_IMAGE_MAP[modelId];
    const replicateSlug = openrouterModel ? undefined : REPLICATE_MAP[modelId];
    if (openrouterModel) {
      // Primary path: OpenRouter's dedicated /v1/images endpoint. Models that
      // support n>1 get one call; the rest are fanned out in parallel.
      const nativeN = OPENROUTER_NATIVE_N.has(openrouterModel);
      const calls = nativeN ? 1 : count;
      const results = await Promise.allSettled(
        Array.from({ length: calls }, () =>
          openrouterImage(providerPrompt, refUrls, {
            model: openrouterModel,
            aspectRatio: reqSettings.aspect_ratio,
            size: reqSettings.image_size || reqSettings.size,
            quality: reqSettings.quality,
            n: nativeN ? count : 1,
          })
        )
      );
      for (const result of results) {
        if (result.status === "fulfilled") generatedImages.push(...result.value);
        else {
          const m = mapReplicateError(result.reason);
          partialErrors.push({ code: m.code, message: m.message, retryable: m.retryable, status: m.status });
        }
      }
      if (!generatedImages.length) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw first?.reason ?? new ProviderRunError("OpenRouter returned no images.", "provider_error", true);
      }
    } else if (replicateSlug) {


      const replicateKey = getReplicateGatewayKey();
      if (!replicateKey) throw new Error("Replicate is not connected for this model yet.");
      // Long models (Riverflow 4K, Seedream, agentic runs) routinely outlive a
      // single HTTP request. Create the predictions, hand the ids back to the
      // client, and let it poll /inference/status until they finish.
      const input = {
        aspect_ratio: reqSettings.aspect_ratio,
        size: reqSettings.image_size || reqSettings.size,
        reference_images: refUrls,
      };
      const created = await Promise.allSettled(
        Array.from({ length: count }, () =>
          createReplicatePrediction(replicateSlug, buildReplicateInput(replicateSlug, providerPrompt, input), replicateKey)
        )
      );
      const predictionIds: string[] = [];
      const createErrors: unknown[] = [];
      for (const result of created) {
        if (result.status === "fulfilled" && result.value) predictionIds.push(result.value);
        else createErrors.push(result.status === "rejected" ? result.reason : new ProviderRunError("Replicate did not return a prediction ID.", "provider_error", true));
      }
      for (const err of createErrors) {
        const m = mapReplicateError(err);
        partialErrors.push({ code: m.code, message: m.message, retryable: m.retryable, status: m.status, request_id: m.requestId });
      }
      if (!predictionIds.length) {
        throw createErrors[0] ?? new ProviderRunError("Replicate did not start any prediction.", "provider_error", true);
      }
      const runningSnapshot = {
        ...settingsSnapshot,
        status: "running",
        provider: "replicate",
        replicate_slug: replicateSlug,
        prediction_ids: predictionIds,
        requested_count: count,
        partial_errors: partialErrors.length ? partialErrors : undefined,
        started_at: nowIso(),
      };
      await sb.from("messages").update({ settings_snapshot_json: runningSnapshot }).eq("id", turnId);
      return {
        turn: rowToTurn({
          id: turnId, session_id: sessionId, role: "user",
          message_type: settingsSnapshot.kind, prompt_text: prompt,
          settings_snapshot_json: runningSnapshot,
          seq: nextSeq, created_at: nowIso(),
        }),
        status: "running" as const,
        assets: [],
        providerPayload: { provider: "replicate", model: replicateSlug, prediction_ids: predictionIds },
        localEngine: "cloud" as const,
      };
    } else {

      for (let i = 0; i < count; i++) {
        generatedImages.push(await lovableImage(providerPrompt, refUrls, {
          gatewayModel,
          aspectRatio: reqSettings.aspect_ratio,
          size: reqSettings.image_size || reqSettings.size,
          thinkingBudget: Number(reqSettings.thinking_budget ?? body.thinking_budget ?? 0),
        }));
      }
    }
  } catch (err) {
    const mapped = mapReplicateError(err);
    const msg = mapped.message;
    await sb.from("messages").update({
      settings_snapshot_json: {
        ...settingsSnapshot,
        status: "failed",
        error: msg,
        error_code: mapped.code,
        error_retryable: mapped.retryable,
        error_status: mapped.status ?? null,
        error_raw: mapped.raw ?? null,
        error_request_id: mapped.requestId ?? null,
      },
    }).eq("id", turnId);
    return {
      turn: rowToTurn({
        id: turnId, session_id: sessionId, role: "user",
        message_type: settingsSnapshot.kind, prompt_text: prompt,
        settings_snapshot_json: {
          ...settingsSnapshot,
          status: "failed",
          error: msg,
          error_code: mapped.code,
          error_retryable: mapped.retryable,
          error_status: mapped.status ?? null,
          error_raw: mapped.raw ?? null,
          error_request_id: mapped.requestId ?? null,
        },
        seq: nextSeq, created_at: nowIso(),
      }),
      status: "failed" as const,
      error: { code: mapped.code, message: msg, retryable: mapped.retryable, status: mapped.status, raw: mapped.raw, request_id: mapped.requestId } as any,
    };
  }

  const insertedAssets: any[] = await persistImageAssets({
    userId, sessionId, turnId, prompt, modelId,
    aspectRatio: reqSettings.aspect_ratio,
    requestedSize: reqSettings.image_size || reqSettings.size || null,
    images: generatedImages,
  });


  const assetIds = insertedAssets.map((asset) => asset.id);

  const completedSnapshot = {
    ...settingsSnapshot,
    status: "complete",
    output_asset_ids: assetIds,
    requested_count: count,
    partial_errors: partialErrors.length ? partialErrors : undefined,
  };
  await sb.from("messages").update({
    settings_snapshot_json: completedSnapshot,
  }).eq("id", turnId);

  const assets = await Promise.all(insertedAssets.map(async (asset) => rowToAsset(asset, await signed(asset.storage_path))));
  return {
    turn: rowToTurn({
      id: turnId, session_id: sessionId, role: "user",
      message_type: settingsSnapshot.kind, prompt_text: prompt,
      settings_snapshot_json: completedSnapshot,
      seq: nextSeq, created_at: nowIso(),
    }),
    status: "complete" as const,
    assets,
    providerPayload: OPENROUTER_IMAGE_MAP[modelId]
      ? { provider: "openrouter", model: OPENROUTER_IMAGE_MAP[modelId] }
      : { provider: "lovable", model: gatewayModel },

    localEngine: "cloud" as const,
  };
}

// Download + upload + insert in parallel: serial persistence added ~10s per
// image, which pushed multi-image rounds past the function's time budget.
async function persistImageAssets(args: {
  userId: string;
  sessionId: string;
  turnId: string;
  prompt: string;
  modelId: string;
  aspectRatio?: string;
  requestedSize?: string | null;
  images: Array<{ b64?: string; url?: string; mime: string }>;
}): Promise<any[]> {
  const sb = supabase();
  const requested = requestedDimensions(args.aspectRatio, args.requestedSize || undefined);
  return (await Promise.all(args.images.map(async (img) => {
    const assetId = crypto.randomUUID();
    const imageBytes = await imageBytesForUpload(img);
    const bytes = imageBytes.bytes;
    const mime = imageBytes.mime;
    const ext = mime.split("/")[1] || "png";
    const storagePath = `${args.sessionId}/${assetId}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: mime, upsert: false,
    });
    if (up.error) throw up.error;

    const assetIns = await sb.from("assets").insert({
      id: assetId,
      user_id: args.userId,
      session_id: args.sessionId,
      message_id: args.turnId,
      storage_path: storagePath,
      asset_type: "generated",
      prompt_snapshot: args.prompt,
      model_key: args.modelId,
      metadata_json: {
        media_type: "image",
        mime,
        title: args.prompt.slice(0, 80) || "Generated image",
        aspect_ratio: args.aspectRatio,
        requested_size: args.requestedSize ?? null,
        width: requested?.width,
        height: requested?.height,
      },
    }).select().single();
    if (assetIns.error) throw assetIns.error;
    return assetIns.data;
  }))).filter(Boolean);
}

// Poll the Replicate predictions recorded on a "running" turn. Returns as soon
// as anything is still processing so the client can keep polling; persists the
// images and closes out the turn once every prediction is terminal.
async function handleTurnStatus(body: any, userId: string) {
  const sb = supabase();
  const turnId = String(body?.turn_id || "");
  if (!turnId) throw new Error("turn_id is required.");

  const msgRes = await sb.from("messages").select("*").eq("id", turnId).maybeSingle();
  if (msgRes.error) throw msgRes.error;
  const row = msgRes.data;
  if (!row) throw new Error("Turn not found.");

  const snapshot = (row.settings_snapshot_json ?? {}) as any;
  const finishWithRows = async (snap: any, status: "complete" | "failed" | "running") => {
    const assetRows = await sb.from("assets").select("*").eq("message_id", turnId);
    const assets = await Promise.all((assetRows.data ?? []).map(async (asset: any) =>
      rowToAsset(asset, await signed(asset.storage_path))));
    return {
      turn: rowToTurn({ ...row, settings_snapshot_json: snap }),
      status,
      assets,
    };
  };

  const predictionIds: string[] = Array.isArray(snapshot.prediction_ids) ? snapshot.prediction_ids : [];
  if (snapshot.status !== "running" || !predictionIds.length) {
    const status = snapshot.status === "failed" ? "failed" : snapshot.status === "running" ? "running" : "complete";
    return await finishWithRows(snapshot, status as any);
  }

  const replicateKey = getReplicateGatewayKey();
  if (!replicateKey) throw new Error("Replicate is not connected.");

  const predictions = await Promise.all(predictionIds.map(async (id) => {
    try {
      return { id, prediction: await fetchReplicatePrediction(id, replicateKey) };
    } catch (err) {
      return { id, error: err };
    }
  }));

  const pending = predictions.filter((entry) =>
    entry.prediction && !["succeeded", "failed", "canceled"].includes(entry.prediction.status));
  if (pending.length) {
    return await finishWithRows({ ...snapshot, pending_count: pending.length }, "running");
  }

  const images: Array<{ url: string; mime: string }> = [];
  const partialErrors: Array<Record<string, unknown>> = Array.isArray(snapshot.partial_errors) ? [...snapshot.partial_errors] : [];
  for (const entry of predictions) {
    if (entry.error) {
      const m = mapReplicateError(entry.error);
      partialErrors.push({ code: m.code, message: m.message, retryable: m.retryable, status: m.status, request_id: entry.id });
      continue;
    }
    const prediction = entry.prediction;
    if (prediction.status === "succeeded") {
      const extracted = extractReplicateUrl(prediction.output);
      if (extracted) images.push({ url: extracted, mime: "image/png" });
      else partialErrors.push({ code: "empty_output", message: "Replicate returned no image URL.", retryable: true, request_id: entry.id });
      continue;
    }
    const raw = typeof prediction.error === "string" ? prediction.error : JSON.stringify(prediction.error ?? prediction.status);
    const classified = classifyReplicateModelError(raw, prediction.status);
    partialErrors.push({ code: classified.code, message: classified.message, retryable: classified.retryable, request_id: entry.id });
  }

  if (!images.length) {
    const first = partialErrors[0] as any;
    const failedSnapshot = {
      ...snapshot,
      status: "failed",
      error: first?.message || "Generation failed.",
      error_code: first?.code ?? "provider_error",
      error_retryable: first?.retryable ?? true,
      partial_errors: partialErrors,
    };
    await sb.from("messages").update({ settings_snapshot_json: failedSnapshot }).eq("id", turnId);
    const result = await finishWithRows(failedSnapshot, "failed");
    return {
      ...result,
      error: {
        code: failedSnapshot.error_code,
        message: failedSnapshot.error,
        retryable: failedSnapshot.error_retryable,
        request_id: first?.request_id,
      },
    };
  }

  const inserted = await persistImageAssets({
    userId,
    sessionId: row.session_id,
    turnId,
    prompt: row.prompt_text || "",
    modelId: snapshot.model || snapshot.model_key || "",
    aspectRatio: snapshot.aspect_ratio ?? snapshot.settings?.aspect_ratio,
    requestedSize: snapshot.image_size ?? snapshot.settings?.image_size ?? null,
    images,
  });

  const completedSnapshot = {
    ...snapshot,
    status: "complete",
    output_asset_ids: inserted.map((asset: any) => asset.id),
    partial_errors: partialErrors.length ? partialErrors : undefined,
    pending_count: 0,
  };
  await sb.from("messages").update({ settings_snapshot_json: completedSnapshot }).eq("id", turnId);
  return await finishWithRows(completedSnapshot, "complete");
}

// Create a Replicate prediction and hand back its id without waiting for it.
async function createReplicatePrediction(
  slug: string,
  input: Record<string, unknown>,
  key: string,
): Promise<string> {
  const replicateGateway = "https://connector-gateway.lovable.dev/replicate/v1";
  const headers = {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": key,
  };
  console.info("[frank-api] replicate:create_async", {
    slug, input: sanitizeReplicateInput(input), reference_count: countReferenceInputs(input),
  });
  let res: Response | undefined;
  let lastTransientBody = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(`${replicateGateway}/models/${slug}/predictions`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
    } catch (err) {
      if (attempt === 2) throw new ProviderRunError(`Replicate network error: ${errMessage(err)}`, "provider_unavailable", true, undefined, errMessage(err));
      await delay(1200 + attempt * 1200);
      continue;
    }
    if ([502, 503, 504].includes(res.status)) {
      lastTransientBody = await res.text().catch(() => "");
      if (attempt === 2) break;
      await delay(1200 + attempt * 1200);
      continue;
    }
    break;
  }
  if (!res) throw new ProviderRunError("Replicate upstream unreachable.", "provider_unavailable", true);
  if (!res.ok) {
    const text = lastTransientBody || await res.text();
    console.error("[frank-api] replicate:create_failed", { slug, status: res.status, body: text.slice(0, 1000) });
    throw mapReplicateCreateFailure(slug, res.status, text);
  }
  const prediction: any = await res.json();
  if (!prediction?.id) throw new ProviderRunError("Replicate did not return a prediction ID.", "provider_error", true);
  return String(prediction.id);
}

async function fetchReplicatePrediction(id: string, key: string): Promise<any> {
  const res = await fetch(`https://connector-gateway.lovable.dev/replicate/v1/predictions/${id}`, {
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": key,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ProviderRunError(`Replicate poll failed (${res.status}): ${extractProviderMessage(text)}`, res.status >= 500 ? "provider_unavailable" : "provider_error", true, res.status, text, id);
  }
  return await res.json();
}



async function imageBytesForUpload(img: { b64?: string; url?: string; mime: string }): Promise<{ bytes: Uint8Array; mime: string }> {
  if (img.b64) {
    return { bytes: base64Decode(img.b64), mime: img.mime || "image/png" };
  }
  const url = img.url || "";
  const dataMatch = url.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (dataMatch) {
    return { bytes: base64Decode(dataMatch[2]), mime: dataMatch[1] };
  }
  if (!url) throw new Error("Provider returned an empty image URL.");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download generated image (${res.status}).`);
  const mime = (res.headers.get("content-type") || img.mime || "image/png").split(";")[0];
  return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
}

async function runReplicate(
  slug: string,
  prompt: string,
  body: { aspect_ratio?: string; size?: string; reference_images?: string[] },
  key: string,
): Promise<string | undefined> {
  return runReplicatePrediction(slug, buildReplicateInput(slug, prompt, body), key);
}

async function runReplicatePrediction(
  slug: string,
  input: Record<string, unknown>,
  key: string,
  maxMs = 180_000,
): Promise<string | undefined> {
  const replicateGateway = "https://connector-gateway.lovable.dev/replicate/v1";
  const replicateHeaders = {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": key,
  };
  console.info("[frank-api] replicate:create", {
    slug,
    input: sanitizeReplicateInput(input),
    reference_count: countReferenceInputs(input),
    has_lovable_key: !!LOVABLE_API_KEY,
    has_connector_key: !!key,
  });
  const createOnce = () => fetch(`${replicateGateway}/models/${slug}/predictions`, {
    method: "POST",
    headers: { ...replicateHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  let createRes: Response | undefined;
  let lastTransientBody = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      createRes = await createOnce();
    } catch (err) {
      console.warn("[frank-api] replicate:create_network", { slug, attempt, err: errMessage(err) });
      if (attempt === 2) throw new ProviderRunError(`Replicate network error: ${errMessage(err)}`, "provider_unavailable", true, undefined, errMessage(err));
      await delay(1500 + attempt * 1500 + Math.floor(Math.random() * 500));
      continue;
    }
    console.info("[frank-api] replicate:create:status", { slug, attempt, status: createRes.status });
    if ([502, 503, 504].includes(createRes.status)) {
      lastTransientBody = await createRes.text().catch(() => "");
      if (attempt === 2) break;
      await delay(1500 + attempt * 1500 + Math.floor(Math.random() * 500));
      continue;
    }
    break;
  }
  if (!createRes) {
    throw new ProviderRunError("Replicate upstream unreachable.", "provider_unavailable", true);
  }
  if (!createRes.ok) {
    const text = lastTransientBody || await createRes.text();
    console.error("[frank-api] replicate:create_failed", { slug, status: createRes.status, body: text.slice(0, 1000) });
    throw mapReplicateCreateFailure(slug, createRes.status, text);
  }
  let prediction: any = await createRes.json();
  const started = Date.now();
  let transientPollFails = 0;
  while (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
    if (Date.now() - started > maxMs) throw new ProviderRunError(`Replicate timed out after ${Math.round(maxMs / 1000)}s.`, "timeout", true, undefined, undefined, prediction?.id);
    await delay(2000);
    const predictionId = prediction?.id;
    if (!predictionId) throw new ProviderRunError("Replicate did not return a prediction ID.", "provider_error", true);
    let poll: Response;
    try {
      poll = await fetch(`${replicateGateway}/predictions/${predictionId}`, { headers: replicateHeaders });
    } catch (err) {
      transientPollFails++;
      console.warn("[frank-api] replicate:poll_network", { slug, id: predictionId, transientPollFails, err: errMessage(err) });
      if (transientPollFails >= 4) {
        throw new ProviderRunError(`Replicate poll network failure: ${errMessage(err)}`, "provider_unavailable", true, undefined, errMessage(err), predictionId);
      }
      continue;
    }
    if (!poll.ok) {
      const text = await poll.text();
      if (poll.status >= 500 && poll.status <= 599) {
        transientPollFails++;
        console.warn("[frank-api] replicate:poll_transient", { slug, id: predictionId, status: poll.status, transientPollFails });
        if (transientPollFails >= 4) {
          throw new ProviderRunError(`Replicate poll failed (${poll.status}) after retries: ${extractProviderMessage(text)}`, "provider_unavailable", true, poll.status, text, predictionId);
        }
        continue;
      }
      console.error("[frank-api] replicate:poll_failed", { slug, id: predictionId, status: poll.status, body: text.slice(0, 1000) });
      throw new ProviderRunError(`Replicate poll failed (${poll.status}): ${extractProviderMessage(text)}`, "provider_error", true, poll.status, text, predictionId);
    }
    transientPollFails = 0;
    prediction = await poll.json();
    console.info("[frank-api] replicate:poll:status", { slug, id: predictionId, status: prediction?.status });
  }
  if (prediction.status !== "succeeded") {
    console.error("Replicate prediction non-success", {
      slug, id: prediction?.id, status: prediction?.status, error: prediction?.error,
    });
    const raw = typeof prediction.error === "string" ? prediction.error : JSON.stringify(prediction.error ?? prediction.status);
    if (typeof prediction.error === "string" && /content|policy|safety|nsfw/i.test(prediction.error)) {
      throw new ProviderRunError(`Replicate blocked by content policy: ${raw.slice(0, 200)}`, "content_filtered", false, undefined, raw, prediction?.id);
    }
    const classified = classifyReplicateModelError(raw, prediction.status);
    classified.requestId = prediction?.id;
    throw classified;
  }
  const output = prediction.output;
  const extracted = extractReplicateUrl(output);
  if (!extracted) {
    console.error("Replicate empty output", {
      slug, id: prediction?.id, status: prediction?.status,
      output_type: typeof output, output_sample: JSON.stringify(output ?? null).slice(0, 300),
    });
    throw new ProviderRunError(`Replicate returned no image URL (output=${JSON.stringify(output ?? null).slice(0, 160)})`, "empty_output", true, undefined, JSON.stringify(output ?? null).slice(0, 1000), prediction?.id);
  }
  return extracted;
}

function getReplicateGatewayKey(): string | undefined {
  return Deno.env.get("REPLICATE_API_KEY") || Deno.env.get("LOVABLE_CONNECTOR_REPLICATE_API_KEY");
}

function sanitizeReplicateInput(input: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...input };
  if (typeof copy.prompt === "string") copy.prompt = String(copy.prompt).slice(0, 240);
  for (const key of ["reference_images", "image_input", "input_images"]) {
    const value = copy[key];
    if (Array.isArray(value)) copy[key] = value.map((item) => typeof item === "string" ? `[uri:${item.length}]` : "[non-string]");
  }
  return copy;
}

function countReferenceInputs(input: Record<string, unknown>): number {
  return ["reference_images", "image_input", "input_images"].reduce((total, key) => {
    const value = input[key];
    return total + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

class ProviderRunError extends Error {
  requestId?: string;
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public status?: number,
    public raw?: string,
    requestId?: string,
  ) {
    super(message);
    this.requestId = requestId;
  }
}

function mapReplicateCreateFailure(slug: string, status: number, raw: string): ProviderRunError {
  const providerMessage = extractProviderMessage(raw);
  const requestId = extractGatewayRequestId(raw);
  if (status === 402) return new ProviderRunError("Replicate account has no credit. Enable billing at replicate.com/account/billing.", "quota_exhausted", false, status, raw, requestId);
  if (status === 401 || status === 403) return new ProviderRunError(`Replicate auth failed: ${providerMessage}. Reconnect the Replicate integration if this continues.`, "auth_failed", false, status, raw, requestId);
  if (status === 422) return new ProviderRunError(`Invalid parameters for ${slug}: ${providerMessage}`, "invalid_params", false, status, raw, requestId);
  if (status === 429) return new ProviderRunError("Replicate rate limit hit. Wait a moment and try again.", "rate_limited", true, status, raw, requestId);
  if (status >= 500) return new ProviderRunError(`Replicate upstream is overloaded (${status}). We retried automatically — try again in a moment, or switch model.`, "provider_unavailable", true, status, raw, requestId);
  return new ProviderRunError(`Replicate error ${status}: ${providerMessage}`, "provider_error", false, status, raw, requestId);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractGatewayRequestId(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.request_id === "string" ? parsed.request_id : undefined;
  } catch {
    return undefined;
  }
}

function mapReplicateError(err: unknown): ProviderRunError {
  if (err instanceof ProviderRunError) return err;
  const message = errMessage(err);
  if (/fetch failed|ECONN|ENOTFOUND|network|timeout/i.test(message)) {
    return new ProviderRunError("Network error reaching Replicate. Retry in a moment.", "network_error", true, undefined, message);
  }
  return new ProviderRunError(message, "provider_error", true, undefined, message);
}

function extractProviderMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (typeof parsed?.title === "string") return parsed.title;
    if (typeof parsed?.error === "string") return parsed.error;
    if (Array.isArray(parsed?.detail)) return parsed.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join("; ");
    return raw.slice(0, 240);
  } catch {
    return raw.slice(0, 240);
  }
}

function classifyReplicateModelError(raw: string, status: string): ProviderRunError {
  const text = raw.toLowerCase();
  // Replicate infrastructure faults, not prompt/param faults. "Director" is
  // Replicate's internal scheduler; E9243/E6716 and friends fail before the
  // model ever sees the input, so the only correct response is a retry.
  if (
    text.includes("e9243") ||
    text.includes("e6716") ||
    text.includes("director:") ||
    text.includes("unexpected error handling prediction")
  ) {
    return new ProviderRunError(
      "Replicate hit an internal error before running the model (E9243). Nothing is wrong with the prompt — retry the run.",
      "provider_unavailable",
      true,
      undefined,
      raw,
    );
  }
  // Generic upstream model outage: Replicate relays the vendor's opaque
  // "ModelError ... (E001)" when the hosted model itself is unhealthy. This
  // fails within a second, before inference, regardless of prompt or params.
  if (text.includes("e001") || text.includes("modelerror")) {
    return new ProviderRunError(
      "This model is temporarily unavailable on the provider side. Try Nano Banana Pro, Seedream 5 Pro, or GPT-image-2.",
      "provider_unavailable",
      true,
      undefined,
      raw,
    );
  }
  if (text.includes("nsfw") || text.includes("safety") || text.includes("content policy") || text.includes("flagged")) {
    return new ProviderRunError("The provider blocked this prompt for safety/policy reasons. Rewrite and try again.", "content_filtered", false, undefined, raw);
  }
  // Guard the param heuristics with word boundaries — a bare "expected"
  // substring also matches "unexpected", which is an infra fault, not a
  // parameter problem.
  if (/\binvalid\b/.test(text) || /\bmust be\b/.test(text) || /(^|[^n])\bexpected\b/.test(text) || /\brequired\b/.test(text)) {
    return new ProviderRunError(`Model rejected input parameters: ${raw.slice(0, 200)}`, "invalid_params", false, undefined, raw);
  }
  if (text.includes("timeout") || text.includes("timed out")) {
    return new ProviderRunError("Model timed out. Retry shortly.", "timeout", true, undefined, raw);
  }
  if (text.includes("rate") && text.includes("limit")) {
    return new ProviderRunError("Rate limit hit. Wait and retry.", "rate_limited", true, undefined, raw);
  }
  return new ProviderRunError(`Replicate ${status}: ${raw.slice(0, 240)}`, "model_error", true, undefined, raw);
}


function extractReplicateUrl(output: unknown): string | undefined {
  if (!output) return undefined;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const u = extractReplicateUrl(item);
      if (u) return u;
    }
    return undefined;
  }
  if (typeof output === "object") {
    const rec = output as Record<string, unknown>;
    for (const key of ["image", "url", "output", "image_url", "file", "content", "result"]) {
      const v = rec[key];
      if (typeof v === "string" && v) return v;
      const nested = extractReplicateUrl(v);
      if (nested) return nested;
    }
    if (Array.isArray(rec.images)) return extractReplicateUrl(rec.images);
    if (Array.isArray(rec.urls)) return extractReplicateUrl(rec.urls);
    if (Array.isArray(rec.files)) return extractReplicateUrl(rec.files);
    if (Array.isArray(rec.data)) return extractReplicateUrl(rec.data);
  }
  return undefined;
}

function buildReplicateInput(
  slug: string,
  prompt: string,
  body: { aspect_ratio?: string; size?: string; reference_images?: string[] },
): Record<string, unknown> {
  const refs = Array.isArray(body.reference_images)
    ? body.reference_images.map((url) => typeof url === "string" ? url.trim() : "").filter(Boolean)
    : [];
  if (slug === "reve/reve-2.1") {
    const allowed = new Set([
      "auto", "1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16",
      "5:4", "4:5", "21:9", "17:9", "2:1", "1:2", "3:1", "1:3", "4:1", "1:4",
    ]);
    const aspect = body.aspect_ratio && allowed.has(body.aspect_ratio) ? body.aspect_ratio : "auto";
    const input: Record<string, unknown> = { prompt, aspect_ratio: aspect };
    if (refs.length) input.reference_images = refs.slice(0, 8);
    return input;
  }
  if (slug === "sourceful/riverflow-2.0-pro") {
    const allowed = new Set(["auto", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"]);
    const aspect = body.aspect_ratio && allowed.has(body.aspect_ratio) ? body.aspect_ratio : "auto";
    const resolution = body.size === "4K" ? "4K" : body.size === "2K" ? "2K" : "1K";
    const input: Record<string, unknown> = {
      instruction: prompt,
      aspect_ratio: aspect,
      resolution,
      output_format: "png",
    };
    if (refs.length) input.init_images = refs.slice(0, 10);
    return input;
  }
  if (slug === "bytedance/seedream-5-pro") {
    const allowed = new Set(["match_input_image", "1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"]);
    const aspect = body.aspect_ratio && allowed.has(body.aspect_ratio) ? body.aspect_ratio : refs.length ? "match_input_image" : "1:1";
    const input: Record<string, unknown> = {
      prompt,
      size: body.size === "2K" ? "2K" : "1K",
      aspect_ratio: aspect,
      output_format: "png",
    };
    if (refs.length) input.image_input = refs.slice(0, 10);
    return input;
  }
  if (slug === "google/nano-banana-pro" || slug === "google/nano-banana-2") {
    const NB_PRO_AR = new Set([
      "match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
    ]);
    const NB2_AR = new Set([
      "match_input_image", "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
    ]);
    const allowed = slug === "google/nano-banana-pro" ? NB_PRO_AR : NB2_AR;
    const aspect = body.aspect_ratio && allowed.has(body.aspect_ratio)
      ? body.aspect_ratio
      : refs.length ? "match_input_image" : "1:1";
    const resolution = body.size === "4K" ? "4K" : body.size === "2K" ? "2K" : "1K";
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      resolution,
      output_format: "png",
    };
    if (refs.length) input.image_input = refs.slice(0, 14);
    return input;
  }
  if (slug === "openai/gpt-image-2") {
    const RATIO_AR = new Set(["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"]);
    const PIXEL_AR = new Set([
      "1024x1024", "1536x1024", "1024x1536",
      "1536x1152", "1152x1536",
      "2048x2048", "2048x1152", "1152x2048",
      "3840x2160", "2160x3840",
    ]);
    let aspect = "1:1";
    if (body.size && PIXEL_AR.has(body.size)) aspect = body.size;
    else if (body.size && RATIO_AR.has(body.size)) aspect = body.size;
    else if (body.aspect_ratio && RATIO_AR.has(body.aspect_ratio)) aspect = body.aspect_ratio;
    else if (body.aspect_ratio && PIXEL_AR.has(body.aspect_ratio)) aspect = body.aspect_ratio;
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: aspect,
      quality: "auto",
      number_of_images: 1,
      output_format: "png",
    };
    if (refs.length) input.input_images = refs.slice(0, 10);
    return input;
  }
  return { prompt };
}

function withReferenceIdentityLock(prompt: string, referenceCount: number): string {
  return [
    `STRICT REFERENCE REQUIREMENT: ${referenceCount} image reference${referenceCount === 1 ? " is" : "s are"} attached and must define the product identity.`,
    "Use the reference image(s) for the exact product/packaging/logo/colors/label/shape/material details.",
    "Do not replace the reference product with another object, animal product, shipping box, generic pack, different brand, or invented label.",
    "If the user asks for a product, pack, box, bottle, tube, or object, it means the product shown in the attached reference image(s).",
    prompt,
  ].join("\n");
}

const REMIX_SHARED_INSTRUCTION = [
  "Rewrite the existing image-generation brief according to the selected creative direction.",
  "Preserve all explicit requirements from the original brief, including:",
  "- Product identity, quantity, packaging, colours and proportions",
  "- People, setting, props and actions",
  "- Composition requirements that do not conflict with the selected remix",
  "- Aspect ratio and output format",
  "- Any instructions specifying what must not be changed",
  "Only adjust the photography, framing, lighting, composition and visual atmosphere. Add useful photographic detail where needed, but do not invent new products, branding, text, people or major scene elements.",
  "Return one cohesive image-generation brief. Do not mention the remix process or provide explanations.",
].join("\n");

const REMIX_DIRECTIVES: Array<{ key: string; label: string; directive: string }> = [
  {
    key: "close_up",
    label: "CLOSE-UP",
    directive: [
      "Transform the original brief into intimate close-up photography.",
      "Move the camera closer and use tight, intentional cropping to emphasize the most important subject. Highlight tactile details such as skin, packaging, product texture, water, material finishes and product interaction. Use a close-focusing 85–100mm lens aesthetic, shallow depth of field, selective focus and refined background separation.",
      "Keep essential product branding and defining features visible and accurate. If a person is present, focus on expressive details such as the face, hands, skin or interaction with the product. If the scene is product-only, create a detailed, sensory product composition.",
      "Preserve the original concept, environment and required elements while making the result feel intimate, dimensional and visually immersive.",
    ].join("\n"),
  },
  {
    key: "editorial_campaign",
    label: "EDITORIAL CAMPAIGN",
    directive: [
      "Transform the original brief into premium editorial campaign photography.",
      "Elevate the scene through deliberate art direction, confident composition, sophisticated styling and polished professional lighting. Create a strong visual hierarchy with a clear hero subject, considered negative space and an intentional relationship between the subject, products and environment.",
      "The result should feel distinctive, aspirational and suitable for a major Frank Body advertising campaign. Use refined beauty photography, dimensional lighting, controlled colour, premium texture and a polished commercial finish without making the image feel generic or overly corporate.",
      "Preserve the original concept, products, people, setting and actions while increasing the production value and campaign impact.",
    ].join("\n"),
  },
  {
    key: "candid",
    label: "CANDID",
    directive: [
      "Transform the original brief into candid lifestyle photography.",
      "Make the scene feel spontaneous, natural and captured in the middle of a real moment. Use relaxed body language, authentic expressions, natural movement, observational framing and slight compositional imperfection. Apply a 35–50mm lifestyle-photography aesthetic with believable environmental light, realistic skin texture and subtle depth of field.",
      "If a person is present, show an unposed interaction with the product or environment. If the scene is product-only, arrange the products as though they have been naturally placed or recently used, while maintaining an intentional and visually appealing composition.",
      "Preserve the original concept, products, setting and actions while giving the image an energetic, relatable and effortlessly authentic Frank Body feeling.",
    ].join("\n"),
  },
];

async function handleRemix(body: any) {
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return { variants: [] };

  const results = await Promise.all(
    REMIX_DIRECTIVES.map(async (entry) => {
      try {
        const content = await lovableChat([
          {
            role: "system",
            content: [
              REMIX_SHARED_INSTRUCTION,
              "",
              "SELECTED CREATIVE DIRECTION:",
              entry.directive,
              "",
              "Return ONLY the rewritten brief as plain prose. No titles, labels, quotes or markdown.",
            ].join("\n"),
          },
          { role: "user", content: `ORIGINAL BRIEF:\n${prompt}` },
        ]);
        const rewritten = String(content || "").trim();
        if (!rewritten) return null;
        return { key: entry.key, label: entry.label, prompt: rewritten };
      } catch {
        return null;
      }
    }),
  );

  return { variants: results.filter(Boolean) };
}


async function readJson(req: Request): Promise<any> {
  try { return await req.json(); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip the `/functions/v1/frank-api` prefix that Supabase prepends.
  // Path becomes the equivalent of the SPA's `/api/frank/<rest>` minus `/api/frank`.
  let path = url.pathname;
  const idx = path.indexOf("/frank-api");
  if (idx >= 0) path = path.slice(idx + "/frank-api".length);
  if (!path) path = "/";
  const method = req.method.toUpperCase();

  try {
    // ---- Public endpoints ----
    if (path === "/health" || path === "/") {
      return json({ ok: true, product: "frank-create", store: "lovable-cloud" });
    }
    if (path === "/config") return json(DEFAULT_CONFIG);
    if (path === "/models") return json({ models: DEFAULT_CONFIG.models, backlogModels: [], promptPresets: DEFAULT_CONFIG.promptPresets });

    if (path === "/provider-status") {
      return json({
        summary: {
          modelCount: 1, readyModels: 1, waitingModels: 0,
          configuredEnvVars: ["LOVABLE_API_KEY"], missingEnvVars: [],
        },
        providers: [{
          provider: "lovable", configured: true, model_count: 1,
          ready_model_count: 1, waiting_model_count: 0,
          configured_env_vars: ["LOVABLE_API_KEY"], missing_env_vars: [],
          models: ["nano-banana-pro"],
        }],
        models: [DEFAULT_MODEL],
        notes: ["Connected to Lovable AI Gateway."],
      });
    }
    if (path === "/provider-audit") {
      return json({
        title: "Provider audit", generated_at: nowIso(),
        summary: {
          model_count: 1, runner_registered: 1, missing_runners: 0,
          ready_models: 1, waiting_for_key: 0, preview_failures: 0,
          no_spend: true, secret_values_returned: false,
        },
        models: [], notes: [],
      });
    }
    if (path === "/activation-checklist") {
      return json({
        title: "Activation", status: "ready",
        summary: {
          ready_provider_models: 1, provider_model_count: 1,
          waiting_provider_models: 0, diffusion_ready: true,
          checkpoint_count: 0, server_key_file: ".env",
          configured_env_vars: ["LOVABLE_API_KEY"], missing_env_vars: [],
        },
        steps: [{ key: "lovable", label: "Lovable AI", status: "ready", detail: "Connected", action: "" }],
        notes: [],
      });
    }
    if (path === "/demo-doctor") {
      return json({
        status: "ready", readyForDemo: true, headline: "Lovable AI connected",
        summary: {
          activeSessionCount: 1, outputAssetCount: 0, approvedAssetCount: 0,
          referenceAssetCount: 0, readyProviderModels: 1, waitingProviderModels: 0,
        },
        checks: [], notes: [],
      });
    }
    if (path === "/provider-env") {
      return json({
        filePath: ".env", fileExists: true,
        envVars: ["LOVABLE_API_KEY"], configuredEnvVars: ["LOVABLE_API_KEY"],
        missingEnvVars: [], notes: [],
      });
    }
    if (path === "/projects") {
      return json({
        projects: [{ id: "default", name: "Default", status: "active", created_at: nowIso(), updated_at: nowIso() }],
      });
    }
    if (path.startsWith("/briefs")) return json({ briefs: [] });
    if (path.startsWith("/runs")) return json({ runs: [] });
    if (path === "/local-engine/workflow-blueprints") {
      return json({ blueprints: [], filePath: "cloud:blueprints", note: "Workflow blueprints are not used by the cloud studio." });
    }
    if (path === "/local-engine/setup" && method === "POST") {
      return json({
        created_dirs: [], readme_path: "cloud:local-engine",
        localEngine: {
          diffusion_ready: false, note: "Local engine not available in Lovable preview.",
          checkpoints: [], ignored_checkpoints: [], recommended_checkpoints: [],
          setup_steps: [], checkpoint_dir: "models/checkpoints",
        },
      });
    }
    if (path.startsWith("/local-engine/")) {
      return json({ ok: false, note: "Local engine not available in Lovable preview." }, 200);
    }
    if (path === "/provider-preflight" && method === "POST") {
      return json({ ok: true, provider: "lovable", checks: [], notes: ["Lovable AI Gateway connected."] });
    }



    // ---- Authenticated endpoints ----
    const userId = await requireUser(req);

    if (path === "/sessions" && method === "GET") {
      const { data } = await supabase().from("sessions").select("*")
        .eq("user_id", userId).order("created_at", { ascending: true });
      const rows = data && data.length ? data : [await getOrCreateDefaultSession(userId)];
      return json({ sessions: rows.map(rowToSession) });
    }
    if (path === "/sessions" && method === "POST") {
      const body = await readJson(req);
      const ins = await supabase().from("sessions").insert({
        user_id: userId, title: body.name || "New session",
        active_model_key: "nano-banana-pro", settings_json: {},
      }).select().single();
      if (ins.error) throw ins.error;
      return json({ session: rowToSession(ins.data) });
    }

    if (path.startsWith("/turns") && method === "GET") {
      const sid = url.searchParams.get("session_id");
      const q = supabase().from("messages").select("*").order("seq", { ascending: true });
      const { data } = sid ? await q.eq("session_id", sid) : await q.eq("user_id", userId);
      return json({ turns: (data || []).map(rowToTurn) });
    }

    if (path.startsWith("/assets") && method === "GET") {
      const sid = url.searchParams.get("session_id");
      const q = supabase().from("assets").select("*").order("created_at", { ascending: true });
      const { data } = sid ? await q.eq("session_id", sid) : await q.eq("user_id", userId);
      const items = await Promise.all((data || []).map(async (r: any) => rowToAsset(r, await signed(r.storage_path))));
      return json({ assets: items });
    }

    if (path === "/references" && method === "POST") {
      const body = await readJson(req).catch(() => ({}));
      const sessionId = String(body.session_id || "");
      const storagePath = String(body.file_path || "");
      if (!sessionId || !storagePath) {
        return json({ error: { code: "invalid_reference", message: "Reference needs a session and uploaded image path." } }, 400);
      }
      const metadata = {
        title: String(body.title || "Reference image"),
        media_type: "image",
        mime: typeof body.mime === "string" ? body.mime : "image/png",
        source_asset_id: typeof body.source_asset_id === "string" ? body.source_asset_id : null,
        width: typeof body.width === "number" ? body.width : null,
        height: typeof body.height === "number" ? body.height : null,
        approval_status: "review",
      };
      const { data, error } = await supabase().from("assets").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        session_id: sessionId,
        storage_path: storagePath,
        asset_type: "reference",
        prompt_snapshot: typeof body.prompt === "string" ? body.prompt : null,
        model_key: typeof body.model === "string" ? body.model : null,
        metadata_json: metadata,
      }).select().single();
      if (error) return json({ error: { code: "reference_create_failed", message: error.message } }, 400);
      return json({ asset: rowToAsset(data, await signed(data.storage_path)) });
    }

    const turnDelMatch = path.match(/^\/turns\/([^/]+)$/);
    if (turnDelMatch && method === "DELETE") {
      const tid = turnDelMatch[1];
      const sb = supabase();
      // Best-effort: remove storage objects, then asset rows, then the message row.
      const { data: assetRows } = await sb.from("assets").select("id,storage_path")
        .eq("user_id", userId).eq("message_id", tid);
      const paths = (assetRows || []).map((r: any) => r.storage_path).filter(Boolean);
      if (paths.length) {
        try { await sb.storage.from("studio-images").remove(paths); } catch (_) { /* ignore */ }
      }
      await sb.from("assets").delete().eq("user_id", userId).eq("message_id", tid);
      const { error } = await sb.from("messages").delete().eq("user_id", userId).eq("id", tid);
      if (error) throw error;
      return json({ ok: true });
    }

    const assetIdMatch = path.match(/^\/assets\/([^/]+)$/);
    if (assetIdMatch && method === "PATCH") {
      const aid = assetIdMatch[1];
      const body = await readJson(req).catch(() => ({}));
      const sb = supabase();
      const { data: prev } = await sb.from("assets").select("*").eq("user_id", userId).eq("id", aid).maybeSingle();
      if (!prev) return json({ error: { code: "not_found", message: "Asset not found" } }, 404);

      const nextMeta = { ...(prev.metadata_json || {}) };
      const patch: Record<string, unknown> = {};
      if (typeof body.approval_status === "string") {
        nextMeta.approval_status = body.approval_status;
      }
      if (typeof body.title === "string") nextMeta.title = body.title;
      patch.metadata_json = nextMeta;

      const { data: updated, error } = await sb.from("assets").update(patch).eq("user_id", userId).eq("id", aid).select("*").maybeSingle();
      if (error) return json({ error: { code: "update_failed", message: error.message } }, 400);

      // Audit event when approval status actually changes.
      const prevStatus = prev.metadata_json?.approval_status || "review";
      const nextStatus = nextMeta.approval_status || prevStatus;
      if (nextStatus !== prevStatus) {
        await sb.from("asset_approval_events").insert({
          asset_id: aid,
          session_id: prev.session_id,
          user_id: userId,
          prev_status: prevStatus,
          new_status: nextStatus,
          note: typeof body.note === "string" ? body.note : null,
        });
      }
      return json({ asset: rowToAsset(updated, await signed(updated.storage_path)) });
    }

    if (assetIdMatch && method === "DELETE") {
      const aid = assetIdMatch[1];
      const sb = supabase();
      const { data: row } = await sb.from("assets").select("*").eq("user_id", userId).eq("id", aid).maybeSingle();
      if (row?.storage_path) {
        try { await sb.storage.from("studio-images").remove([row.storage_path]); } catch (_) { /* ignore */ }
      }
      const { error } = await sb.from("assets").delete().eq("user_id", userId).eq("id", aid);
      if (error) throw error;
      return json({ asset: row ? rowToAsset(row) : null });
    }

    const approvalHistoryMatch = path.match(/^\/sessions\/([^/]+)\/approval-history$/);
    if (approvalHistoryMatch && method === "GET") {
      const sid = approvalHistoryMatch[1];
      const { data } = await supabase()
        .from("asset_approval_events")
        .select("*")
        .eq("user_id", userId)
        .eq("session_id", sid)
        .order("created_at", { ascending: false })
        .limit(500);
      return json({ events: data || [] });
    }



    if (path === "/brand-kit" && (method === "GET" || method === "PATCH")) {
      const sb = supabase();
      if (method === "GET") {
        const { data } = await sb.from("brand_kits").select("*").eq("user_id", userId).maybeSingle();
        const brandKit = data
          ? {
              style_guidance: data.style_guidance,
              negative_prompt: data.negative_prompt,
              reference_notes: data.reference_notes,
              updated_at: data.updated_at,
              sync_status: "cloud",
            }
          : { style_guidance: "", negative_prompt: "", reference_notes: "", sync_status: "cloud" };
        return json({ brandKit, filePath: "cloud:brand_kits" });
      }
      const body = await readJson(req);
      const payload = {
        user_id: userId,
        style_guidance: String(body.style_guidance ?? ""),
        negative_prompt: String(body.negative_prompt ?? ""),
        reference_notes: String(body.reference_notes ?? ""),
      };
      const { data, error } = await sb
        .from("brand_kits")
        .upsert(payload, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return json({
        brandKit: {
          style_guidance: data.style_guidance,
          negative_prompt: data.negative_prompt,
          reference_notes: data.reference_notes,
          updated_at: data.updated_at,
          sync_status: "cloud",
        },
        filePath: "cloud:brand_kits",
      });
    }

    if (path === "/inference/turn" && method === "POST") {
      const body = await readJson(req);
      const result = await handleInference(body, userId);
      return json(result);
    }

    if (path === "/inference/status" && method === "POST") {
      const body = await readJson(req);
      const result = await handleTurnStatus(body, userId);
      return json(result);
    }

    if (path === "/prompt-remix" && method === "POST") {
      const body = await readJson(req);
      return json(await handleRemix(body));
    }

    if (path === "/improve-preset" && method === "POST") {
      const body = await readJson(req) as { prompt?: string; label?: string; description?: string };
      const raw = String(body?.prompt || "").trim();
      if (!raw) return json({ error: { code: "invalid", message: "prompt is required" } }, 400);
      const label = String(body?.label || "").trim();
      const description = String(body?.description || "").trim();
      const system = [
        "You are a senior prompt engineer specialized in text-to-image models (Nano Banana / Gemini 3 Pro Image, Reve, Seedream, GPT-image-2).",
        "You rewrite prompt PRESETS that will later be appended to a user's brief for product/lifestyle image generation for Frank Body (body-care brand: coffee scrubs, glossy skin, warm editorial realism, cheeky director-ready tone).",
        "Craft the preset so it consistently produces high-quality, on-brand imagery when appended to any product brief.",
        "Techniques to apply where relevant:",
        "- Structure: subject → composition/framing → lighting → lens/camera → surface/materials → mood → post-processing → negative cues.",
        "- Be specific and visual (concrete nouns, materials, textures, color temperature in Kelvin or descriptive terms, lens mm, aperture, angle).",
        "- Prefer positive directives over negations; keep a short 'avoid:' list only if truly needed.",
        "- Do NOT hard-code aspect ratio, resolution, seed, or model — those are set elsewhere.",
        "- Use placeholders like [PRODUCT NAME] when the preset should adapt to different products.",
        "- Keep it reusable: describe style/setup, not a single specific product unless the preset name demands it.",
        "- Length: 60–180 words. No preamble, no bullet dashes, no markdown headers — output plain prose the model can read as a single directive block.",
        "Return ONLY the improved preset prompt text. No explanations, no quotes, no labels.",
      ].join("\n");
      const userMsg = [
        label ? `Preset label: ${label}` : "",
        description ? `Preset purpose: ${description}` : "",
        "Current preset prompt to improve:",
        raw,
      ].filter(Boolean).join("\n\n");
      try {
        const improved = await lovableChat([
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ], "openai/gpt-5.5");
        const cleaned = String(improved || "").trim().replace(/^["'`]+|["'`]+$/g, "");
        if (!cleaned) return json({ error: { code: "empty", message: "AI returned no content" } }, 502);
        return json({ prompt: cleaned });
      } catch (err) {
        return json({ error: { code: "ai_error", message: errMessage(err) } }, 502);
      }
    }

    if (path === "/prompt-agent/config" && method === "GET") {
      const cfg = await loadPromptAgentConfig(supabase());
      return json({
        config: {
          persona: cfg.persona,
          craftMethod: cfg.craftMethod,
          conversationProtocol: cfg.conversationProtocol,
          blueprint: cfg.blueprint,
          rules: cfg.rules,
          skills: cfg.skills,
          updatedAt: cfg.updatedAt,
        },
        defaults: {
          persona: DEFAULT_CONFIG.persona,
          craftMethod: DEFAULT_CONFIG.craftMethod,
          conversationProtocol: DEFAULT_CONFIG.conversationProtocol,
          blueprint: DEFAULT_CONFIG.blueprint,
          rules: DEFAULT_CONFIG.rules,
          skills: DEFAULT_CONFIG.skills,
        },
      });

    }

    if (path === "/prompt-agent/config" && method === "PUT") {
      const isAdmin = await supabase().rpc("has_role", { _user_id: userId, _role: "admin" });
      if (isAdmin.error || isAdmin.data !== true) {
        return json({ error: { code: "forbidden", message: "Admin role required" } }, 403);
      }
      const body = await readJson(req) as {
        persona?: string; craftMethod?: string; conversationProtocol?: string; blueprint?: string; rules?: string;
        skills?: { key?: string; label?: string; hint?: string; instruction?: string; sort_order?: number; is_active?: boolean }[];
      };
      const up = await supabase().from("prompt_agent_config").upsert({
        id: 1,
        persona: String(body.persona ?? "").trim(),
        craft_method: String(body.craftMethod ?? "").trim(),
        conversation_protocol: String(body.conversationProtocol ?? "").trim(),
        blueprint: String(body.blueprint ?? "").trim(),
        rules: String(body.rules ?? "").trim(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (up.error) return json({ error: { code: "save_failed", message: up.error.message } }, 400);

      if (Array.isArray(body.skills)) {
        const rows = body.skills
          .filter((s) => s && String(s.key ?? "").trim())
          .map((s, i) => ({
            key: String(s.key).trim(),
            label: String(s.label ?? "").trim() || String(s.key).trim(),
            hint: String(s.hint ?? "").trim(),
            instruction: String(s.instruction ?? "").trim(),
            sort_order: typeof s.sort_order === "number" ? s.sort_order : i,
            is_active: s.is_active !== false,
          }));
        const keys = rows.map((r) => r.key);
        if (rows.length) {
          const ups = await supabase().from("prompt_agent_skills").upsert(rows, { onConflict: "key" });
          if (ups.error) return json({ error: { code: "save_failed", message: ups.error.message } }, 400);
        }
        const existing = await supabase().from("prompt_agent_skills").select("key");
        const stale = (existing.data || []).map((r: any) => String(r.key)).filter((k: string) => !keys.includes(k));
        if (stale.length) await supabase().from("prompt_agent_skills").delete().in("key", stale);
      }

      const cfg = await loadPromptAgentConfig(supabase());
      return json({ config: cfg });
    }

    if (path === "/prompt-agent" && method === "POST") {

      const body = await readJson(req) as { messages?: { role?: string; content?: string; images?: string[] }[]; skill?: string };
      const incoming = Array.isArray(body?.messages) ? body.messages : [];
      const history = incoming
        .filter((m) => m && (typeof m.content === "string" && m.content.trim() || Array.isArray(m.images) && m.images.length))
        .slice(-20)
        .map((m) => {
          const role = m.role === "assistant" ? "assistant" : "user";
          const text = String(m.content ?? "").trim();
          const images = (Array.isArray(m.images) ? m.images : [])
            .filter((u) => typeof u === "string" && /^(https?:|data:image\/)/.test(u))
            .slice(0, 6);
          if (role === "user" && images.length) {
            return {
              role,
              content: [
                { type: "text", text: text || "Use these reference images as visual context for the prompt." },
                ...images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            };
          }
          return { role, content: text };
        });
      if (!history.length) return json({ error: { code: "invalid", message: "messages are required" } }, 400);


      const skill = String(body?.skill || "brief-to-prompt");
      const cfg = await loadPromptAgentConfig(supabase());
      const system = buildPromptAgentSystem(cfg, skill);


      try {
        const reply = await lovableChat(
          [{ role: "system", content: system }, ...history],
          "openai/gpt-5.6-sol",
        );
        const cleaned = String(reply || "").trim();
        if (!cleaned) return json({ error: { code: "empty", message: "AI returned no content" } }, 502);
        return json({ reply: cleaned, model: "openai/gpt-5.6-sol", skill });
      } catch (err) {
        return json({ error: { code: "ai_error", message: errMessage(err) } }, 502);
      }
    }



    if (path === "/videos" && method === "POST") {
      const body = await readJson(req);
      const result = await handleVideo(body, userId);
      return json(result, result.status === "blocked" ? 200 : 200);
    }

    if (path === "/enhance" && method === "POST") {
      const body = await readJson(req);
      const result = await handleEnhance(body, userId);
      return json(result, 200);
    }


    // ---- Exports / handoff / review board ----
    const exportMatch = path.match(/^\/exports\/([^/]+)\/download$/);
    if (exportMatch && method === "GET") {
      const assetId = exportMatch[1];
      const { data: row, error } = await supabase().from("assets").select("*").eq("id", assetId).eq("user_id", userId).maybeSingle();
      if (error || !row) return json({ error: { code: "not_found", message: "Export not found" } }, 404);
      const url = await signed(row.storage_path);
      if (url) return Response.redirect(url, 302);
      return json({ error: { code: "not_found", message: "Asset storage missing" } }, 404);
    }
    if (path === "/exports" && method === "GET") {
      const sid = url.searchParams.get("session_id");
      const q = supabase().from("assets").select("*").eq("user_id", userId).eq("asset_type", "output").order("created_at", { ascending: false });
      const { data } = sid ? await q.eq("session_id", sid) : await q;
      const items = (data || []).map((r: any) => ({
        id: r.id, asset_id: r.id, preset: "default",
        file_path: r.storage_path, metadata_json: JSON.stringify(r.metadata_json || {}),
        sync_status: "cloud", created_at: r.created_at,
      }));
      return json({ exports: items });
    }
    if (path === "/exports" && method === "POST") {
      const body = await readJson(req);
      const assetId = body.asset_id;
      const { data: row, error } = await supabase().from("assets").select("*").eq("id", assetId).eq("user_id", userId).maybeSingle();
      if (error || !row) return json({ error: { code: "not_found", message: "Asset not found" } }, 404);
      const dl = await signed(row.storage_path);
      const record = {
        id: row.id, asset_id: row.id, preset: body.preset || "default",
        file_path: row.storage_path, download_url: dl || undefined,
        metadata_json: JSON.stringify({ preset: body.preset || "default", ...(body.metadata || {}) }),
        sync_status: "cloud", created_at: nowIso(),
      };
      return json({ export: record, download_url: dl, metadata: { preset: body.preset || "default" } });
    }
    const exportSetMatch = path.match(/^\/assets\/([^/]+)\/export-set$/);
    if (exportSetMatch && method === "POST") {
      const assetId = exportSetMatch[1];
      const { data: row, error } = await supabase().from("assets").select("*").eq("id", assetId).eq("user_id", userId).maybeSingle();
      if (error || !row) return json({ error: { code: "not_found", message: "Asset not found" } }, 404);
      const dl = await signed(row.storage_path);
      const presets = ["instagram_square", "instagram_story", "web_hero"];
      return json({
        exports: presets.map((p) => ({
          id: `${row.id}-${p}`, asset_id: row.id, preset: p,
          file_path: row.storage_path, download_url: dl || undefined,
          metadata_json: JSON.stringify({ preset: p }),
          sync_status: "cloud", created_at: nowIso(),
        })),
        download_urls: Object.fromEntries(presets.map((p) => [p, dl])),
      });
    }
    const reviewMatch = path.match(/^\/sessions\/([^/]+)\/review-board$/);
    if (reviewMatch && method === "GET") {
      const sid = reviewMatch[1];
      const { data } = await supabase().from("assets").select("*")
        .eq("user_id", userId).eq("session_id", sid).order("created_at", { ascending: false });
      const items = await Promise.all((data || []).map(async (r: any) => rowToAsset(r, await signed(r.storage_path))));
      return json({ board: { session_id: sid, generated_at: nowIso(), assets: items, approved: items.filter((a: any) => a.approval_status === "approved") } });
    }
    const syncMatch = path.match(/^\/sessions\/([^/]+)\/sync-manifest$/);
    if (syncMatch && method === "GET") {
      const sid = syncMatch[1];
      const { data } = await supabase().from("assets").select("id,storage_path,created_at,asset_type")
        .eq("user_id", userId).eq("session_id", sid);
      return json({ manifest: { session_id: sid, generated_at: nowIso(), assets: data || [] } });
    }
    const handoffMatch = path.match(/^\/sessions\/([^/]+)\/handoff$/);
    const handoffResumeMatch = path.match(/^\/sessions\/([^/]+)\/handoff\/resume$/);
    if ((handoffMatch || handoffResumeMatch) && method === "POST") {
      const sid = (handoffMatch || handoffResumeMatch)![1];
      const body = await readJson(req).catch(() => ({} as any));
      const wantsStream = (req.headers.get("accept") || "").includes("text/event-stream");
      const fromStage: string | undefined = handoffResumeMatch ? body.from_stage : undefined;
      const snapshotIn: any = handoffResumeMatch ? (body.snapshot || {}) : {};

      const STAGES = ["fetch", "build_manifest", "generate_json", "generate_csv", "validate"];
      const shouldRun = (stage: string) => !fromStage || STAGES.indexOf(stage) >= STAGES.indexOf(fromStage);

      const runPipeline = async (
        emit?: (step: string, progress: number, message: string, payload?: any) => Promise<void>,
      ) => {
        let assets: any[] = snapshotIn.assets || [];
        let sessionRow: any = snapshotIn.sessionRow || null;
        let turnRows: any[] = snapshotIn.turnRows || [];
        let structured: any = snapshotIn.structured || null;
        let csvRows: string = snapshotIn.csv || "";
        let lastOk = "fetch";
        const snap = () => ({ assets, sessionRow, turnRows, structured, csv: csvRows });

        try {
          if (shouldRun("fetch")) {
            await emit?.("fetch", 0.05, "Loading session data…");
            const [sRes, tRes, aRes] = await Promise.all([
              supabase().from("sessions").select("*").eq("id", sid).eq("user_id", userId).maybeSingle(),
              supabase().from("messages").select("*").eq("user_id", userId).eq("session_id", sid).order("seq", { ascending: true }),
              supabase().from("assets").select("*").eq("user_id", userId).eq("session_id", sid).order("created_at", { ascending: true }),
            ]);
            sessionRow = sRes.data || null;
            turnRows = (tRes.data || []) as any[];
            const rows = (aRes.data || []) as any[];
            assets = await Promise.all(rows.map(async (r: any) => rowToAsset(r, await signed(r.storage_path))));
            lastOk = "fetch";
          }

          if (shouldRun("build_manifest")) {
            await emit?.("build_manifest", 0.3, `Building manifest for ${assets.length} assets…`);
            structured = buildManifest(sid, sessionRow, turnRows as any, assets as any, body.summary || "", nowIso());
            lastOk = "build_manifest";
          }

          if (shouldRun("generate_json")) {
            await emit?.("generate_json", 0.55, "Serializing JSON payload…");
            lastOk = "generate_json";
          }

          if (shouldRun("generate_csv")) {
            await emit?.("generate_csv", 0.75, "Generating CSV export…");
            csvRows = manifestToCsv(structured);
            lastOk = "generate_csv";
          }

          const schemaIssues = validateManifest(structured);
          if (schemaIssues.length) {
            await emit?.("validate", 0.9, `Schema validation failed (${schemaIssues.length} issue${schemaIssues.length > 1 ? "s" : ""})`, {
              issues: schemaIssues, resumable_from: "build_manifest", snapshot: snap(),
            });
            const errPayload = {
              stage: "validate",
              issues: schemaIssues,
              resumable_from: "build_manifest",
              snapshot: snap(),
              schema_issues: schemaIssues,
              handoff_json: structured,
              handoff_csv: csvRows,
            };
            await emit?.("error", 1, `Manifest schema invalid: ${schemaIssues.slice(0, 3).join("; ")}`, errPayload);
            const record = {
              id: `handoff-${sid}-${Date.now()}`, asset_id: sid, preset: "handoff",
              file_path: `cloud:handoff/${sid}`,
              metadata_json: JSON.stringify({ schema_valid: false, schema_issues: schemaIssues }),
              sync_status: "cloud", created_at: nowIso(),
            };
            return {
              handoff: record, download_url: null,
              metadata: {
                schema: "frank-create.handoff", schema_version: 1,
                schema_valid: false, schema_issues: schemaIssues,
                resumable_from: "build_manifest",
                snapshot: snap(),
                handoff_json: structured, handoff_csv: csvRows,
              },
            };
          }

          await emit?.("validate", 0.95, "Validated handoff schema.");
          lastOk = "validate";

          const record = {
            id: `handoff-${sid}-${Date.now()}`, asset_id: sid, preset: "handoff",
            file_path: `cloud:handoff/${sid}`,
            metadata_json: JSON.stringify({ summary: body.summary || "", asset_count: structured.assets.length, schema_version: 1 }),
            sync_status: "cloud", created_at: structured.generated_at,
          };
          const payload = {
            handoff: record, download_url: null,
            metadata: {
              summary: body.summary || "",
              schema: "frank-create.handoff",
              schema_version: 1,
              asset_count: structured.counts.assets,
              approved_count: structured.counts.approved,
              turn_count: structured.counts.turns,
              blueprint_count: structured.counts.blueprints,
              schema_valid: true,
              schema_issues: [],
              handoff_json: structured,
              handoff_csv: csvRows,
              assets: structured.assets,
            },
          };
          await emit?.("done", 1, "Handoff ready.", payload);
          return payload;
        } catch (e: any) {
          const message = e?.message || "Handoff failed";
          await emit?.("error", 1, message, {
            stage: lastOk, resumable_from: lastOk, snapshot: snap(),
          });
          throw e;
        }
      };

      if (wantsStream) {
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const emit = async (step: string, progress: number, message: string, payload?: any) => {
              const evt = { step, progress, message, ...(payload ? { payload } : {}) };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
              await new Promise((r) => setTimeout(r, 0));
            };
            try {
              await runPipeline(emit);
            } catch { /* already emitted */ }
            finally { controller.close(); }
          },
        });
        return new Response(stream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
          },
        });
      }

      const payload = await runPipeline();
      return json(payload);
    }




    // ---- Demo receipts (minimal stubs) ----
    if (path === "/demo/reset" && method === "POST") {
      return json({ ok: true, reset_at: nowIso() });
    }
    if (path.startsWith("/demo/") && method === "POST") {
      const kind = path.slice("/demo/".length);
      const receipt = {
        title: `Frank Create ${kind} receipt`,
        generated_at: nowIso(),
        session: { user_id: userId },
        summary: {
          style_guidance_chars: 0, negative_prompt_chars: 0, reference_notes_chars: 0,
          reference_asset_count: 0, approved_asset_count: 0,
          prompt_guided_status: "ready", lora_training_status: "starter",
          prompt_guided_target: "ready", lora_training_target: "ready",
        },
        brand_kit: { style_guidance: "", negative_prompt: "", reference_notes: "", sync_status: "cloud" },
        reference_assets: [], approved_assets: [],
        training_recommendation: { status: "ready" },
        next_inputs: [],
      };
      const filename = `${kind}-${Date.now()}`;
      return json({
        receipt,
        markdown_path: `cloud:receipts/${filename}.md`,
        json_path: `cloud:receipts/${filename}.json`,
        markdown_file: `${filename}.md`,
        json_file: `${filename}.json`,
        markdown_url: "", json_url: "",
      });
    }
    return json({ error: { code: "not_found", message: `No handler for ${method} ${path}` } }, 404);
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: { code: "auth_error", message: err.message } }, err.status);
    }
    console.error("[frank-api]", err);
    return json({ error: { code: "internal_error", message: errMessage(err) } }, 500);
  }
});

