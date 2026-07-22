// Frank Create – Image generation via Lovable AI Gateway + Replicate.
// Public function: accepts { prompt, count, modelId? } and returns { images: dataUrl[] }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map studio model id -> Lovable AI Gateway model string.
// Kept only for the local placeholder — every user-visible model now runs on Replicate.
const MODEL_MAP: Record<string, string> = {
  "frank-local-comfy": "google/gemini-2.5-flash-image",
};

// Replicate model routing: studio model id -> Replicate owner/name.
// Nano Banana + gpt-image-2 use Replicate (not Lovable AI) so aspect/quality/refs
// match each model's published schema exactly (4K, wide aspects, multi-ref).
const REPLICATE_MAP: Record<string, string> = {
  "google-nb-pro": "google/nano-banana-pro",
  "google-nb-2": "google/nano-banana-2",
  "openai-gpt-image-2": "openai/gpt-image-2",
  "reve-2-1": "reve/reve-2.1",
  "seedream-5-pro": "bytedance/seedream-5-pro",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return json({ error: "LOVABLE_API_KEY not configured" }, 500);
  }

  let body: {
    prompt?: string;
    count?: number;
    modelId?: string;
    model?: string;
    size?: string;
    aspect_ratio?: string;
    quality?: string;
    thinking_budget?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) return json({ error: "prompt is required" }, 400);

  const count = Math.min(Math.max(Number(body.count) || 1, 1), 4);
  const modelId = body.modelId ?? "";

  // ---- Replicate branch ----
  if (REPLICATE_MAP[modelId]) {
    const replicateKey = getReplicateGatewayKey();
    if (!replicateKey) {
      return json({ error: "REPLICATE_API_KEY not configured", code: "config_missing", retryable: false }, 500);
    }
    const slug = REPLICATE_MAP[modelId];
    const images: string[] = [];
    const errors: MappedError[] = [];
    // Parallelize per-image work so a slow/cold model doesn't multiply latency.
    const results = await Promise.allSettled(
      Array.from({ length: count }, async () => {
        if (req.signal.aborted) throw new ReplicateError("Canceled by user.", { code: "canceled", retryable: true });
        return runReplicate(slug, prompt, body, replicateKey, req.signal);
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value) images.push(r.value);
        else errors.push({ code: "empty_output", message: "Replicate returned no image URL.", retryable: true });
      } else {
        errors.push(mapReplicateError(r.reason));
      }
    }
    if (!images.length) {
      const primary = errors[0] ?? { code: "unknown", message: "Generation failed", retryable: true } as MappedError;
      await logGenerationErrors(req, "replicate", modelId, body, errors);
      return json({ error: primary.message, code: primary.code, retryable: primary.retryable, request_id: primary.requestId, details: errors }, primary.status ?? 502);
    }
    if (errors.length) {
      // Partial failures still worth auditing.
      await logGenerationErrors(req, "replicate", modelId, body, errors);
    }
    return json({ images, errors: errors.length ? errors : undefined });
  }

  // ---- Lovable AI Gateway branch (Gemini / OpenAI) ----
  const gatewayModel = body.model || MODEL_MAP[modelId] || "google/gemini-2.5-flash-image";
  const useImagesEndpoint = gatewayModel.startsWith("openai/gpt-image");

  const OPENAI_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536", "auto"]);
  const sizeFromAspect = (ar?: string): string => {
    switch (ar) {
      case "3:2": return "1536x1024";
      case "2:3": return "1024x1536";
      case "1:1":
      default: return "1024x1024";
    }
  };

  const images: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    if (req.signal.aborted) {
      errors.push("canceled");
      break;
    }
    try {
      let res: Response;
      if (useImagesEndpoint) {
        const size = body.size && OPENAI_SIZES.has(body.size) ? body.size : sizeFromAspect(body.aspect_ratio);
        res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: gatewayModel,
            prompt,
            quality: body.quality ?? "low",
            size,
            n: 1,
          }),
          signal: req.signal,
        });
      } else {
        const ar = body.aspect_ratio;
        const sz = body.size;
        const hints: string[] = [];
        if (ar && ar !== "auto") {
          hints.push(`The final image canvas must be exactly ${ar} aspect ratio. Do not use a square canvas unless ${ar} is 1:1.`);
        }
        if (sz && ["1K", "2K", "4K"].includes(sz)) hints.push(`Output resolution: ${sz}.`);
        const fullPrompt = hints.length ? `${prompt}\n\nOutput constraints: ${hints.join(" ")}` : prompt;
        const payload: Record<string, unknown> = {
          model: gatewayModel,
          messages: [{ role: "user", content: fullPrompt }],
          modalities: ["image", "text"],
        };
        const budget = Number(body.thinking_budget ?? 0);
        if (budget > 0 && gatewayModel.includes("gemini-3-pro")) {
          payload.reasoning = { effort: budget >= 5000 ? "high" : "low" };
        }
        res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: req.signal,
        });
      }

      if (res.status === 429) return json({ error: "Rate limit hit. Try again shortly." }, 429);
      if (res.status === 402) return json({ error: "Lovable AI credits exhausted." }, 402);

      if (!res.ok) {
        const text = await res.text();
        errors.push(`status ${res.status}: ${text.slice(0, 200)}`);
        continue;
      }

      const data = await res.json();
      let imageUrl: string | undefined;
      if (useImagesEndpoint) {
        const item = data?.data?.[0];
        if (item?.b64_json) imageUrl = `data:image/png;base64,${item.b64_json}`;
        else if (item?.url) imageUrl = item.url;
      } else {
        const item = data?.data?.[0];
        if (item?.b64_json) imageUrl = `data:image/png;base64,${item.b64_json}`;
        else if (item?.url) imageUrl = item.url;
        else imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      }
      if (imageUrl) images.push(imageUrl);
      else errors.push("no image in response");
    } catch (err) {
      if (req.signal.aborted) {
        errors.push("canceled");
        break;
      }
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (!images.length) {
    const mapped: MappedError[] = errors.map((raw) => ({
      code: "gateway_error",
      message: typeof raw === "string" ? raw.slice(0, 300) : String(raw),
      retryable: true,
    }));
    await logGenerationErrors(req, "lovable-ai", modelId, body, mapped);
    return json({ error: "Generation failed", details: errors }, 502);
  }

  return json({ images, errors: errors.length ? errors : undefined });
});

// Call a Replicate official model, poll until finished, return first output URL.
// Each model gets ONLY the fields its OpenAPI schema declares — extra fields
// are rejected on some models, so we build the input per slug.
async function runReplicate(
  slug: string,
  prompt: string,
  body: { aspect_ratio?: string; size?: string; reference_images?: string[] },
  key: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const input = buildReplicateInput(slug, prompt, body);
  const gatewayBase = "https://connector-gateway.lovable.dev/replicate/v1";
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    throw new ReplicateError("Lovable gateway key is not configured.", { code: "config_missing", status: 500, retryable: false });
  }
  const replicateHeaders = {
    "Authorization": `Bearer ${lovableApiKey}`,
    "X-Connection-Api-Key": key,
  };
  console.info("[frank-generate] replicate:create", {
    slug,
    input: sanitizeReplicateInput(input),
    has_lovable_key: !!lovableApiKey,
    has_connector_key: !!key,
  });

  const createRes = await fetch(
    `${gatewayBase}/models/${slug}/predictions`,
    {
      method: "POST",
      headers: {
        ...replicateHeaders,
        "Content-Type": "application/json",
        "Prefer": "wait=60",
      },
      body: JSON.stringify({ input }),
      signal,
    },
  );
  console.info("[frank-generate] replicate:create:status", { slug, status: createRes.status });

  if (createRes.status === 402) {
    throw new ReplicateError("Replicate account has no credit. Enable billing at replicate.com/account/billing.", { code: "quota_exhausted", status: 402, retryable: false });
  }
  if (createRes.status === 401 || createRes.status === 403) {
    const t = await createRes.text();
    const providerMessage = extractProviderMessage(t);
    console.error("[frank-generate] replicate:auth_failed", { slug, status: createRes.status, body: t.slice(0, 1000) });
    throw new ReplicateError(`Replicate auth failed: ${providerMessage}. Reconnect the Replicate integration if this continues.`, { code: "auth_failed", status: createRes.status, retryable: false, raw: t });
  }
  if (createRes.status === 422) {
    const t = await createRes.text();
    throw new ReplicateError(`Invalid parameters for ${slug}: ${extractProviderMessage(t)}`, { code: "invalid_params", status: 422, retryable: false, raw: t });
  }
  if (createRes.status === 429) {
    throw new ReplicateError("Replicate rate limit hit. Wait a moment and try again.", { code: "rate_limited", status: 429, retryable: true });
  }
  if (createRes.status >= 500) {
    const t = await createRes.text();
    throw new ReplicateError(`Replicate is having trouble (${createRes.status}). Retry shortly.`, { code: "provider_unavailable", status: createRes.status, retryable: true, raw: t });
  }
  if (!createRes.ok) {
    const t = await createRes.text();
    throw new ReplicateError(`Replicate error ${createRes.status}: ${extractProviderMessage(t)}`, { code: "provider_error", status: createRes.status, retryable: false, raw: t });
  }

  let pred = await createRes.json();
  const predictionId: string | undefined = pred?.id;
  const cancelUrl: string | undefined = pred?.urls?.cancel;

  // If the client disconnects mid-poll, best-effort cancel the Replicate prediction.
  const onAbort = () => {
    if (cancelUrl) {
      fetch(`${gatewayBase}/predictions/${predictionId}/cancel`, { method: "POST", headers: replicateHeaders }).catch(() => {});
    } else if (predictionId) {
      fetch(`${gatewayBase}/predictions/${predictionId}/cancel`, {
        method: "POST",
        headers: replicateHeaders,
      }).catch(() => {});
    }
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const started = Date.now();
    while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
      if (signal?.aborted) {
        throw new ReplicateError("Canceled by user.", { code: "canceled", retryable: true, requestId: predictionId });
      }
      if (Date.now() - started > 180_000) {
        throw new ReplicateError("Replicate timed out after 3 minutes.", { code: "timeout", retryable: true, requestId: predictionId });
      }
      await new Promise((r) => setTimeout(r, 2000));
      const id = pred?.id;
      if (!id) throw new ReplicateError("Replicate did not return a prediction ID.", { code: "provider_error", retryable: true });
      const r = await fetch(`${gatewayBase}/predictions/${id}`, { headers: replicateHeaders, signal });
      if (!r.ok) {
        const t = await r.text();
        console.error("[frank-generate] replicate:poll_failed", { slug, id, status: r.status, body: t.slice(0, 1000) });
        throw new ReplicateError(`Replicate poll failed (${r.status}): ${extractProviderMessage(t)}`, { code: "provider_error", status: r.status, retryable: true, raw: t, requestId: id });
      }
      pred = await r.json();
      console.info("[frank-generate] replicate:poll:status", { slug, id, status: pred?.status });
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  if (pred.status === "canceled") {
    throw new ReplicateError("Replicate prediction was canceled.", { code: "canceled", retryable: true, requestId: pred?.id ?? predictionId });
  }
  if (pred.status !== "succeeded") {
    const rawErr = typeof pred.error === "string" ? pred.error : JSON.stringify(pred.error ?? "unknown");
    const classified = classifyModelError(rawErr);
    throw new ReplicateError(classified.message, { code: classified.code, retryable: classified.retryable, raw: rawErr, requestId: pred?.id ?? predictionId });
  }

  const out = pred.output;
  const url = extractReplicateUrl(out);
  if (!url) {
    console.error("[frank-generate] replicate:empty_output", {
      slug,
      id: pred?.id,
      status: pred?.status,
      output_type: typeof out,
      output_sample: JSON.stringify(out ?? null).slice(0, 1000),
    });
    throw new ReplicateError(`Replicate returned no image URL (output=${JSON.stringify(out ?? null).slice(0, 200)})`, {
      code: "empty_output",
      retryable: true,
      raw: JSON.stringify(out ?? null).slice(0, 500),
      requestId: pred?.id ?? predictionId,
    });
  }
  return url;
}

function getReplicateGatewayKey(): string | undefined {
  // Gateway-backed Replicate connections expose REPLICATE_API_KEY in this project.
  // Keep the fallback for older linked-secret names, but never use a browser key.
  return Deno.env.get("REPLICATE_API_KEY") || Deno.env.get("LOVABLE_CONNECTOR_REPLICATE_API_KEY");
}

function sanitizeReplicateInput(input: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...input };
  if (typeof copy.prompt === "string") copy.prompt = String(copy.prompt).slice(0, 240);
  for (const key of ["reference_images", "image_input"]) {
    const value = copy[key];
    if (Array.isArray(value)) copy[key] = value.map((item) => typeof item === "string" ? `[uri:${item.length}]` : "[non-string]");
  }
  return copy;
}

function extractReplicateUrl(output: unknown): string | undefined {
  if (!output) return undefined;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractReplicateUrl(item);
      if (url) return url;
    }
    return undefined;
  }
  if (typeof output === "object") {
    const record = output as Record<string, unknown>;
    for (const key of ["image", "url", "image_url", "output", "file", "content", "result"]) {
      const value = record[key];
      if (typeof value === "string" && value) return value;
      const nested = extractReplicateUrl(value);
      if (nested) return nested;
    }
    for (const key of ["images", "urls", "files", "data", "results"]) {
      const nested = extractReplicateUrl(record[key]);
      if (nested) return nested;
    }
  }
  return undefined;
}

type MappedError = { code: string; message: string; retryable: boolean; status?: number; raw?: string; requestId?: string };

class ReplicateError extends Error {
  code: string;
  status?: number;
  retryable: boolean;
  raw?: string;
  requestId?: string;
  constructor(message: string, opts: { code: string; status?: number; retryable: boolean; raw?: string; requestId?: string }) {
    super(message);
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.raw = opts.raw;
    this.requestId = opts.requestId;
  }
}

function mapReplicateError(err: unknown): MappedError {
  if (err instanceof ReplicateError) {
    return { code: err.code, message: err.message, retryable: err.retryable, status: err.status, raw: err.raw, requestId: err.requestId };
  }
  const message = err instanceof Error ? err.message : String(err);
  // Network / fetch failures
  if (/fetch failed|ECONN|ENOTFOUND|network|timeout/i.test(message)) {
    return { code: "network_error", message: "Network error reaching Replicate. Retry in a moment.", retryable: true };
  }
  return { code: "unknown", message, retryable: true };
}

// Try to pull a readable message out of a Replicate JSON error body.
function extractProviderMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (typeof parsed?.title === "string") return parsed.title;
    if (Array.isArray(parsed?.detail)) return parsed.detail.map((d: { msg?: string }) => d.msg ?? "").filter(Boolean).join("; ");
    return raw.slice(0, 240);
  } catch {
    return raw.slice(0, 240);
  }
}

// Classify a model runtime error (NSFW filter, OOM, bad input, etc.) from the
// prediction's `error` field text.
function classifyModelError(raw: string): { code: string; message: string; retryable: boolean } {
  const t = raw.toLowerCase();
  if (t.includes("nsfw") || t.includes("safety") || t.includes("content policy") || t.includes("flagged")) {
    return { code: "content_filtered", message: "The provider blocked this prompt for safety/policy reasons. Rewrite and try again.", retryable: false };
  }
  if (t.includes("cuda") || t.includes("out of memory") || t.includes("oom")) {
    return { code: "provider_capacity", message: "Model ran out of GPU memory. Try a smaller size or retry later.", retryable: true };
  }
  if (t.includes("invalid") || t.includes("must be") || t.includes("expected") || t.includes("required")) {
    return { code: "invalid_params", message: `Model rejected input parameters: ${raw.slice(0, 200)}`, retryable: false };
  }
  if (t.includes("timeout") || t.includes("timed out")) {
    return { code: "timeout", message: "Model timed out. Retry shortly.", retryable: true };
  }
  if (t.includes("rate") && t.includes("limit")) {
    return { code: "rate_limited", message: "Rate limit hit. Wait and retry.", retryable: true };
  }
  return { code: "model_error", message: `Model failed: ${raw.slice(0, 200)}`, retryable: true };
}

// Per-slug input builders that match each model's published schema exactly.
function buildReplicateInput(
  slug: string,
  prompt: string,
  body: { aspect_ratio?: string; size?: string; reference_images?: string[] },
): Record<string, unknown> {
  const refs = Array.isArray(body.reference_images) ? body.reference_images.filter(Boolean) : [];

  if (slug === "reve/reve-2.1") {
    // Schema: prompt, aspect_ratio (enum incl. "auto"), reference_images (<=8). No size.
    const REVE_AR = new Set([
      "auto","1:1","4:3","3:4","3:2","2:3","16:9","9:16",
      "5:4","4:5","21:9","17:9","2:1","1:2","3:1","1:3","4:1","1:4",
    ]);
    const ar = body.aspect_ratio && REVE_AR.has(body.aspect_ratio) ? body.aspect_ratio : "auto";
    const input: Record<string, unknown> = { prompt, aspect_ratio: ar };
    if (refs.length) input.reference_images = refs.slice(0, 8);
    return input;
  }

  if (slug === "bytedance/seedream-5-pro") {
    // Schema: prompt, size ("1K"|"2K"), image_input (<=10),
    // aspect_ratio (match_input_image|1:1|4:3|3:4|16:9|9:16|3:2|2:3|21:9), output_format.
    const SEEDREAM_AR = new Set([
      "match_input_image","1:1","4:3","3:4","16:9","9:16","3:2","2:3","21:9",
    ]);
    const size = body.size === "2K" ? "2K" : "1K";
    const ar = body.aspect_ratio && SEEDREAM_AR.has(body.aspect_ratio)
      ? body.aspect_ratio
      : (refs.length ? "match_input_image" : "1:1");
    const input: Record<string, unknown> = {
      prompt,
      size,
      aspect_ratio: ar,
      output_format: "png",
    };
    if (refs.length) input.image_input = refs.slice(0, 10);
    return input;
  }

  if (slug === "google/nano-banana-pro" || slug === "google/nano-banana-2") {
    // Schema: prompt, aspect_ratio, resolution (1K/2K/4K), image_input (<=14), output_format.
    const NB_PRO_AR = new Set([
      "match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
    ]);
    const NB2_AR = new Set([
      "match_input_image", "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
    ]);
    const allowed = slug === "google/nano-banana-pro" ? NB_PRO_AR : NB2_AR;
    const ar = body.aspect_ratio && allowed.has(body.aspect_ratio)
      ? body.aspect_ratio
      : (refs.length ? "match_input_image" : "1:1");
    const resolution = body.size === "4K" ? "4K" : body.size === "2K" ? "2K" : "1K";
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: ar,
      resolution,
      output_format: "png",
    };
    if (refs.length) input.image_input = refs.slice(0, 14);
    return input;
  }

  if (slug === "openai/gpt-image-2") {
    // Schema: prompt, aspect_ratio (ratios OR pixel presets), quality, number_of_images,
    // input_images (nullable), output_format, background, moderation, output_compression.
    const RATIO_AR = new Set(["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"]);
    const PIXEL_AR = new Set([
      "1024x1024", "1536x1024", "1024x1536",
      "1536x1152", "1152x1536",
      "2048x2048", "2048x1152", "1152x2048",
      "3840x2160", "2160x3840",
    ]);
    // Prefer explicit pixel size when supplied, else fall back to the aspect ratio.
    let aspect: string = "1:1";
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

  // Fallback (should not hit — REPLICATE_MAP is closed).
  return { prompt };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// -- Error auditing ----------------------------------------------------------
// Persist mapped errors to public.generation_errors for later debugging.
// Fire-and-forget: never let logging failure mask the real error to the user.
function extractUserId(req: Request): string | null {
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token || token.split(".").length !== 3) return null;
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function logGenerationErrors(
  req: Request,
  provider: string,
  modelId: string,
  inputs: Record<string, unknown>,
  errors: Array<MappedError | string>,
): Promise<void> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey || !errors.length) return;

    const userId = extractUserId(req);
    // Redact anything that could balloon the row (e.g. base64 refs).
    const inputSnapshot: Record<string, unknown> = {
      prompt: typeof inputs.prompt === "string" ? String(inputs.prompt).slice(0, 2000) : undefined,
      count: inputs.count,
      modelId: inputs.modelId,
      model: inputs.model,
      size: inputs.size,
      aspect_ratio: inputs.aspect_ratio,
      quality: inputs.quality,
      thinking_budget: inputs.thinking_budget,
    };

    const rows = errors.map((e) => {
      if (typeof e === "string") {
        return {
          user_id: userId,
          provider,
          model_id: modelId || null,
          code: "gateway_error",
          message: e.slice(0, 500),
          retryable: true,
          http_status: null,
          inputs: inputSnapshot,
          raw: e.slice(0, 4000),
        };
      }
      return {
        user_id: userId,
        provider,
        model_id: modelId || null,
        code: e.code,
        message: (e.message ?? "").slice(0, 500),
        retryable: !!e.retryable,
        http_status: e.status ?? null,
        inputs: inputSnapshot,
        raw: e.raw ? String(e.raw).slice(0, 4000) : null,
      };
    });

    await fetch(`${url}/rest/v1/generation_errors`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
  } catch (err) {
    console.error("[frank-generate] failed to log generation errors", err);
  }
}
