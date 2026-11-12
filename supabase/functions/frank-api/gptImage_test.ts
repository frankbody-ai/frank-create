import { assertEquals } from "jsr:@std/assert@1";
import {
  currentImageModelId,
  GPT_IMAGE_MODELS,
  gptImageFields,
  nearestGptImageAspect,
  providerUsageRecord,
} from "./gptImage.ts";

Deno.test("GPT Image runs on the 2.6 models only", () => {
  assertEquals([...GPT_IMAGE_MODELS], ["openai/gpt-image-2.6-sunburst", "openai/gpt-image-2.6-flare"]);
});

Deno.test("an old GPT Image 2.5 id runs on the 2.6 model that replaced it", () => {
  assertEquals(currentImageModelId("openai-gpt-image-2-5-sunburst"), "openai-gpt-image-2-6-sunburst");
  assertEquals(currentImageModelId("openai-gpt-image-2-5-flare"), "openai-gpt-image-2-6-flare");
  assertEquals(currentImageModelId("openai-gpt-image-2-6-flare"), "openai-gpt-image-2-6-flare");
  assertEquals(currentImageModelId("google-nb-2-1"), "google-nb-2-1");
});

Deno.test("a ratio GPT Image does not take snaps to the nearest one", () => {
  assertEquals(nearestGptImageAspect("16:9"), "16:9");
  assertEquals(nearestGptImageAspect("4:5"), "3:4");
  assertEquals(nearestGptImageAspect("5:4"), "4:3");
  assertEquals(nearestGptImageAspect("1:4"), "9:16");
  assertEquals(nearestGptImageAspect("auto"), "auto");
});

Deno.test("full quality stays a png with no compression field", () => {
  assertEquals(gptImageFields({ background: "auto", moderation: "auto", outputCompression: 100 }), {
    background: "auto",
    moderation: "auto",
  });
  assertEquals(gptImageFields({ outputCompression: null }), {});
  assertEquals(gptImageFields({}), {});
});

Deno.test("compression under 100 returns a jpeg", () => {
  assertEquals(gptImageFields({ background: "opaque", outputCompression: 60 }), {
    background: "opaque",
    output_format: "jpeg",
    output_compression: 60,
  });
  assertEquals(gptImageFields({ outputCompression: "45.4" }), { output_format: "jpeg", output_compression: 45 });
});

Deno.test("a transparent background is a png, or a webp when compressed", () => {
  assertEquals(gptImageFields({ background: "transparent", outputCompression: 100 }), {
    background: "transparent",
    output_format: "png",
  });
  assertEquals(gptImageFields({ background: "transparent", outputCompression: 70 }), {
    background: "transparent",
    output_format: "webp",
    output_compression: 70,
  });
});

Deno.test("values OpenAI does not list are not sent", () => {
  assertEquals(gptImageFields({ background: "white", moderation: "off", outputCompression: 140 }), {});
  assertEquals(gptImageFields({ outputCompression: -5 }), {});
});

Deno.test("the usage record keeps only what OpenRouter returned", () => {
  assertEquals(providerUsageRecord(null), null);
  assertEquals(providerUsageRecord({ data: [] }), null);
  assertEquals(
    providerUsageRecord({ id: "gen-1", model: "openai/gpt-image-2.6-flare", usage: { cost: 0.01 }, data: [{}] }),
    { id: "gen-1", model: "openai/gpt-image-2.6-flare", usage: { cost: 0.01 } },
  );
});
