import { defineTool } from "@lovable.dev/mcp-js";
import { errorResult, textResult } from "../supabase";
import { frankFetch } from "../frankApi";

type ModelRow = {
  id: string;
  label: string;
  provider?: string;
  status?: string;
  legacy?: boolean;
  description?: string;
  capabilities?: Record<string, unknown>;
  allowed_aspect_ratios?: string[];
  allowed_image_sizes?: string[];
  max_reference_images?: number;
};

export default defineTool({
  name: "list_studio_options",
  title: "List studio options",
  description:
    "Discovery call: the image, video and upscaler models available in the studio with their allowed aspect ratios and sizes, plus the prompt presets. Call this before generate_image or upscale_media to pick valid values.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    try {
      const data = await frankFetch<{ models?: ModelRow[]; promptPresets?: unknown[] }>(
        null,
        "/models",
      );
      const models = (data.models ?? []).filter((m) => !m.legacy);
      const shape = (m: ModelRow) => ({
        id: m.id,
        label: m.label,
        provider: m.provider,
        status: m.status,
        description: m.description ?? null,
        aspect_ratios: m.allowed_aspect_ratios ?? [],
        sizes: m.allowed_image_sizes ?? [],
        max_reference_images: m.max_reference_images ?? null,
      });
      const isUpscale = (m: ModelRow) => m.capabilities?.upscale === true;
      const isVideo = (m: ModelRow) => m.capabilities?.video === true;
      return textResult({
        image_models: models.filter((m) => !isUpscale(m) && !isVideo(m)).map(shape),
        video_models: models.filter((m) => !isUpscale(m) && isVideo(m)).map(shape),
        upscale_models: models.filter(isUpscale).map(shape),
        prompt_presets: data.promptPresets ?? [],
      });
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  },
});
