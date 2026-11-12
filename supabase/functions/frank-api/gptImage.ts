// OpenAI GPT Image on OpenRouter: which models, which old studio ids now point
// at them, and the OpenAI-only fields a run may send. Kept apart from index.ts
// so it can be tested without booting the function.

/**
 * OpenAI GPT Image 2.6 on OpenRouter (Images 2.6, November 2026): Sunburst is
 * the precision model, Flare the fast one. Ids from GET /api/v1/images/models.
 */
export const GPT_IMAGE_MODELS = new Set<string>([
  "openai/gpt-image-2.6-sunburst",
  "openai/gpt-image-2.6-flare",
]);

/**
 * Studio model ids that were replaced (12 November 2026: GPT Image 2.5 by 2.6).
 * A run that still names an old id (a tab open on the old app, or a past round
 * run again) goes to the model that replaced it.
 */
export const RETIRED_IMAGE_MODEL_IDS: Record<string, string> = {
  "openai-gpt-image-2-5-sunburst": "openai-gpt-image-2-6-sunburst",
  "openai-gpt-image-2-5-flare": "openai-gpt-image-2-6-flare",
};

export function currentImageModelId(id: string): string {
  return RETIRED_IMAGE_MODEL_IDS[id] ?? id;
}

/** Aspect ratios OpenRouter lists for GPT Image 2.6 (no 4:5, 5:4, ...). */
export const GPT_IMAGE_ASPECT_RATIOS = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16", "21:9"];

/**
 * A ratio carried over from another model would fail the whole run, so it
 * snaps to the nearest ratio GPT Image takes. A ratio that is not a number
 * (for example "auto") becomes "auto".
 */
export function nearestGptImageAspect(aspect: string): string {
  if (GPT_IMAGE_ASPECT_RATIOS.includes(aspect)) return aspect;
  const toNum = (r: string) => {
    const [w, h] = r.split(":").map(Number);
    return w / h;
  };
  const want = toNum(aspect);
  if (!Number.isFinite(want) || want <= 0) return "auto";
  return GPT_IMAGE_ASPECT_RATIOS.reduce(
    (best, r) => (Math.abs(Math.log(toNum(r) / want)) < Math.abs(Math.log(toNum(best) / want)) ? r : best),
    "1:1",
  );
}

export type GptImageOptions = {
  background?: string;
  moderation?: string;
  outputCompression?: number | string | null;
};

/**
 * The OpenAI-only fields of a GPT Image run. OpenAI's Images API rules:
 * - a "transparent" background needs png or webp output;
 * - output_compression works only with jpeg or webp output.
 * So compression under 100 returns a jpeg, or a webp when the background is
 * transparent. At 100 (or not set) the file stays a full-quality png.
 */
export function gptImageFields(opts: GptImageOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (opts.background && ["auto", "opaque", "transparent"].includes(opts.background)) {
    out.background = opts.background;
  }
  if (opts.moderation && ["auto", "low"].includes(opts.moderation)) out.moderation = opts.moderation;

  const raw = opts.outputCompression;
  const compression = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  const smaller = Number.isFinite(compression) && compression >= 0 && compression < 100;
  if (out.background === "transparent") {
    out.output_format = smaller ? "webp" : "png";
    if (smaller) out.output_compression = Math.round(compression);
  } else if (smaller) {
    out.output_format = "jpeg";
    out.output_compression = Math.round(compression);
  }
  return out;
}

/**
 * What OpenRouter said about a finished image call: its id, the model that ran
 * and the usage it billed. Stored on the round so a run shows which model
 * really answered and what it cost. Null when the answer carries none of these.
 */
export function providerUsageRecord(response: unknown): Record<string, unknown> | null {
  if (!response || typeof response !== "object") return null;
  const r = response as Record<string, unknown>;
  const record: Record<string, unknown> = {};
  if (typeof r.id === "string") record.id = r.id;
  if (typeof r.model === "string") record.model = r.model;
  if (r.usage && typeof r.usage === "object") record.usage = r.usage;
  return Object.keys(record).length ? record : null;
}
