// Frank Create – Image generation via Lovable AI Gateway + Replicate.
// Public function: accepts { prompt, count, modelId? } and returns { images: dataUrl[] }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map studio model id -> Lovable AI Gateway model string (Gemini/OpenAI models)
const MODEL_MAP: Record<string, string> = {
  "frank-local-comfy": "google/gemini-2.5-flash-image",
  "google-nb-pro": "google/gemini-3-pro-image-preview",
  "google-nb-2": "google/gemini-3.1-flash-image-preview",
  "openai-gpt-image-2": "openai/gpt-image-2",
};

// Replicate model routing: studio model id -> Replicate owner/name.
// NOTE: microsoft/mai-image-2.5 is intentionally omitted — Microsoft has not
// published MAI-Image on Replicate; the model tile is shown as "coming_soon".
const REPLICATE_MAP: Record<string, string> = {
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
    const replicateKey = Deno.env.get("REPLICATE_API_KEY");
    if (!replicateKey) {
      return json({ error: "REPLICATE_API_KEY not configured", code: "config_missing", retryable: false }, 500);
    }
    const slug = REPLICATE_MAP[modelId];
    const images: string[] = [];
    const errors: MappedError[] = [];
    for (let i = 0; i < count; i++) {
      if (req.signal.aborted) {
        errors.push({ code: "canceled", message: "Canceled by user.", retryable: true });
        break;
      }
      try {
        const url = await runReplicate(slug, prompt, body, replicateKey, req.signal);
        if (url) images.push(url);
        else errors.push({ code: "empty_output", message: "Replicate returned no image URL.", retryable: true });
      } catch (err) {
        errors.push(mapReplicateError(err));
      }
    }
    if (!images.length) {
      const primary = errors[0] ?? { code: "unknown", message: "Generation failed", retryable: true };
      await logGenerationErrors(req, "replicate", modelId, body, errors);
      return json({ error: primary.message, code: primary.code, retryable: primary.retryable, details: errors }, primary.status ?? 502);
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
        });
      } else {
        const ar = body.aspect_ratio;
        const sz = body.size;
        const hints: string[] = [];
        if (ar) hints.push(`Aspect ratio: ${ar}.`);
        if (sz && ["1K", "2K", "4K"].includes(sz)) hints.push(`Output resolution: ${sz}.`);
        const fullPrompt = hints.length ? `${prompt}\n\n${hints.join(" ")}` : prompt;
        const payload: Record<string, unknown> = {
          model: gatewayModel,
          messages: [{ role: "user", content: fullPrompt }],
          modalities: ["image", "text"],
        };
        const budget = Number(body.thinking_budget ?? 0);
        if (budget > 0 && gatewayModel.includes("gemini-3-pro")) {
          payload.reasoning = { effort: budget >= 5000 ? "high" : "low" };
        }
        res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
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
        imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      }
      if (imageUrl) images.push(imageUrl);
      else errors.push("no image in response");
    } catch (err) {
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
): Promise<string | undefined> {
  const input = buildReplicateInput(slug, prompt, body);

  const createRes = await fetch(
    `https://api.replicate.com/v1/models/${slug}/predictions`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Prefer": "wait=60",
      },
      body: JSON.stringify({ input }),
    },
  );

  if (createRes.status === 402) {
    throw new ReplicateError("Replicate account has no credit. Enable billing at replicate.com/account/billing.", { code: "quota_exhausted", status: 402, retryable: false });
  }
  if (createRes.status === 401 || createRes.status === 403) {
    throw new ReplicateError("Replicate rejected the API key. Reconnect the Replicate integration.", { code: "auth_failed", status: createRes.status, retryable: false });
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
  const started = Date.now();
  while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
    if (Date.now() - started > 180_000) {
      throw new ReplicateError("Replicate timed out after 3 minutes.", { code: "timeout", retryable: true });
    }
    await new Promise((r) => setTimeout(r, 2000));
    const pollUrl = pred?.urls?.get;
    if (!pollUrl) throw new ReplicateError("Replicate did not return a poll URL.", { code: "provider_error", retryable: true });
    const r = await fetch(pollUrl, { headers: { "Authorization": `Bearer ${key}` } });
    if (!r.ok) throw new ReplicateError(`Replicate poll failed (${r.status}).`, { code: "provider_error", status: r.status, retryable: true });
    pred = await r.json();
  }

  if (pred.status === "canceled") {
    throw new ReplicateError("Replicate prediction was canceled.", { code: "canceled", retryable: true });
  }
  if (pred.status !== "succeeded") {
    const rawErr = typeof pred.error === "string" ? pred.error : JSON.stringify(pred.error ?? "unknown");
    const classified = classifyModelError(rawErr);
    throw new ReplicateError(classified.message, { code: classified.code, retryable: classified.retryable, raw: rawErr });
  }

  const out = pred.output;
  const url: string | undefined = Array.isArray(out) ? out[0] : typeof out === "string" ? out : undefined;
  return url;
}

type MappedError = { code: string; message: string; retryable: boolean; status?: number; raw?: string };

class ReplicateError extends Error {
  code: string;
  status?: number;
  retryable: boolean;
  raw?: string;
  constructor(message: string, opts: { code: string; status?: number; retryable: boolean; raw?: string }) {
    super(message);
    this.code = opts.code;
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.raw = opts.raw;
  }
}

function mapReplicateError(err: unknown): MappedError {
  if (err instanceof ReplicateError) {
    return { code: err.code, message: err.message, retryable: err.retryable, status: err.status, raw: err.raw };
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
