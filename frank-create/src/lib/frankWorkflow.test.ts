import { describe, expect, it } from "vitest";

import { createBriefPayload } from "./frankWorkflow";

describe("frankWorkflow", () => {
  it("normalizes a product-shot brief for persistence", () => {
    const payload = createBriefPayload(
      {
        productName: "  Cacao Coffee Scrub  ",
        title: "",
        taskType: "background-replace",
        channel: "PDP",
        tone: "Cheeky but premium",
        prompt: "  Warm tiled bathroom, soft flash.  ",
        negativePrompt: "messy counter"
      },
      "project-1",
      "input/cacao.png"
    );

    expect(payload).toMatchObject({
      project_id: "project-1",
      title: "Cacao Coffee Scrub product shot",
      product_name: "Cacao Coffee Scrub",
      task_type: "background-replace",
      channel: "PDP",
      tone: "Cheeky but premium",
      prompt: "Warm tiled bathroom, soft flash.",
      negative_prompt: "messy counter",
      reference_image_path: "input/cacao.png",
      status: "draft"
    });
  });

});
