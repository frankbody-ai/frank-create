// End-to-end guarantee: every supported model's Replicate input carries
// the reference URLs in the schema field that model actually reads.
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildReplicateInput,
  REFERENCE_FIELD_BY_SLUG,
} from "./replicate_input.ts";

const REFS = [
  "https://example.supabase.co/storage/v1/object/sign/studio-images/ref-a.png?token=aaa",
  "https://example.supabase.co/storage/v1/object/sign/studio-images/ref-b.png?token=bbb",
  "https://example.supabase.co/storage/v1/object/sign/studio-images/ref-c.png?token=ccc",
];

Deno.test("every model routes reference_images into the correct Replicate field", () => {
  for (const [slug, field] of Object.entries(REFERENCE_FIELD_BY_SLUG)) {
    const input = buildReplicateInput(slug, "a hero shot of the product", {
      reference_images: REFS,
    });
    const value = input[field];
    assert(Array.isArray(value), `[${slug}] expected array at "${field}", got ${typeof value}`);
    assertEquals(value as string[], REFS, `[${slug}] reference URLs must be forwarded verbatim`);
    // No reference URLs should leak into any *other* reference field.
    for (const other of ["reference_images", "image_input", "input_images"]) {
      if (other === field) continue;
      assertEquals(input[other], undefined, `[${slug}] must not populate "${other}"`);
    }
    // Identity-lock prompt should be applied when refs are present.
    assert(
      String(input.prompt).includes("STRICT REFERENCE REQUIREMENT"),
      `[${slug}] identity lock missing from prompt`,
    );
  }
});

Deno.test("reference arrays are capped to each model's documented max", () => {
  const many = Array.from({ length: 20 }, (_, i) => `https://x/${i}.png`);
  const caps: Record<string, number> = {
    "reve/reve-2.1": 8,
    "bytedance/seedream-5-pro": 10,
    "google/nano-banana-pro": 14,
    "google/nano-banana-2": 14,
    "openai/gpt-image-2": 10,
  };
  for (const [slug, cap] of Object.entries(caps)) {
    const field = REFERENCE_FIELD_BY_SLUG[slug];
    const input = buildReplicateInput(slug, "p", { reference_images: many });
    const arr = input[field] as string[];
    assertEquals(arr.length, cap, `[${slug}] expected cap ${cap}, got ${arr.length}`);
    assertEquals(arr[0], many[0]);
  }
});

Deno.test("no reference field is set when the caller sends none", () => {
  for (const slug of Object.keys(REFERENCE_FIELD_BY_SLUG)) {
    const input = buildReplicateInput(slug, "prompt only", {});
    for (const key of ["reference_images", "image_input", "input_images"]) {
      assertEquals(input[key], undefined, `[${slug}] should not include "${key}" when no refs`);
    }
    assertEquals(input.prompt, "prompt only", `[${slug}] prompt should be untouched without refs`);
  }
});

Deno.test("empty / whitespace URLs are filtered before being sent to Replicate", () => {
  const dirty = ["", "  ", ...REFS];
  for (const slug of Object.keys(REFERENCE_FIELD_BY_SLUG)) {
    const field = REFERENCE_FIELD_BY_SLUG[slug];
    const input = buildReplicateInput(slug, "p", { reference_images: dirty as string[] });
    const arr = input[field] as string[];
    assert(!arr.includes("  "), `[${slug}] whitespace-only strings must be dropped`);
    assert(arr.every((u) => u.trim().length > 0), `[${slug}] empty strings must be dropped`);
    assert(arr.includes(REFS[0]), `[${slug}] real URL missing after filtering`);
  }
});
