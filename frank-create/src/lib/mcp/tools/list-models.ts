import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, notAuthenticated, supabaseForUser, textResult } from "../supabase";

export default defineTool({
  name: "list_models",
  title: "List generation models",
  description:
    "List the image and video models available in the studio with their supported aspect ratios, resolutions and reference-image limits.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated;
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("model_capabilities")
      .select(
        "model_key, provider, label, blurb, supports_editing, supports_multi_reference, max_reference_images, supported_aspect_ratios, supported_resolutions",
      )
      .order("model_key", { ascending: true });
    if (error) return errorResult(error.message);
    return textResult({ models: data ?? [] });
  },
});
