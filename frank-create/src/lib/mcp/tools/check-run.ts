import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, textResult } from "../supabase";
import { assetSummary, frankFetch, type FrankTurnResponse } from "../frankApi";

export default defineTool({
  name: "check_run",
  title: "Check a run",
  description:
    "Check a generation or upscale run by its turn_id and collect the finished files. Use this when generate_image or upscale_media returned status 'running'.",
  inputSchema: {
    turn_id: z.string().describe("The turn id returned by generate_image or upscale_media."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ turn_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    try {
      const result = await frankFetch<FrankTurnResponse>(ctx, "/inference/status", {
        method: "POST",
        body: { turn_id },
      });
      if (result.status === "failed") {
        return errorResult(result.error?.message || "The run failed.");
      }
      return textResult({
        status: result.status ?? "running",
        turn_id,
        outputs: (result.assets ?? []).map(assetSummary),
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
});
