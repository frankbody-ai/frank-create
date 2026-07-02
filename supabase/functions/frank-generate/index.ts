// Frank Create – Image generation via Lovable AI Gateway.
// Public function: accepts { prompt, count, modelId? } and returns { images: dataUrl[] }.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map studio model id -> Lovable AI Gateway model string
const MODEL_MAP: Record<string, string> = {
  "frank-local-comfy": "google/gemini-2.5-flash-image",
  "google-nb-pro": "google/gemini-3-pro-image-preview",
  "google-nb-2": "google/gemini-3.1-flash-image-preview",
  "openai-gpt-image-2": "openai/gpt-image-2",
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
  const gatewayModel = body.model || MODEL_MAP[modelId] || "google/gemini-2.5-flash-image";
  const useImagesEndpoint = gatewayModel.startsWith("openai/gpt-image");

  // Per-model valid sizes (OpenAI gpt-image-2 only accepts these)
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
        let size = body.size && OPENAI_SIZES.has(body.size) ? body.size : sizeFromAspect(body.aspect_ratio);
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
        // Gemini image models: aspect ratio + size hinted in prompt
        const ar = body.aspect_ratio;
        const sz = body.size;
        const hints: string[] = [];
        if (ar) hints.push(`Aspect ratio: ${ar}.`);
        if (sz && ["1K", "2K", "4K"].includes(sz)) hints.push(`Output resolution: ${sz}.`);
        const fullPrompt = hints.length ? `${prompt}\n\n${hints.join(" ")}` : prompt;
        res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: gatewayModel,
            messages: [{ role: "user", content: fullPrompt }],
            modalities: ["image", "text"],
          }),
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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
