import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, notAuthenticated, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "submit_feedback",
  title: "Submit feedback",
  description: "File a feedback item in the studio on behalf of the signed-in user.",
  inputSchema: {
    message: z.string().describe("The feedback text."),
    page_path: z.string().describe("Optional page or area the feedback is about.").optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ message, page_path }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const text = message.trim();
    if (!text) return errorResult("Feedback message cannot be empty.");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("feedback_items")
      .insert({
        user_id: ctx.getUserId(),
        message: text,
        page_path: page_path ?? "mcp",
        route_name: "mcp",
      })
      .select("id, created_at")
      .maybeSingle();
    if (error) return errorResult(error.message);
    return textResult({ submitted: true, id: data?.id ?? null, created_at: data?.created_at ?? null });
  },
});
