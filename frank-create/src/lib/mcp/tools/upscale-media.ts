import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, textResult } from "../supabase";
import { assetSummary, frankFetch, pollRun, type FrankTurnResponse } from "../frankApi";

export default defineTool({
  name: "upscale_media",
  title: "Upscale an image or video",
  description:
    "Send an image or video to the studio's upscaler and get the enhanced file back. Source can be a public URL or an asset id from list_assets. Videos and 4x/6x image jobs can outlast the call — you then get a turn_id to poll with check_run.",
  inputSchema: {
    source_url: z.string().describe("Public https URL of the image or video to upscale.").optional(),
    source_asset_id: z.string().describe("Asset id from list_assets to upscale instead of a URL.").optional(),
    media: z.enum(["image", "video"]).describe("Media kind. Defaults to image.").optional(),
    model: z
      .string()
      .describe("Upscale model id from list_studio_options. Defaults to topaz-image-upscale / topaz-video-upscale.")
      .optional(),
    upscale_factor: z.enum(["None", "2x", "4x", "6x"]).describe("Image upscale factor.").optional(),
    target_resolution: z.enum(["720p", "1080p", "4k"]).describe("Video target resolution.").optional(),
    session_id: z.string().describe("Session to record the run in.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    if (!input.source_url && !input.source_asset_id) {
      return errorResult("Provide source_url or source_asset_id.");
    }
    const media = input.media ?? "image";
    const model = input.model || (media === "video" ? "topaz-video-upscale" : "topaz-image-upscale");
    try {
      const first = await frankFetch<FrankTurnResponse>(ctx, "/enhance", {
        method: "POST",
        body: {
          session_id: input.session_id,
          model,
          source_asset_id: input.source_asset_id,
          source_url: input.source_url,
          settings: {
            media,
            ...(media === "image"
              ? { upscale_factor: input.upscale_factor ?? "2x", output_format: "png" }
              : { target_resolution: input.target_resolution ?? "1080p" }),
          },
        },
      });
      const result = await pollRun(ctx, first);
      if (result.status === "failed" || result.status === "blocked") {
        return errorResult(result.error?.message || "The upscale failed.");
      }
      if (result.timed_out) {
        return textResult({
          status: "running",
          turn_id: result.turn?.id ?? null,
          note: "Still upscaling. Call check_run with this turn_id to collect the result.",
        });
      }
      return textResult({
        status: result.status ?? "complete",
        turn_id: result.turn?.id ?? null,
        outputs: (result.assets ?? []).map(assetSummary),
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
});
