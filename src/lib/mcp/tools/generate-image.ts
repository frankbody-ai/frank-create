import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, textResult } from "../supabase";
import { assetSummary, frankFetch, pollRun, type FrankTurnResponse } from "../frankApi";

export default defineTool({
  name: "generate_image",
  title: "Generate images",
  description:
    "Run an image generation in the studio exactly as the app does: a prompt, a model, aspect ratio, size, how many variations, and optional reference image URLs. Returns download URLs for the finished images. Use list_studio_options first for valid model ids, aspect ratios and sizes.",
  inputSchema: {
    prompt: z.string().describe("The full image prompt / brief to render."),
    model: z
      .string()
      .describe("Model id from list_studio_options, e.g. 'nano-banana-pro'. Defaults to nano-banana-pro.")
      .optional(),
    aspect_ratio: z.string().describe("Aspect ratio such as '1:1', '3:4', '16:9'.").optional(),
    size: z.string().describe("Size or quality tier the model allows, e.g. '1K', '2K', '1536x1024'.").optional(),
    count: z.number().int().describe("How many variations to render (1-6).").optional(),
    reference_image_urls: z
      .array(z.string())
      .describe("Public https URLs of reference images to condition on.")
      .optional(),
    session_id: z
      .string()
      .describe("Session to record the run in. Omit to use the caller's default session.")
      .optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const prompt = input.prompt.trim();
    if (!prompt) return errorResult("A prompt is required.");
    const refs = (input.reference_image_urls ?? []).filter((u) => /^https?:\/\//i.test(u));
    try {
      const first = await frankFetch<FrankTurnResponse>(ctx, "/inference/turn", {
        method: "POST",
        body: {
          session_id: input.session_id,
          kind: refs.length ? "edit" : "generate",
          model: input.model || "nano-banana-pro",
          prompt,
          frank_body_mode: false,
          settings: {
            aspect_ratio: input.aspect_ratio || "1:1",
            image_size: input.size || "",
            count: Math.min(Math.max(input.count ?? 1, 1), 6),
          },
          reference_asset_ids: [],
          reference_image_urls: refs,
        },
      });
      const result = await pollRun(ctx, first);
      if (result.status === "failed" || result.status === "blocked") {
        return errorResult(result.error?.message || "The generation failed.");
      }
      if (result.timed_out) {
        return textResult({
          status: "running",
          turn_id: result.turn?.id ?? null,
          note: "Still rendering. Call check_run with this turn_id in a minute to collect the images.",
        });
      }
      return textResult({
        status: result.status ?? "complete",
        turn_id: result.turn?.id ?? null,
        images: (result.assets ?? []).map(assetSummary),
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
});
