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
  name: "get_session",
  title: "Get session detail",
  description:
    "Read one of the signed-in user's sessions: its prompts (messages) and the assets generated in it.",
  inputSchema: {
    session_id: z.string().describe("The session id (uuid)."),
    include_urls: z
      .boolean()
      .describe("Include a temporary signed download URL for each asset.")
      .optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ session_id, include_urls }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);

    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, title, active_model_key, active_preset_id, settings_json, created_at, updated_at")
      .eq("id", session_id)
      .maybeSingle();
    if (sessionError) return errorResult(sessionError.message);
    if (!session) return errorResult(`No session ${session_id} for this user.`);

    const [{ data: messages, error: messagesError }, { data: assets, error: assetsError }] =
      await Promise.all([
        supabase
          .from("messages")
          .select("id, seq, role, message_type, prompt_text, created_at")
          .eq("session_id", session_id)
          .order("seq", { ascending: true }),
        supabase
          .from("assets")
          .select("id, asset_type, model_key, storage_path, prompt_snapshot, metadata_json, created_at")
          .eq("session_id", session_id)
          .order("created_at", { ascending: false }),
      ]);
    if (messagesError) return errorResult(messagesError.message);
    if (assetsError) return errorResult(assetsError.message);

    const rows = assets ?? [];
    const enriched = await Promise.all(
      rows.map(async (asset) => {
        const meta = (asset.metadata_json ?? {}) as Record<string, unknown>;
        return {
          id: asset.id,
          asset_type: asset.asset_type,
          model_key: asset.model_key,
          approval_status: (meta.approval_status as string | undefined) ?? "none",
          width: meta.width ?? null,
          height: meta.height ?? null,
          aspect_ratio: meta.aspect_ratio ?? null,
          prompt: asset.prompt_snapshot,
          created_at: asset.created_at,
          url: include_urls ? await signedAssetUrl(supabase, asset.storage_path) : undefined,
        };
      }),
    );

    return textResult({ session, messages: messages ?? [], assets: enriched });
  },
});
