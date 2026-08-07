import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "set_asset_approval",
  title: "Approve or reject an asset",
  description:
    "Set the approval status of one of the signed-in user's assets and record the change in the audit trail.",
  inputSchema: {
    asset_id: z.string().describe("The asset id (uuid)."),
    status: z.enum(["approved", "rejected", "review"]).describe("New approval status."),
    note: z.string().describe("Optional note stored with the audit event.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ asset_id, status, note }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);

    const { data: asset, error: readError } = await supabase
      .from("assets")
      .select("id, session_id, metadata_json")
      .eq("id", asset_id)
      .maybeSingle();
    if (readError) return errorResult(readError.message);
    if (!asset) return errorResult(`No asset ${asset_id} for this user.`);

    const meta = { ...((asset.metadata_json ?? {}) as Record<string, unknown>) };
    const previous = (meta.approval_status as string | undefined) ?? null;
    meta.approval_status = status;

    const { error: updateError } = await supabase
      .from("assets")
      .update({ metadata_json: meta })
      .eq("id", asset_id);
    if (updateError) return errorResult(updateError.message);

    const { error: eventError } = await supabase.from("asset_approval_events").insert({
      asset_id,
      session_id: asset.session_id,
      user_id: ctx.getUserId(),
      prev_status: previous,
      new_status: status,
      note: note ?? null,
    });

    return textResult({
      asset_id,
      previous_status: previous ?? "none",
      approval_status: status,
      audit_recorded: !eventError,
      audit_error: eventError?.message ?? null,
    });
  },
});
