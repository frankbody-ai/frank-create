// Frank Create unified backend — Supabase Edge Function.
// Serves every /api/frank/* call the SPA makes from a single endpoint.
// Mirrors the dev-time Vite plugin at frank-create/server/frankApi.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadPromptAgentConfig, buildPromptAgentSystem, DEFAULT_CONFIG } from "./promptAgent.ts";



// Identity, entitlements and studio data all live in the AutoSolutions OS
// core. Point SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY at the core project
// and this function serves the core; the AI gateway keys stay wherever this
// function is deployed.
// CORE_* wins over the platform-injected SUPABASE_* pair. Hosts that manage
// their own backend (Lovable Cloud) reserve those names and inject their own
// project, so pointing this function at the core needs names the host will
// not overwrite. Falls back to SUPABASE_* when deployed on the core itself.
// No silent fallback: if the CORE_* secrets go missing this function would
// quietly serve the HOST's database instead, and work would vanish into the
// wrong project. Better to refuse to start.
const SUPABASE_URL = Deno.env.get("CORE_SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("CORE_SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "frank-api is missing CORE_SUPABASE_URL / CORE_SUPABASE_SERVICE_ROLE_KEY. " +
      "It will not fall back to the host project — set the secrets and redeploy.",
  );
}
// Public anon key of the same project — used to ask the OS about the caller.
const SUPABASE_ANON_KEY =
  Deno.env.get("CORE_SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
  "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const LOVABLE_BASE = "https://ai.gateway.lovable.dev/v1";
const BUCKET = "studio-images";
/** The key this product is registered under in the OS catalogue. */
const APP_KEY = "frank_create";

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

// Studio data lives in the core's `studio` schema now, so every table call
// below (messages, assets, sessions…) resolves there without being rewritten.
const supabase = () =>
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    db: { schema: "studio" },
    auth: { persistSession: false, autoRefreshToken: false },
  });

// A client acting AS the caller, used only to ask the OS whether this person
// may use Create Studio. Service role would bypass exactly the check we want.
const asCaller = (token: string) =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
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

  // Who may use this app is an OS decision, not a domain-name guess: the
  // company must own Create Studio and this person must be assigned it
  // (admins bypass). Same rule the SPA gate and the launcher use.
  const { data: entitled, error: entitlementError } = await asCaller(token)
    .rpc("is_entitled", { app_key: APP_KEY });
  if (entitlementError) throw new AuthError(503, "Could not verify entitlement with the OS core");
  if (!entitled) throw new AuthError(403, `${email} is not entitled to Create Studio in this workspace`);

  USER_CACHE.set(token, { id: data.user.id, email, exp: now + 60_000 });
  return data.user.id;
}

async function signed(path: string): Promise<string> {
  if (!path) return "";
  const { data } = await supabase().storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
  return data?.signedUrl ?? "";
}

// The storage backend caps objects at 50 MB; stay just under it. Anything larger
// (long 4K video, big upscales) still has a usable provider URL, so we keep the
// asset row and fall back to that temporary URL instead of failing the whole run.
const MAX_STORAGE_BYTES = 45 * 1024 * 1024;


function isStorageSizeError(message: string): boolean {
  const m = (message || "").toLowerCase();
  return m.includes("exceeds the maximum allowed size") ||
    m.includes("maximum allowed size") ||
    m.includes("payload too large") ||
    m.includes("entity too large") ||
    m.includes("413");
}

type StoredResult = {
  /** Metadata to merge into the asset row. */
  meta: Record<string, unknown>;
  /** True when the bytes are permanently stored. */
  stored: boolean;
};

/**
 * Upload bytes to storage, or fall back to the provider's temporary URL when
 * the file is over the storage size cap. Throws only when neither works.
 */
async function storeOrFallback(args: {
  storagePath: string;
  bytes: Uint8Array;
  mime: string;
  /** Temporary provider URL used when the bytes cannot be stored. */
  remoteUrl?: string;
}): Promise<StoredResult> {
  const sb = supabase();
  const remote = (args.remoteUrl || "").startsWith("http") ? args.remoteUrl! : "";
  const tooBig = args.bytes.byteLength > MAX_STORAGE_BYTES;

  if (!tooBig) {
    const up = await sb.storage.from(BUCKET).upload(args.storagePath, args.bytes, {
      contentType: args.mime, upsert: false,
    });
    if (!up.error) return { meta: {}, stored: true };
    const message = up.error.message || "Upload failed";
    if (!isStorageSizeError(message) || !remote) throw up.error;
    return {
      stored: false,
      meta: {
        storage_missing: true,
        storage_skip_reason: message,
        remote_url: remote,
        remote_url_expires: true,
      },
    };
  }

  if (!remote) {
    throw new Error(
      `File is ${(args.bytes.byteLength / 1048576).toFixed(1)} MB, over the 20 MB storage limit, and the provider gave no temporary URL.`,
    );
  }
  return {
    stored: false,
    meta: {
      storage_missing: true,
      storage_skip_reason: `File is ${(args.bytes.byteLength / 1048576).toFixed(1)} MB, over the 20 MB storage limit.`,
      remote_url: remote,
      remote_url_expires: true,
    },
  };
}

const DEFAULT_MODEL = {
  id: "google-nb-pro",
  label: "Gemini 3 Pro Image / Nano Banana Pro",
  short_label: "Nano Banana Pro",
  provider: "openrouter",
  provider_model: "google/gemini-3-pro-image",
  status: "ready" as const,
  badge: "4K",
  max_resolution_label: "4K",
  description: "Nano Banana Pro (Gemini 3 Pro Image) via OpenRouter — 1K / 2K / 4K, wide aspect enum, up to 14 reference images.",
  capabilities: { generation: true, edit: true, masked_edit: false, video: false },
  allowed_aspect_ratios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
  allowed_image_sizes: ["1K", "2K", "4K"],
  reference_image_limit: 14,
  max_count: 4,
  cost_label: "premium",
  configured: true,
  missing_env_vars: [],
};

const STUDIO_CONFIG = {
  tasks: [
    { key: "generate", label: "Generate", description: "Create a new image from a prompt.", providers: ["openrouter"] },
    { key: "edit", label: "Edit", description: "Edit an existing image.", providers: ["openrouter"] },
  ],
  providers: [
    { key: "openrouter", label: "OpenRouter", type: "api", status: "ready" },
    { key: "replicate", label: "Replicate", type: "api", status: "curated" },
  ],
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
    active_engine: "openrouter",
    diffusion_ready: true,
    checkpoint_count: 0,
    checkpoints: [],
    note: "OpenRouter is the primary media provider; Replicate is used only as a fallback or for the upscaler.",
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
  // Oversized files were never stored, so the signed URL would 404 — serve the
  // provider's temporary URL instead.
  const url = meta.storage_missing && meta.remote_url ? String(meta.remote_url) : signedUrl;
  return {
    id: row.id,
    session_id: row.session_id,
    turn_id: row.message_id ?? undefined,
    kind: row.asset_type || "output",
    title: meta.title || "Generated image",
    media_type: meta.media_type || "image",
    provider: meta.provider || "lovable",
    model: row.model_key || undefined,
    prompt: row.prompt_snapshot || undefined,
    file_path: row.storage_path,
    preview_url: url,
    remote_url: url,
    storage_missing: !!meta.storage_missing,
    temporary_url: !!meta.storage_missing,
    width: meta.width,
    height: meta.height,
    aspect_ratio: meta.aspect_ratio ?? undefined,
    bytes: meta.bytes ?? undefined,


    favorite: !!meta.favorite,
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
    provider: settings.provider || "lovable",
    model: settings.model || "google-nb-pro",
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
    // Sanitised copy of the exact body we posted to the provider (JSON chip).
    provider_request_json: settings.provider_request ? JSON.stringify(settings.provider_request) : null,

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
    status: row.status ?? "active",
    summary: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

class LovableChatError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Lovable chat ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
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
  if (!r.ok) throw new LovableChatError(r.status, (await r.text()).slice(0, 600));
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
  "seedream-5-pro": "bytedance-seed/seedream-5-0-pro",
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
  "bytedance-seed/seedream-5-0-pro",
  "bytedance-seed/seedream-4.5",

  "qwen/qwen-image-3-pro",
]);

const REPLICATE_MAP: Record<string, string> = {
  // Image models all run on OpenRouter now; kept empty so the fallback branch
  // stays wired for any future Replicate-only image model.
};

// Safety net: when OpenRouter itself is the problem (5xx, rate limit, credits,
// network) we re-run the same brief on Replicate for the models that exist on
// both providers, so the round still returns images instead of failing.
const REPLICATE_IMAGE_FALLBACK: Record<string, string> = {
  "google-nb-pro": "google/nano-banana-pro",
  "nano-banana-pro": "google/nano-banana-pro",
  "google-nb-2": "google/nano-banana-2",
  "nano-banana-2": "google/nano-banana-2",
  "openai-gpt-image-2": "openai/gpt-image-2",
  "seedream-5-pro": "bytedance/seedream-5-pro",
  "riverflow-2-5-pro": "sourceful/riverflow-2.0-pro",
};

// Provider-side faults are worth retrying elsewhere. Bad params or blocked
// content would fail on Replicate too, so those stay hard failures.
const FALLBACK_ERROR_CODES = new Set([
  "provider_unavailable",
  "provider_error",
  "rate_limited",
  "quota_exhausted",
  "network_error",
  "timeout",
  "auth_failed",
  "empty_output",
  "model_error",
]);

function shouldFallbackToReplicate(err: unknown): boolean {
  const mapped = mapReplicateError(err);
  return FALLBACK_ERROR_CODES.has(mapped.code);
}



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
    minDuration: 4, maxDuration: 15, defaultDuration: 5,
  },
  "seedance-2-5": {
    model: "bytedance/seedance-2.5",
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    aspects: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"],
    defaultAspect: "16:9",
    minDuration: 4, maxDuration: 30, defaultDuration: 5,
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
    minDuration: 2, maxDuration: 10, defaultDuration: 5,
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

  let submitted: { pollUrl: string; request: unknown };
  let clampedSettings: { aspectRatio?: string; resolution?: string; duration?: number } = {};
  try {
    const videoProviderPrompt = typeof body.provider_prompt === "string" && body.provider_prompt.trim()
      ? body.provider_prompt.trim()
      : prompt;
    const clamped = clampVideoSettings(caps, {
      aspect_ratio: reqSettings.aspect_ratio,
      duration: Number(reqSettings.duration ?? 5),
      resolution: reqSettings.video_resolution || reqSettings.image_size,
    });
    clampedSettings = clamped;
    submitted = await submitOpenrouterVideo(videoProviderPrompt, {
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

  // The clip renders out of band; the client polls /inference/status, which
  // resumes this job from the stored polling URL.
  const runningSnapshot = {
    ...settingsSnapshot,
    status: "running",
    requested_count: 1,
    video_poll_url: submitted.pollUrl,
    video_started_at: nowIso(),
    video_resolution: clampedSettings.resolution ?? null,
    video_duration: clampedSettings.duration ?? null,
    provider_request: submitted.request,
    provider: "openrouter",
    provider_model: slug,
  };
  await sb.from("messages").update({ settings_snapshot_json: runningSnapshot }).eq("id", turnId);

  return {
    turn: rowToTurn({
      id: turnId, session_id: sessionId, role: "user", message_type: "video",
      prompt_text: prompt, settings_snapshot_json: runningSnapshot, seq: nextSeq, created_at: nowIso(),
    }),
    status: "running" as const,
    assets: [],
    providerPayload: { provider: "openrouter", model: slug },
  };
}

// Store a finished clip and attach it to its run. Shared by the video status
// resume path so every video asset row looks the same.
async function storeVideoAsset(opts: {
  userId: string;
  sessionId: string;
  turnId: string;
  prompt: string;
  modelId: string;
  slug: string;
  videoUrl: string;
  settings: any;
  size?: { width?: number; height?: number };
}): Promise<{ assetId: string; storagePath: string; error?: { code: string; message: string } }> {
  const sb = supabase();
  const res = await downloadProviderMedia(opts.videoUrl);
  if (!res.ok) {
    return { assetId: "", storagePath: "", error: { code: "download_failed", message: `Could not download the clip (${res.status}).` } };
  }
  const mime = (res.headers.get("content-type") || "video/mp4").split(";")[0];
  const bytes = new Uint8Array(await res.arrayBuffer());
  const assetId = crypto.randomUUID();
  const storagePath = `${opts.sessionId}/${assetId}.mp4`;
  let stored: StoredResult;
  try {
    stored = await storeOrFallback({ storagePath, bytes, mime, remoteUrl: opts.videoUrl });
  } catch (err) {
    return { assetId: "", storagePath: "", error: { code: "storage_failed", message: err instanceof Error ? err.message : String(err) } };
  }

  const assetIns = await sb.from("assets").insert({
    id: assetId,
    user_id: opts.userId,
    session_id: opts.sessionId,
    message_id: opts.turnId,
    storage_path: stored.stored ? storagePath : "",
    asset_type: "generated",
    prompt_snapshot: opts.prompt,
    model_key: opts.modelId,
    metadata_json: {
      media_type: "video",
      mime,
      title: opts.prompt.slice(0, 80) || "Generated clip",
      aspect_ratio: opts.settings?.aspect_ratio,
      duration: opts.settings?.duration ?? null,
      resolution: opts.settings?.video_resolution ?? null,
      bytes: bytes.byteLength,
      provider: "openrouter",
      provider_model: opts.slug,
      ...(opts.size?.width && opts.size?.height ? { width: opts.size.width, height: opts.size.height } : {}),
      ...stored.meta,
    },
  }).select().single();
  if (assetIns.error) {
    return { assetId: "", storagePath: "", error: { code: "db_failed", message: assetIns.error.message } };
  }
  return { assetId, storagePath };
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
  // The client sends a usable URL alongside the id. Library picks (previous runs)
  // can have no stored object — provider-URL-only outputs, or rows the client
  // holds locally — so the URL is a first-class fallback, not an error.
  const requestedSourceUrl: string = typeof body.source_url === "string" ? body.source_url.trim() : "";
  let sourceUrl = "";
  let sourceTitle = "";
  if (sourceAssetId) {
    const { data: row } = await sb.from("assets").select("id,storage_path,metadata_json")
      .eq("user_id", userId).eq("id", sourceAssetId).maybeSingle();
    if (!row && !requestedSourceUrl) {
      return {
        turn: null, status: "failed" as const,
        error: { code: "not_found", message: "The selected source asset is missing." },
      };
    }
    if (row) {
      const meta = ((row as any).metadata_json || {}) as Record<string, unknown>;
      sourceUrl = await signed((row as any).storage_path);
      if (!sourceUrl && typeof meta.remote_url === "string") sourceUrl = String(meta.remote_url).trim();
      sourceTitle = (meta.title as string) || "";
    }
  }
  if (!sourceUrl) sourceUrl = requestedSourceUrl;
  if (!sourceUrl || !/^https?:\/\//i.test(sourceUrl)) {
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
  let stored: StoredResult;
  try {
    stored = await storeOrFallback({ storagePath, bytes, mime, remoteUrl: outputUrl });
  } catch (err) {
    return await failTurn("storage_failed", err instanceof Error ? err.message : String(err));
  }

  const assetIns = await sb.from("assets").insert({
    id: assetId,
    user_id: userId,
    session_id: sessionId,
    message_id: turnId,
    storage_path: stored.stored ? storagePath : "",
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
      bytes: bytes.byteLength,
      ...(media === "image" ? (imageDimensions(bytes, mime) ?? {}) : {}),
      ...stored.meta,
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

// OpenRouter's `unsigned_urls` point at openrouter.ai and require the API key,
// so a plain fetch of a finished clip comes back 401. Retry authenticated.
async function downloadProviderMedia(url: string): Promise<Response> {
  const res = await fetch(url);
  if (res.ok || !/^https:\/\/([a-z0-9-]+\.)*openrouter\.ai\//i.test(url)) return res;
  if (res.status !== 401 && res.status !== 403) return res;
  try {
    const key = openrouterKey();
    return await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  } catch {
    return res;
  }
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
  if (status === 400 || status === 404 || status === 422) {
    // "No provider for X" / "no endpoints found" is a routing outage on
    // OpenRouter's side, not a bad payload — it must fall back to Replicate.
    if (/no provider|no endpoints|no allowed providers|not available/i.test(msg)) {
      return new ProviderRunError(`OpenRouter has no provider for this model right now: ${msg}`, "provider_unavailable", true, status, text);
    }
    return new ProviderRunError(`Invalid request: ${msg}`, "invalid_params", false, status, text);
  }

  if (status >= 500) return new ProviderRunError(`OpenRouter is busy (${status}). Try again in a moment.`, "provider_unavailable", true, status, text);
  return new ProviderRunError(`OpenRouter error ${status}: ${msg}`, "provider_error", false, status, text);
}

// POST with retry/backoff on transient statuses. Returns the parsed JSON body.
async function openrouterPost(path: string, payload: Record<string, unknown>): Promise<any> {
  const key = openrouterKey();
  let lastErr: unknown;
  // One delayed retry is enough inside an interactive request. Five attempts
  // can consume the entire worker budget before fallback/error persistence runs.
  const maxAttempts = 2;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${OPENROUTER_BASE}${path}`, {
        method: "POST",
        headers: openrouterHeaders(key),
        body: JSON.stringify(payload),
      });
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts - 1) throw new ProviderRunError(`OpenRouter network error: ${errMessage(err)}`, "provider_unavailable", true);
      await new Promise((r) => setTimeout(r, 1_000 * (2 ** attempt) + Math.floor(Math.random() * 500)));
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
    if (mapped.retryable && attempt < maxAttempts - 1) {
      console.warn("[frank-api] openrouter:transient", { path, status: res.status, body: text.slice(0, 300) });
      lastErr = mapped;
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1_000
        : 1_500 * (2 ** attempt) + Math.floor(Math.random() * 750);
      await new Promise((r) => setTimeout(r, delay));
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

// ---- Troubleshooting: the exact request body we sent to the provider --------
// Stored on the turn so the UI can show it behind a "JSON" chip. Credential-ish
// keys are stripped and inline data URLs are collapsed to short descriptors so
// the record stays readable and small.
function describeInlineImage(url: string, index: number): string {
  const m = /^data:([^;,]+);base64,(.*)$/i.exec(url);
  if (!m) return `ref${index + 1}: ${url.slice(0, 120)}`;
  const bytes = Math.floor((m[2]?.length ?? 0) * 0.75);
  const kb = bytes >= 1024 ? `${Math.round(bytes / 1024)} KB` : `${bytes} B`;
  return `ref${index + 1}: ${m[1]}, ${kb}`;
}

function redactProviderPayload(value: unknown, key = ""): unknown {
  if (/api[_-]?key|token|secret|authorization|bearer|password|credential/i.test(key)) {
    return "[redacted]";
  }
  if (typeof value === "string") {
    return value.startsWith("data:") ? describeInlineImage(value, 0) : value;
  }
  if (Array.isArray(value)) {
    if (key === "input_references" || key === "frame_images" || key === "reference_images") {
      return value.map((item, i) => {
        const url = typeof item === "string"
          ? item
          : String((item as any)?.image_url?.url ?? (item as any)?.url ?? "");
        const label = describeInlineImage(url, i);
        const frameType = typeof item === "object" && item ? (item as any).frame_type : undefined;
        return frameType ? `${label} (${frameType})` : label;
      });
    }
    return value.map((item) => redactProviderPayload(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redactProviderPayload(v, k)]),
    );
  }
  return value;
}

function providerRequestRecord(endpoint: string, payload: Record<string, unknown>) {
  return { endpoint, sent_at: nowIso(), body: redactProviderPayload(payload) };
}

// ---- Real pixel dimensions, read out of the returned file's header ----------
function imageDimensions(bytes: Uint8Array, mime = ""): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: 8-byte signature, then IHDR with width/height as big-endian uint32.
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // GIF
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  // JPEG: walk the markers to the first SOFn frame header.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = view.getUint16(offset + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf
        && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + length;
    }
    return null;
  }
  // WebP: RIFF container with VP8 / VP8L / VP8X chunks.
  if (
    bytes.length > 30 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8 ") {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { width: w, height: h };
    }
  }
  return mime ? null : null;
}


// Dedicated image endpoint. `n` is honoured natively where the model supports it.
async function openrouterImage(
  prompt: string,
  referenceImageUrls: string[] = [],
  opts: { model: string; aspectRatio?: string; size?: string; quality?: string; n?: number; onRequest?: (record: unknown) => void } = { model: "google/gemini-3.1-flash-image" },
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

  opts.onRequest?.(providerRequestRecord("POST https://openrouter.ai/api/v1/images", payload));
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

// Async video job — submit only. A video render routinely outlives a single
// serverless request, so the caller stores the polling URL on the run and the
// /inference/status route resumes it (same shape as the image fan-out).
type VideoSubmitOpts = {
  model: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceUrls?: string[];
  generateAudio?: boolean;
};

async function submitOpenrouterVideo(
  prompt: string,
  opts: VideoSubmitOpts,
): Promise<{ pollUrl: string; request: unknown }> {
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

  const request = providerRequestRecord("POST https://openrouter.ai/api/v1/videos", payload);
  const job = await openrouterPost("/videos", payload);
  const jobId: string | undefined = job?.id;
  const pollUrl: string = job?.polling_url || (jobId ? `${OPENROUTER_BASE}/videos/${jobId}` : "");
  if (!pollUrl) {
    throw new ProviderRunError(`OpenRouter did not return a video job id. ${JSON.stringify(job).slice(0, 300)}`, "provider_error", true);
  }
  return { pollUrl, request };
}

// One read of a submitted video job. "pending" means keep polling later.
async function pollOpenrouterVideoOnce(pollUrl: string): Promise<
  | { state: "pending" }
  | { state: "completed"; url: string; width?: number; height?: number }
  | { state: "failed"; message: string }
> {
  const key = openrouterKey();
  let res: Response;
  try {
    res = await fetch(pollUrl, { headers: openrouterHeaders(key) });
  } catch {
    return { state: "pending" }; // transient poll failure — try again next tick
  }
  if (!res.ok) {
    if (res.status >= 500 || res.status === 429) return { state: "pending" };
    const mapped = mapOpenrouterHttpError(res.status, await res.text());
    return { state: "failed", message: mapped instanceof Error ? mapped.message : String(mapped) };
  }
  const status: any = await res.json();
  const state = String(status?.status || "").toLowerCase();
  if (state === "completed" || state === "succeeded") {
    // Signed URLs are publicly fetchable; `unsigned_urls` are OpenRouter-hosted
    // and need the API key on the download request (see downloadProviderMedia).
    const url: string | undefined = status?.signed_urls?.[0] || status?.urls?.[0]
      || status?.output?.[0] || status?.unsigned_urls?.[0];
    if (!url) return { state: "failed", message: "The video job completed without a downloadable clip." };
    const w = Number(status?.width ?? status?.metadata?.width ?? status?.video?.width);
    const h = Number(status?.height ?? status?.metadata?.height ?? status?.video?.height);
    const size = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? { width: w, height: h } : {};
    return { state: "completed", url, ...size };
  }
  if (state === "failed" || state === "canceled" || state === "cancelled") {
    const msg = status?.error?.message || status?.error || "The video model failed to render this clip.";
    return { state: "failed", message: String(msg).slice(0, 400) };
  }
  return { state: "pending" };
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

async function handleInference(body: any, userId: string, shard?: { turnId: string; index: number }) {
  const sb = supabase();
  let sessionId: string = body.session_id;
  if (!sessionId) sessionId = (await getOrCreateDefaultSession(userId)).id;

  const prompt: string = body.prompt || "";
  if (!prompt.trim()) throw new Error("Prompt is required");

  const turnId = shard?.turnId ?? crypto.randomUUID();
  const modelId: string = body.model || "google-nb-pro";
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

  let nextSeq = 0;
  if (!shard) {
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
    nextSeq = (msgIns.data as any)?.seq ?? 0;
  }


  const MAX_COUNT_BY_MODEL: Record<string, number> = {
    "google-nb-pro": 4,
    "google-nb-2": 4,
    "openai-gpt-image-2": 10,
    "seedream-5-pro": 6,
    "seedream-4-5": 6,

    "flux-2-pro": 4,
    "flux-2-max": 4,
    "riverflow-2-5-pro": 4,
    "qwen-image-3-pro": 4,
    "krea-2-large": 4,
    "mai-image-2-5-pro": 4,
    "grok-imagine-image": 4,
  };
  const modelCap = MAX_COUNT_BY_MODEL[modelId] ?? 4;
  const requestedCount = Math.min(Math.max(Number(reqSettings.count ?? body.count ?? 1) || 1, 1), modelCap);
  const count = shard ? 1 : requestedCount;

  // Multi-image rounds fan out to one worker per image. A single request cannot
  // hold four large (4K ≈ 23 MB) provider responses in memory inside its time
  // budget, so each image gets its own invocation and the turn is closed out by
  // the status poll once every image has landed.
  if (!shard && requestedCount > 1) {
    const fanoutSnapshot = {
      ...settingsSnapshot,
      requested_count: requestedCount,
      fanout: true,
      fanout_started_at: nowIso(),
    };
    await sb.from("messages").update({ settings_snapshot_json: fanoutSnapshot }).eq("id", turnId);
    const shardBody = { ...body, session_id: sessionId, settings: { ...reqSettings, count: 1 }, count: 1 };
    const kicks = Array.from({ length: requestedCount }, (_, index) =>
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/frank-api/inference/shard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""}`,
          "x-frank-internal": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        },
        body: JSON.stringify({ turn_id: turnId, shard_index: index, user_id: userId, payload: shardBody }),
      }).catch((err) => {
        console.error("[frank-api] shard kick failed", index, errMessage(err));
        return null;
      })
    );
    // Keep the instance alive for the sub-invocations, but answer the client now.
    try {
      (globalThis as any).EdgeRuntime?.waitUntil?.(Promise.allSettled(kicks));
    } catch { /* best effort */ }
    return {
      turn: rowToTurn({
        id: turnId, session_id: sessionId, role: "user",
        message_type: settingsSnapshot.kind, prompt_text: prompt,
        settings_snapshot_json: fanoutSnapshot,
        seq: nextSeq, created_at: nowIso(),
      }),
      status: "running" as const,
      assets: [],
    };
  }

  const generatedImages: Array<{ b64?: string; url?: string; mime: string }> = [];
  const partialErrors: Array<{ code: string; message: string; retryable: boolean; status?: number; request_id?: string }> = [];
  // The sanitised body we sent upstream, stored on the turn for troubleshooting.
  let providerRequest: unknown = null;
  // Set when the round had to be re-run on Replicate after OpenRouter failed.
  let usedFallback: { from: string; to: string; reason: string } | null = null;
  const openrouterModel = OPENROUTER_IMAGE_MAP[modelId] as string | undefined;

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
    if (!openrouterModel) {
      throw new ProviderRunError(`Model ${modelId} is not supported on OpenRouter.`, "unsupported_model", false);
    }

    // Primary path: OpenRouter's dedicated /v1/images endpoint. Models that
    // support n>1 get one call; the rest are fanned out in parallel.
    const nativeN = OPENROUTER_NATIVE_N.has(openrouterModel);
    const calls = nativeN ? 1 : count;
    // Independent image calls must run concurrently. Serial 4K requests can
    // exceed the function's request budget and leave the persisted turn stuck
    // as running even though each individual provider call is healthy.
    const results = await Promise.allSettled(
      Array.from({ length: calls }, () =>
        openrouterImage(providerPrompt, refUrls, {
          model: openrouterModel,
          aspectRatio: reqSettings.aspect_ratio,
          size: reqSettings.image_size || reqSettings.size,
          quality: reqSettings.quality,
          n: nativeN ? count : 1,
          onRequest: (record) => { providerRequest = record; },
        })
      ),
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
      const reason = first?.reason ?? new ProviderRunError("OpenRouter returned no images.", "provider_error", true);
      const fallbackSlug = REPLICATE_IMAGE_FALLBACK[modelId];
      const replicateKey = getReplicateGatewayKey();
      if (!fallbackSlug || !replicateKey || !shouldFallbackToReplicate(reason)) throw reason;

      const mappedReason = mapReplicateError(reason);
      console.warn("[frank-api] openrouter failed, falling back to replicate", {
        model: modelId, slug: fallbackSlug, code: mappedReason.code,
      });
      const fallbackInput = {
        aspect_ratio: reqSettings.aspect_ratio,
        size: reqSettings.image_size || reqSettings.size,
        reference_images: refUrls,
      };
      const fallbackBody = { version_or_model: fallbackSlug, input: buildReplicateInput(fallbackSlug, providerPrompt, fallbackInput) };
      providerRequest = providerRequestRecord(
        `POST https://api.replicate.com/v1/models/${fallbackSlug}/predictions`,
        fallbackBody,
      );
      const fallbackRuns = await Promise.allSettled(
        Array.from({ length: count }, () => runReplicate(fallbackSlug, providerPrompt, fallbackInput, replicateKey)),
      );
      for (const run of fallbackRuns) {
        if (run.status === "fulfilled" && run.value) generatedImages.push({ url: run.value, mime: "image/png" });
        else if (run.status === "rejected") {
          const m = mapReplicateError(run.reason);
          partialErrors.push({ code: m.code, message: m.message, retryable: m.retryable, status: m.status, request_id: m.requestId });
        }
      }
      if (!generatedImages.length) throw reason;
      usedFallback = { from: "openrouter", to: "replicate", reason: mappedReason.message };
    }
  } catch (err) {
    const mapped = mapReplicateError(err);
    const msg = mapped.message;
    const failedSnapshot = {
      ...settingsSnapshot,
      status: "failed",
      error: msg,
      error_code: mapped.code,
      error_retryable: mapped.retryable,
      error_status: mapped.status ?? null,
      error_raw: mapped.raw ?? null,
      error_request_id: mapped.requestId ?? null,
      provider_request: providerRequest,
    };
    if (shard) {
      // One image of a fan-out failed. Record it without failing the whole turn:
      // the status poll decides the outcome once every shard has reported.
      const current = await sb.from("messages").select("settings_snapshot_json").eq("id", turnId).maybeSingle();
      const snap = (current.data?.settings_snapshot_json ?? settingsSnapshot) as any;
      const shardErrors = Array.isArray(snap.shard_errors) ? snap.shard_errors : [];
      shardErrors.push({
        index: shard.index, code: mapped.code, message: msg,
        retryable: mapped.retryable, status: mapped.status ?? null,
      });
      await sb.from("messages").update({
        settings_snapshot_json: { ...snap, shard_errors: shardErrors, provider_request: providerRequest ?? snap.provider_request ?? null },
      }).eq("id", turnId);
      return { turn: null as any, status: "failed" as const, error: { code: mapped.code, message: msg, retryable: mapped.retryable } as any };
    }
    await sb.from("messages").update({ settings_snapshot_json: failedSnapshot }).eq("id", turnId);

    return {
      turn: rowToTurn({
        id: turnId, session_id: sessionId, role: "user",
        message_type: settingsSnapshot.kind, prompt_text: prompt,
        settings_snapshot_json: failedSnapshot,
        seq: nextSeq, created_at: nowIso(),
      }),

      status: "failed" as const,
      error: { code: mapped.code, message: msg, retryable: mapped.retryable, status: mapped.status, raw: mapped.raw, request_id: mapped.requestId } as any,
    };
  }

  const providerPayload = usedFallback
    ? { provider: "replicate", model: REPLICATE_IMAGE_FALLBACK[modelId], fallback_from: "openrouter" as const }
    : { provider: "openrouter", model: openrouterModel! };

  const insertedAssets: any[] = await persistImageAssets({
    userId, sessionId, turnId, prompt, modelId,
    aspectRatio: reqSettings.aspect_ratio,
    requestedSize: reqSettings.image_size || reqSettings.size || null,
    provider: providerPayload.provider,
    providerModel: providerPayload.model,
    images: generatedImages,
  });

  const assetIds = insertedAssets.map((asset) => asset.id);

  if (shard) {
    // Assets are the source of truth for a fan-out round; only record provider
    // detail and let the status poll close the turn when all shards have landed.
    const current = await sb.from("messages").select("settings_snapshot_json").eq("id", turnId).maybeSingle();
    const snap = (current.data?.settings_snapshot_json ?? settingsSnapshot) as any;
    await sb.from("messages").update({
      settings_snapshot_json: {
        ...snap,
        provider_request: providerRequest ?? snap.provider_request ?? null,
        provider: providerPayload.provider,
        provider_model: providerPayload.model,
        fallback: usedFallback ?? snap.fallback ?? undefined,
        last_shard_at: nowIso(),
      },
    }).eq("id", turnId);
    return { turn: null as any, status: "complete" as const, assets: [] };
  }

  const completedSnapshot = {
    ...settingsSnapshot,
    status: "complete",
    output_asset_ids: assetIds,
    requested_count: count,
    partial_errors: partialErrors.length ? partialErrors : undefined,
    provider_request: providerRequest,
    provider: providerPayload.provider,
    provider_model: providerPayload.model,
    fallback: usedFallback ?? undefined,
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
    providerPayload,
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
  provider: string;
  providerModel?: string;
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
    const stored = await storeOrFallback({
      storagePath,
      bytes,
      mime,
      remoteUrl: img.url && /^https?:/i.test(img.url) ? img.url : undefined,
    });

    const assetIns = await sb.from("assets").insert({
      id: assetId,
      user_id: args.userId,
      session_id: args.sessionId,
      message_id: args.turnId,
      storage_path: stored.stored ? storagePath : "",
      asset_type: "generated",
      prompt_snapshot: args.prompt,
      model_key: args.modelId,
      metadata_json: (() => {
        // The real pixel size comes from the file the provider returned; the
        // requested aspect/size is kept alongside it for comparison.
        const real = imageDimensions(bytes, mime);
        return {
          media_type: "image",
          mime,
          title: args.prompt.slice(0, 80) || "Generated image",
          aspect_ratio: args.aspectRatio,
          requested_size: args.requestedSize ?? null,
          requested_width: requested?.width ?? null,
          requested_height: requested?.height ?? null,
          bytes: bytes.byteLength,
          width: real?.width,
          height: real?.height,
          provider: args.provider,
          provider_model: args.providerModel ?? null,
          ...stored.meta,
        };
      })(),


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

  // ---- Fan-out rounds: one worker per image, assets are the progress ledger --
  if (snapshot.status === "running" && snapshot.fanout) {
    const requested = Math.max(Number(snapshot.requested_count) || 1, 1);
    const assetRows = await sb.from("assets").select("id").eq("message_id", turnId);
    const done = (assetRows.data ?? []).length;
    const shardErrors: any[] = Array.isArray(snapshot.shard_errors) ? snapshot.shard_errors : [];
    const startedAt = new Date(snapshot.fanout_started_at || row.created_at).getTime();
    const ageMs = Date.now() - startedAt;
    const expired = Number.isFinite(ageMs) && ageMs > 8 * 60_000;

    if (done >= requested || done + shardErrors.length >= requested || expired) {
      if (!done) {
        const first = shardErrors[0];
        const failed = {
          ...snapshot,
          status: "failed",
          error: first?.message || "Every image in this round failed. Retry the run.",
          error_code: first?.code || "worker_interrupted",
          error_retryable: first?.retryable ?? true,
        };
        await sb.from("messages").update({ settings_snapshot_json: failed }).eq("id", turnId);
        const result = await finishWithRows(failed, "failed");
        return { ...result, error: { code: failed.error_code, message: failed.error, retryable: failed.error_retryable } };
      }
      const ids = (assetRows.data ?? []).map((r: any) => r.id);
      const complete = {
        ...snapshot,
        status: "complete",
        output_asset_ids: ids,
        partial_errors: shardErrors.length ? shardErrors : undefined,
      };
      await sb.from("messages").update({ settings_snapshot_json: complete }).eq("id", turnId);
      return await finishWithRows(complete, "complete");
    }
    return await finishWithRows({ ...snapshot, pending_count: requested - done }, "running");
  }

  if (snapshot.status !== "running" || !predictionIds.length) {
    if (snapshot.status === "running" && !predictionIds.length) {
      const ageMs = Date.now() - new Date(row.created_at).getTime();
      if (Number.isFinite(ageMs) && ageMs > 3 * 60_000) {
        const failed = {
          ...snapshot,
          status: "failed",
          error: "The generation worker was interrupted before the provider returned. Retry this run.",
          error_code: "worker_interrupted",
          error_retryable: true,
        };
        await sb.from("messages").update({ settings_snapshot_json: failed }).eq("id", turnId);
        return await finishWithRows(failed, "failed");
      }
    }
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
    provider: "replicate",
    providerModel: snapshot.provider_model || REPLICATE_IMAGE_FALLBACK[snapshot.model || snapshot.model_key] || snapshot.model || snapshot.model_key || "",
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
      "This model is temporarily unavailable on the provider side. Try Nano Banana Pro, Seedream 5.0 Pro, or GPT-image-2.",
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
    if (path === "/config") return json(STUDIO_CONFIG);
    if (path === "/models") return json({ models: STUDIO_CONFIG.models, backlogModels: [], promptPresets: STUDIO_CONFIG.promptPresets });

    // ---- Internal: one image of a fan-out round, called by this function ----
    if (path === "/inference/shard" && method === "POST") {
      const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      if (!secret || req.headers.get("x-frank-internal") !== secret) {
        return json({ error: { message: "Forbidden" } }, 403);
      }
      const body = await readJson(req);
      const result = await handleInference(
        body.payload ?? {},
        String(body.user_id || ""),
        { turnId: String(body.turn_id || ""), index: Number(body.shard_index) || 0 },
      );
      return json({ status: result.status });
    }






    // ---- Authenticated endpoints ----
    const userId = await requireUser(req);

    if (path === "/sessions" && method === "GET") {
      const { data } = await supabase().from("sessions").select("*")
        .eq("user_id", userId).order("created_at", { ascending: true });
      const active = (data || []).filter((r: any) => (r.status ?? "active") !== "archived");
      const rows = active.length ? active : [await getOrCreateDefaultSession(userId)];
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
    const sessionPatchMatch = path.match(/^\/sessions\/([^/]+)$/);
    if (sessionPatchMatch && (method === "PATCH" || method === "PUT")) {
      const body = await readJson(req);
      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string" && body.name.trim()) patch.title = body.name.trim().slice(0, 120);
      if (typeof body.status === "string") patch.status = body.status === "archived" ? "archived" : "active";
      if (!Object.keys(patch).length) return json({ error: { code: "bad_request", message: "Nothing to update" } }, 400);
      const upd = await supabase().from("sessions").update(patch)
        .eq("id", sessionPatchMatch[1]).eq("user_id", userId).select().maybeSingle();
      if (upd.error) throw upd.error;
      if (!upd.data) return json({ error: { code: "not_found", message: "Session not found" } }, 404);
      return json({ session: rowToSession(upd.data) });
    }
    if (sessionPatchMatch && method === "DELETE") {
      const upd = await supabase().from("sessions").update({ status: "archived" })
        .eq("id", sessionPatchMatch[1]).eq("user_id", userId);
      if (upd.error) throw upd.error;
      return json({ ok: true });
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
      // Oversized generations are never uploaded to the bucket (see
      // storeOrFallback), so they arrive with no storage path at all. Carry the
      // provider's temporary URL across, or the reference is born broken.
      const remoteUrl = typeof body.remote_url === "string" && body.remote_url.startsWith("http")
        ? body.remote_url
        : "";
      const storageMissing = body.storage_missing === true && !!remoteUrl;
      if (!sessionId || (!storagePath && !storageMissing)) {
        return json({ error: { code: "invalid_reference", message: "Reference needs a session and either an uploaded image path or a provider URL." } }, 400);
      }
      const metadata = {
        title: String(body.title || "Reference image"),
        media_type: "image",
        mime: typeof body.mime === "string" ? body.mime : "image/png",
        source_asset_id: typeof body.source_asset_id === "string" ? body.source_asset_id : null,
        width: typeof body.width === "number" ? body.width : null,
        height: typeof body.height === "number" ? body.height : null,
        ...(storageMissing ? { storage_missing: true, remote_url: remoteUrl, remote_url_expires: true } : {}),
      };

      const { data, error } = await supabase().from("assets").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        session_id: sessionId,
        // Same rule as generated assets: no path for a file that was never stored.
        storage_path: storageMissing ? "" : storagePath,
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
      if (typeof body.title === "string") nextMeta.title = body.title;
      patch.metadata_json = nextMeta;

      const { data: updated, error } = await sb.from("assets").update(patch).eq("user_id", userId).eq("id", aid).select("*").maybeSingle();
      if (error) return json({ error: { code: "update_failed", message: error.message } }, 400);
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

    // (approval history route removed)





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
      const diagStart = Date.now();
      const rawBody = await req.text();
      const bodyBytes = rawBody.length;
      let body: { messages?: { role?: string; content?: string; images?: string[] }[]; skill?: string } = {};
      try { body = JSON.parse(rawBody || "{}"); } catch {
        console.log(JSON.stringify({ tag: "prompt-agent", phase: "parse_failed", user_id: userId, body_bytes: bodyBytes }));
        return json({ error: { code: "invalid", message: "Malformed request body" } }, 400);
      }
      const incoming = Array.isArray(body?.messages) ? body.messages : [];
      const imageSizes: number[] = [];
      for (const m of incoming) {
        for (const u of Array.isArray(m?.images) ? m.images : []) {
          if (typeof u === "string") imageSizes.push(u.length);
        }
      }
      console.log(JSON.stringify({
        tag: "prompt-agent", phase: "received", user_id: userId,
        skill: String(body?.skill || "brief-to-prompt"),
        message_count: incoming.length,
        body_bytes: bodyBytes,
        image_count: imageSizes.length,
        image_bytes: imageSizes,
        image_bytes_total: imageSizes.reduce((a, b) => a + b, 0),
      }));
      const totalImageBytes = imageSizes.reduce((sum, size) => sum + size, 0);
      if (totalImageBytes > 8_000_000) {
        return json({
          error: {
            code: "payload_too_large",
            message: "Those reference images are too large together. Remove one image or attach smaller versions and try again.",
          },
        }, 413);
      }

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


      // The prompt agent runs on a primary model with a second, different model
      // as a fallback. A model that errors or returns nothing must not surface as
      // a bare 502 — the client retries those five times and shows a
      // "reconnecting to backend" banner instead of the real reason.
      const PROMPT_AGENT_MODELS = ["google/gemini-3.7-flash", "google/gemini-3-flash-preview"];
      const attempts: { model: string; outcome: string; ms: number; status?: number; message?: string }[] = [];
      // Diagnostics-only switch so the failure branch can be exercised on demand.
      const simulate = req.headers.get("x-frank-debug-agent-fail") || "";

      for (const model of PROMPT_AGENT_MODELS) {
        const callStart = Date.now();
        try {
          if (simulate === "primary-500" && model === PROMPT_AGENT_MODELS[0]) throw new LovableChatError(500, "simulated primary outage");
          if (simulate === "empty") throw new LovableChatError(0, "simulated empty");
          if (simulate === "429") throw new LovableChatError(429, "simulated rate limit");
          if (simulate === "500") throw new LovableChatError(500, "simulated provider outage");
          const reply = await lovableChat([{ role: "system", content: system }, ...history], model);

          const cleaned = String(reply || "").trim();
          if (cleaned) {
            attempts.push({ model, outcome: "ok", ms: Date.now() - callStart });
            console.log(JSON.stringify({
              tag: "prompt-agent", phase: "ok", user_id: userId, model,
              body_bytes: bodyBytes, image_count: imageSizes.length,
              total_ms: Date.now() - diagStart, reply_chars: cleaned.length, attempts,
            }));
            return json({ reply: cleaned, model, skill });
          }
          attempts.push({ model, outcome: "empty", ms: Date.now() - callStart });
        } catch (err) {
          const status = err instanceof LovableChatError ? err.status : 0;
          attempts.push({ model, outcome: "error", ms: Date.now() - callStart, status, message: errMessage(err).slice(0, 400) });
        }
      }

      const last = attempts[attempts.length - 1];
      console.log(JSON.stringify({
        tag: "prompt-agent", phase: "failed", user_id: userId,
        body_bytes: bodyBytes, image_count: imageSizes.length,
        image_bytes: imageSizes, image_bytes_total: imageSizes.reduce((a, b) => a + b, 0),
        total_ms: Date.now() - diagStart, attempts,
      }));

      const rateLimited = attempts.some((a) => a.status === 429);
      const payloadTooBig = attempts.some((a) => a.status === 413);
      const code = rateLimited ? "rate_limited" : payloadTooBig ? "payload_too_large" : last?.outcome === "empty" ? "empty" : "ai_error";
      const message = rateLimited
        ? "The AI provider is rate limiting requests right now. Wait a moment and send again."
        : payloadTooBig
          ? "Those reference images are too large for the agent. Attach smaller images and try again."
          : last?.outcome === "empty"
            ? "The agent could not produce an answer for this brief and reference images. Try rewording the brief or removing one reference."
            : `The agent request failed: ${last?.message || "unknown provider error"}`;
      // 422 keeps the client from replaying the same doomed request five times.
      return json({ error: { code, message, attempts } }, rateLimited ? 429 : 422);
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






    return json({ error: { code: "not_found", message: `No handler for ${method} ${path}` } }, 404);
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: { code: "auth_error", message: err.message } }, err.status);
    }
    console.error("[frank-api]", err);
    return json({ error: { code: "internal_error", message: errMessage(err) } }, 500);
  }
});

