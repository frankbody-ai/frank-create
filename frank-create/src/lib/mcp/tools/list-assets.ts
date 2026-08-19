import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  errorResult,
  notAuthenticated,
  signedAssetUrl,
  supabaseForUser,
  textResult,
} from "../supabase";

export default defineTool({
  name: "list_assets",
  title: "List generated assets",
  description:
    "List the signed-in user's generated images and videos, newest first, optionally filtered by session or media type.",
  inputSchema: {
    session_id: z.string().describe("Only assets from this session id.").optional(),
    asset_type: z.enum(["image", "video"]).describe("Filter by media type.").optional(),
    limit: z.number().int().describe("How many assets to return (1-50).").optional(),
    include_urls: z.boolean().describe("Include temporary signed download URLs.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id, asset_type, limit, include_urls }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("assets")
      .select("id, session_id, asset_type, model_key, storage_path, prompt_snapshot, metadata_json, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (session_id) query = query.eq("session_id", session_id);
    if (asset_type) query = query.eq("asset_type", asset_type);

    const { data, error } = await query;
    if (error) return errorResult(error.message);

    const assets = await Promise.all(
      (data ?? []).map(async (asset) => {
        const meta = (asset.metadata_json ?? {}) as Record<string, unknown>;
        return {
          id: asset.id,
          session_id: asset.session_id,
          asset_type: asset.asset_type,
          model_key: asset.model_key,
          width: meta.width ?? null,
          height: meta.height ?? null,
          aspect_ratio: meta.aspect_ratio ?? null,
          prompt: asset.prompt_snapshot,
          created_at: asset.created_at,
          url: include_urls ? await signedAssetUrl(supabase, asset.storage_path) : undefined,
        };
      }),
    );

    return textResult({ assets });
  },
});
