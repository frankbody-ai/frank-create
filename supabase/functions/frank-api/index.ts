// Frank Create unified backend — Supabase Edge Function.
// Serves every /api/frank/* call the SPA makes from a single endpoint.
// Mirrors the dev-time Vite plugin at frank-create/server/frankApi.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildManifest, manifestToCsv, validateManifest } from "./handoff.ts";

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
    { key: "default", label: "Default", description: "No styling.", prompt: "" },
    { key: "studio", label: "Studio photo", description: "Clean studio look.", prompt: "studio lighting, high detail, sharp focus" },
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

async function lovableChat(messages: any[]) {
  const r = await fetch(`${LOVABLE_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
  });
  if (!r.ok) throw new Error(`Lovable chat ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

const MODEL_MAP: Record<string, string> = {
  "nano-banana-pro": "google/gemini-3-pro-image",
  "google-nb-pro": "google/gemini-3-pro-image",
  "nano-banana-2": "google/gemini-3.1-flash-image",
  "google-nb-2": "google/gemini-3.1-flash-image",
  "frank-local-comfy": "google/gemini-2.5-flash-image",
  "openai-gpt-image-2": "openai/gpt-image-2",
};

const REPLICATE_MAP: Record<string, string> = {
  "reve-2-1": "reve/reve-2.1",
  "seedream-5-pro": "bytedance/seedream-5-pro",
};

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

async function loadReferenceDataUrls(assetIds: string[], userId: string): Promise<string[]> {
  if (!assetIds.length) return [];
  const sb = supabase();
  const { data } = await sb.from("assets").select("id,storage_path,metadata_json")
    .eq("user_id", userId).in("id", assetIds);
  const out: string[] = [];
  for (const row of data || []) {
    try {
      const dl = await sb.storage.from(BUCKET).download(row.storage_path);
      if (dl.error || !dl.data) continue;
      const buf = new Uint8Array(await dl.data.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const b64 = btoa(bin);
      const mime = (row.metadata_json as any)?.mime || "image/png";
      out.push(`data:${mime};base64,${b64}`);
    } catch (_) { /* skip */ }
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

  const count = Math.min(Math.max(Number(reqSettings.count ?? body.count ?? 1) || 1, 1), 4);
  const generatedImages: Array<{ b64?: string; url?: string; mime: string }> = [];
  try {
    const refIds: string[] = [
      ...(body.edit_source_asset_id ? [body.edit_source_asset_id] : []),
      ...((body.reference_asset_ids as string[]) || []),
    ];
    const refUrls = await loadReferenceDataUrls(refIds, userId);
    const replicateSlug = REPLICATE_MAP[modelId];
    if (replicateSlug) {
      const replicateKey = Deno.env.get("REPLICATE_API_KEY");
      if (!replicateKey) throw new Error("Replicate is not connected for this model yet.");
      for (let i = 0; i < count; i++) {
        const url = await runReplicate(replicateSlug, prompt, {
          aspect_ratio: reqSettings.aspect_ratio,
          size: reqSettings.image_size || reqSettings.size,
          reference_images: refUrls,
        }, replicateKey);
        if (!url) throw new Error("Replicate returned no image URL.");
        generatedImages.push({ url, mime: "image/png" });
      }
    } else {
      for (let i = 0; i < count; i++) {
        generatedImages.push(await lovableImage(prompt, refUrls, {
          gatewayModel,
          aspectRatio: reqSettings.aspect_ratio,
          size: reqSettings.image_size || reqSettings.size,
          thinkingBudget: Number(reqSettings.thinking_budget ?? body.thinking_budget ?? 0),
        }));
      }
    }
  } catch (err) {
    const msg = errMessage(err);
    await sb.from("messages").update({
      settings_snapshot_json: { ...settingsSnapshot, status: "failed", error: msg },
    }).eq("id", turnId);
    return {
      turn: rowToTurn({
        id: turnId, session_id: sessionId, role: "user",
        message_type: settingsSnapshot.kind, prompt_text: prompt,
        settings_snapshot_json: { ...settingsSnapshot, status: "failed" },
        seq: nextSeq, created_at: nowIso(),
      }),
      status: "failed" as const,
      error: { code: "lovable_ai_error", message: msg },
    };
  }

  const requested = requestedDimensions(reqSettings.aspect_ratio, reqSettings.image_size || reqSettings.size);
  const insertedAssets: any[] = [];
  for (const img of generatedImages) {
    const assetId = crypto.randomUUID();
    const imageBytes = await imageBytesForUpload(img);
    const bytes = imageBytes.bytes;
    const mime = imageBytes.mime;
    const ext = mime.split("/")[1] || "png";
    const storagePath = `${sessionId}/${assetId}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: mime, upsert: false,
    });
    if (up.error) throw up.error;

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
        media_type: "image",
        mime,
        title: prompt.slice(0, 80) || "Generated image",
        aspect_ratio: reqSettings.aspect_ratio,
        requested_size: reqSettings.image_size || reqSettings.size || null,
        width: requested?.width,
        height: requested?.height,
      },
    }).select().single();
    if (assetIns.error) throw assetIns.error;
    insertedAssets.push(assetIns.data);
  }

  const assetIds = insertedAssets.map((asset) => asset.id);

  const completedSnapshot = {
    ...settingsSnapshot,
    status: "complete",
    output_asset_ids: assetIds,
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
    providerPayload: { provider: "lovable", model: gatewayModel },
    localEngine: "cloud" as const,
  };
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
  const input = buildReplicateInput(slug, prompt, body);
  const replicateGateway = "https://connector-gateway.lovable.dev/replicate/v1";
  const replicateHeaders = {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": key,
  };
  const createRes = await fetch(`${replicateGateway}/models/${slug}/predictions`, {
    method: "POST",
    headers: {
      ...replicateHeaders,
      "Content-Type": "application/json",
      "Prefer": "wait=60",
    },
    body: JSON.stringify({ input }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Replicate ${createRes.status}: ${text.slice(0, 300)}`);
  }
  let prediction: any = await createRes.json();
  const started = Date.now();
  while (!["succeeded", "failed", "canceled"].includes(prediction.status)) {
    if (Date.now() - started > 180_000) throw new Error("Replicate timed out after 3 minutes.");
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const predictionId = prediction?.id;
    if (!predictionId) throw new Error("Replicate did not return a prediction ID.");
    const poll = await fetch(`${replicateGateway}/predictions/${predictionId}`, { headers: replicateHeaders });
    if (!poll.ok) throw new Error(`Replicate poll failed (${poll.status}).`);
    prediction = await poll.json();
  }
  if (prediction.status !== "succeeded") {
    console.error("Replicate prediction non-success", {
      slug, id: prediction?.id, status: prediction?.status, error: prediction?.error,
    });
    const raw = typeof prediction.error === "string" ? prediction.error : JSON.stringify(prediction.error ?? prediction.status);
    if (typeof prediction.error === "string" && /content|policy|safety|nsfw/i.test(prediction.error)) {
      throw new Error(`Replicate blocked by content policy: ${raw.slice(0, 200)}`);
    }
    throw new Error(`Replicate ${prediction.status}: ${raw.slice(0, 240)}`);
  }
  const output = prediction.output;
  const extracted = extractReplicateUrl(output);
  if (!extracted) {
    console.error("Replicate empty output", {
      slug, id: prediction?.id, status: prediction?.status,
      output_type: typeof output, output_sample: JSON.stringify(output ?? null).slice(0, 300),
    });
    throw new Error(`Replicate returned no image URL (output=${JSON.stringify(output ?? null).slice(0, 160)})`);
  }
  return extracted;
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
    for (const key of ["image", "url", "output", "image_url"]) {
      const v = rec[key];
      if (typeof v === "string" && v) return v;
    }
    if (Array.isArray(rec.images)) return extractReplicateUrl(rec.images);
  }
  return undefined;
}

function buildReplicateInput(
  slug: string,
  prompt: string,
  body: { aspect_ratio?: string; size?: string; reference_images?: string[] },
): Record<string, unknown> {
  const refs = Array.isArray(body.reference_images) ? body.reference_images.filter(Boolean) : [];
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
  return { prompt };
}

async function handleRemix(body: any) {
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return { variants: [] };
  const content = await lovableChat([
    {
      role: "system",
      content:
        'Rewrite the user\'s image prompt as 3 distinct, vivid variants. Return ONLY a JSON array of objects: [{"key":"a","label":"Bold","prompt":"..."}].',
    },
    { role: "user", content: prompt },
  ]);
  try {
    const match = content.match(/\[[\s\S]*\]/);
    const variants = JSON.parse(match ? match[0] : content);
    return { variants };
  } catch {
    return { variants: [{ key: "a", label: "Variant A", prompt: content.slice(0, 280) }] };
  }
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
      return json({ blueprints: [], filePath: "cloud:blueprints", note: "Local ComfyUI blueprints require the desktop install." });
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

    if (path === "/prompt-remix" && method === "POST") {
      const body = await readJson(req);
      return json(await handleRemix(body));
    }

    if (path === "/videos" && method === "POST") {
      return json({
        turn: null, status: "blocked",
        error: { code: "video_not_supported", message: "Video generation requires the desktop ComfyUI install." },
      }, 501);
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

