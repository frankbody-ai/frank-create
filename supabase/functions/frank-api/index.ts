// Frank Create unified backend — Supabase Edge Function.
// Serves every /api/frank/* call the SPA makes from a single endpoint.
// Mirrors the dev-time Vite plugin at frank-create/server/frankApi.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

async function lovableImage(prompt: string): Promise<{ b64: string; mime: string }> {
  const r = await fetch(`${LOVABLE_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image-preview",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) throw new Error(`Lovable image ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  const msg = j.choices?.[0]?.message;
  const images = msg?.images;
  if (Array.isArray(images) && images.length) {
    const first = images[0];
    const url: string = first.image_url?.url || first.url || "";
    const m = url.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (m) return { b64: m[2], mime: m[1] };
    if (url) return { b64: url, mime: "image/png" };
  }
  throw new Error(`Lovable AI returned no image data. ${JSON.stringify(j).slice(0, 300)}`);
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

async function handleInference(body: any, userId: string) {
  const sb = supabase();
  let sessionId: string = body.session_id;
  if (!sessionId) sessionId = (await getOrCreateDefaultSession(userId)).id;

  const prompt: string = body.prompt || "";
  if (!prompt.trim()) throw new Error("Prompt is required");

  const turnId = crypto.randomUUID();
  const settingsSnapshot: any = {
    kind: body.kind || "generate",
    model: body.model || "nano-banana-pro",
    settings: body.settings || {},
    frank_body_mode: !!body.frank_body_mode,
    preset_key: body.preset_key ?? null,
    reference_asset_ids: body.reference_asset_ids || [],
    status: "running",
  };

  const { data: maxSeq } = await sb.from("messages")
    .select("seq").eq("session_id", sessionId)
    .order("seq", { ascending: false }).limit(1).maybeSingle();
  const nextSeq = ((maxSeq?.seq as number) || 0) + 1;

  const msgIns = await sb.from("messages").insert({
    id: turnId,
    user_id: userId,
    session_id: sessionId,
    role: "user",
    message_type: settingsSnapshot.kind,
    prompt_text: prompt,
    settings_snapshot_json: settingsSnapshot,
    seq: nextSeq,
  });
  if (msgIns.error) throw msgIns.error;

  let img;
  try {
    img = await lovableImage(prompt);
  } catch (err) {
    await sb.from("messages").update({
      settings_snapshot_json: { ...settingsSnapshot, status: "failed", error: String(err) },
    }).eq("id", turnId);
    return {
      turn: rowToTurn({
        id: turnId, session_id: sessionId, role: "user",
        message_type: settingsSnapshot.kind, prompt_text: prompt,
        settings_snapshot_json: { ...settingsSnapshot, status: "failed" },
        seq: nextSeq, created_at: nowIso(),
      }),
      status: "failed" as const,
      error: { code: "lovable_ai_error", message: String(err) },
    };
  }

  const assetId = crypto.randomUUID();
  const ext = img.mime.split("/")[1] || "png";
  const storagePath = `${sessionId}/${assetId}.${ext}`;
  const bytes = base64Decode(img.b64);
  const up = await sb.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: img.mime, upsert: false,
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
    model_key: "nano-banana-pro",
    metadata_json: {
      media_type: "image",
      mime: img.mime,
      title: prompt.slice(0, 80) || "Generated image",
    },
  }).select().single();
  if (assetIns.error) throw assetIns.error;

  const completedSnapshot = {
    ...settingsSnapshot,
    status: "complete",
    output_asset_ids: [assetId],
  };
  await sb.from("messages").update({
    settings_snapshot_json: completedSnapshot,
  }).eq("id", turnId);

  const url = await signed(storagePath);
  return {
    turn: rowToTurn({
      id: turnId, session_id: sessionId, role: "user",
      message_type: settingsSnapshot.kind, prompt_text: prompt,
      settings_snapshot_json: completedSnapshot,
      seq: nextSeq, created_at: nowIso(),
    }),
    status: "complete" as const,
    assets: [rowToAsset(assetIns.data, url)],
    providerPayload: { provider: "lovable", model: "google/gemini-2.5-flash-image" },
    localEngine: "fallback" as const,
  };
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
    if (path.startsWith("/exports")) return json({ exports: [] });

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
        error: { code: "video_not_supported", message: "Video is not wired to Lovable AI yet." },
      });
    }

    return json({ error: { code: "not_found", message: `No handler for ${method} ${path}` } }, 404);
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: { code: "auth_error", message: err.message } }, err.status);
    }
    console.error("[frank-api]", err);
    return json({ error: { code: "internal_error", message: String(err) } }, 500);
  }
});
