import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_sessions",
  title: "List studio sessions",
  description:
    "List the signed-in user's generation sessions (newest first) with their title, active model and preset.",
  inputSchema: {
    limit: z.number().int().describe("How many sessions to return (1-50).").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const take = Math.min(Math.max(limit ?? 20, 1), 50);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("sessions")
      .select("id, title, active_model_key, active_preset_id, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(take);
    if (error) return errorResult(error.message);
    return textResult({ sessions: data ?? [] });
  },
});
