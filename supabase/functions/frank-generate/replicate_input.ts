// Per-slug Replicate input builders. Extracted for direct unit testing.
// Guarantees every generation request carries reference URLs in the field
// each model's Replicate schema expects.

export type BuildBody = {
  aspect_ratio?: string;
  size?: string;
  reference_images?: string[];
};

export function withReferenceIdentityLock(prompt: string, referenceCount: number): string {
  return [
    `STRICT REFERENCE REQUIREMENT: ${referenceCount} image reference${referenceCount === 1 ? " is" : "s are"} attached and must define the product identity.`,
    "Use the reference image(s) for the exact product/packaging/logo/colors/label/shape/material details.",
    "Do not replace the reference product with another object, animal product, shipping box, generic pack, different brand, or invented label.",
    "If the user asks for a product, pack, box, bottle, tube, or object, it means the product shown in the attached reference image(s).",
    prompt,
  ].join("\n");
}

// Every supported slug + which reference field it must land in on Replicate.
export const REFERENCE_FIELD_BY_SLUG: Record<string, "reference_images" | "image_input" | "input_images"> = {
  "reve/reve-2.1": "reference_images",
  "bytedance/seedream-5-pro": "image_input",
  "google/nano-banana-pro": "image_input",
  "google/nano-banana-2": "image_input",
  "openai/gpt-image-2": "input_images",
};

export function buildReplicateInput(
  slug: string,
  prompt: string,
  body: BuildBody,
): Record<string, unknown> {
  const refs = Array.isArray(body.reference_images)
    ? body.reference_images.map((url) => typeof url === "string" ? url.trim() : "").filter(Boolean)
    : [];
  const lockedPrompt = refs.length ? withReferenceIdentityLock(prompt, refs.length) : prompt;

  if (slug === "reve/reve-2.1") {
    const REVE_AR = new Set([
      "auto","1:1","4:3","3:4","3:2","2:3","16:9","9:16",
      "5:4","4:5","21:9","17:9","2:1","1:2","3:1","1:3","4:1","1:4",
    ]);
    const ar = body.aspect_ratio && REVE_AR.has(body.aspect_ratio) ? body.aspect_ratio : "auto";
    const input: Record<string, unknown> = { prompt: lockedPrompt, aspect_ratio: ar };
    if (refs.length) input.reference_images = refs.slice(0, 8);
    return input;
  }

  if (slug === "bytedance/seedream-5-pro") {
    const SEEDREAM_AR = new Set([
      "match_input_image","1:1","4:3","3:4","16:9","9:16","3:2","2:3","21:9",
    ]);
    const size = body.size === "2K" ? "2K" : "1K";
    const ar = body.aspect_ratio && SEEDREAM_AR.has(body.aspect_ratio)
      ? body.aspect_ratio
      : (refs.length ? "match_input_image" : "1:1");
    const input: Record<string, unknown> = {
      prompt: lockedPrompt,
      size,
      aspect_ratio: ar,
      output_format: "png",
    };
    if (refs.length) input.image_input = refs.slice(0, 10);
    return input;
  }

  if (slug === "google/nano-banana-pro" || slug === "google/nano-banana-2") {
    const NB_PRO_AR = new Set([
      "match_input_image", "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9",
    ]);
    const NB2_AR = new Set([
      "match_input_image", "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
    ]);
    const allowed = slug === "google/nano-banana-pro" ? NB_PRO_AR : NB2_AR;
    const ar = body.aspect_ratio && allowed.has(body.aspect_ratio)
      ? body.aspect_ratio
      : (refs.length ? "match_input_image" : "1:1");
    const resolution = body.size === "4K" ? "4K" : body.size === "2K" ? "2K" : "1K";
    const input: Record<string, unknown> = {
      prompt: lockedPrompt,
      aspect_ratio: ar,
      resolution,
      output_format: "png",
    };
    if (refs.length) input.image_input = refs.slice(0, 14);
    return input;
  }

  if (slug === "openai/gpt-image-2") {
    const RATIO_AR = new Set(["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"]);
    const PIXEL_AR = new Set([
      "1024x1024", "1536x1024", "1024x1536",
      "1536x1152", "1152x1536",
      "2048x2048", "2048x1152", "1152x2048",
      "3840x2160", "2160x3840",
    ]);
    let aspect: string = "1:1";
    if (body.size && PIXEL_AR.has(body.size)) aspect = body.size;
    else if (body.size && RATIO_AR.has(body.size)) aspect = body.size;
    else if (body.aspect_ratio && RATIO_AR.has(body.aspect_ratio)) aspect = body.aspect_ratio;
    else if (body.aspect_ratio && PIXEL_AR.has(body.aspect_ratio)) aspect = body.aspect_ratio;
    const input: Record<string, unknown> = {
      prompt: lockedPrompt,
      aspect_ratio: aspect,
      quality: "auto",
      number_of_images: 1,
      output_format: "png",
    };
    if (refs.length) input.input_images = refs.slice(0, 10);
    return input;
  }

  return { prompt };
}
