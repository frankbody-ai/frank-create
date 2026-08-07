import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, notAuthenticated, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_presets",
  title: "List prompt presets",
  description:
    "List the active prompt presets in the studio library, including their category and system prompt.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("presets")
      .select("id, name, category, system_prompt, positive_rules, negative_rules, is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (error) return errorResult(error.message);
    return textResult({ presets: data ?? [] });
  },
});
