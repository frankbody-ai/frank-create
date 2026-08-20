import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, textResult } from "../supabase";
import { assetSummary, frankFetch, type FrankAsset } from "../frankApi";

export default defineTool({
  name: "list_assets",
  title: "List recent assets",
  description:
    "List the caller's recent studio images and videos with download URLs and asset ids — useful for picking an upscale source or re-sending a reference.",
  inputSchema: {
    session_id: z.string().describe("Only assets from this session.").optional(),
    media: z.enum(["image", "video"]).describe("Filter by media kind.").optional(),
    limit: z.number().int().describe("How many assets to return (1-50). Defaults to 20.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id, media, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    const query = session_id ? `?session_id=${encodeURIComponent(session_id)}` : "";
    try {
      const data = await frankFetch<{ assets?: FrankAsset[] }>(ctx, `/assets${query}`);
      const rows = (data.assets ?? [])
        .filter((a) => (media ? (a.media_type ?? "image") === media : true))
        .slice(0, take);
      return textResult({ assets: rows.map(assetSummary) });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
});
