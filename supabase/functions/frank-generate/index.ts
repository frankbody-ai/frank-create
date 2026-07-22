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
      return json({ error: "REPLICATE_API_KEY not configured" }, 500);
    }
    const slug = REPLICATE_MAP[modelId];
    const images: string[] = [];
    const errors: string[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const url = await runReplicate(slug, prompt, body, replicateKey);
        if (url) images.push(url);
        else errors.push("no image from replicate");
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    if (!images.length) return json({ error: "Generation failed", details: errors }, 502);
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
    return json({ error: "Generation failed", details: errors }, 502);
  }

  return json({ images, errors: errors.length ? errors : undefined });
});

// Call a Replicate official model, poll until finished, return first output URL.
async function runReplicate(
  slug: string,
  prompt: string,
  body: { aspect_ratio?: string; size?: string },
  key: string,
): Promise<string | undefined> {
  const aspect = body.aspect_ratio || "1:1";
  const input: Record<string, unknown> = { prompt, aspect_ratio: aspect };
  // Common optional fields — Replicate ignores unknown fields per-model.
  if (body.size === "2K" || body.size === "4K") input.size = body.size.toLowerCase();

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

  if (createRes.status === 402) throw new Error("Replicate account has no credit");
  if (!createRes.ok) {
    const t = await createRes.text();
    throw new Error(`replicate ${createRes.status}: ${t.slice(0, 200)}`);
  }

  let pred = await createRes.json();
  const started = Date.now();
  // Poll up to 3 minutes if not already done (Prefer: wait usually returns terminal).
  while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
    if (Date.now() - started > 180_000) throw new Error("replicate timeout");
    await new Promise((r) => setTimeout(r, 2000));
    const pollUrl = pred?.urls?.get;
    if (!pollUrl) throw new Error("replicate: missing poll url");
    const r = await fetch(pollUrl, { headers: { "Authorization": `Bearer ${key}` } });
    if (!r.ok) throw new Error(`replicate poll ${r.status}`);
    pred = await r.json();
  }

  if (pred.status !== "succeeded") {
    throw new Error(`replicate ${pred.status}: ${pred.error ?? "unknown"}`);
  }

  const out = pred.output;
  const url: string | undefined = Array.isArray(out) ? out[0] : typeof out === "string" ? out : undefined;
  return url;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
