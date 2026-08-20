---
name: craft-image-prompts
description: Turn reference images, product shots, layouts, creative briefs, and revision notes into precise production-ready prompts for AI image generation or editing. Use for photorealistic campaign imagery, product compositions, scene recreation, reference-led substitutions, prompt refinement, negative prompts, image-model handoff, or iterative visual changes where composition, materials, lighting, camera, typography, packaging, and locked details must be controlled.
---

# Craft Image Prompts

Build prompts that translate visual intent into observable, prioritized instructions. Treat reference images as evidence, not decoration.

## Workflow

1. Inspect every supplied image before drafting.
2. Assign each image a role:
   - composition or camera reference
   - product or subject reference
   - lighting or material reference
   - environment or colour reference
   - styling or mood reference
3. Extract the visible facts that matter: count, order, proportions, placement, overlap, orientation, scale, materials, colours, lighting, focus, background, typography, and exclusions.
4. Separate confirmed facts from choices still requiring direction.
5. Ask only high-impact clarifying questions that would materially change the result. Group them in a numbered list with concise answer options.
6. Once answered, write a structured final prompt using the blueprint in [references/prompt-blueprint.md](references/prompt-blueprint.md).
7. If the user asks to create the image, invoke the available image-generation tool with the final prompt and all required reference images.
8. For revisions, preserve every unmentioned element and express only the requested deltas clearly.

## Reference Hierarchy

Resolve conflicting references explicitly. Default to this hierarchy unless the user states otherwise:

1. Latest written instruction
2. Product or subject reference for identity and physical accuracy
3. Composition reference for placement, crop, and camera
4. Lighting or environment reference for atmosphere and surface treatment
5. General aesthetic language

State the hierarchy inside the prompt when confusion is likely, for example: "Use image A only for composition; use images B-D for exact product shape, colour, and artwork."

## Clarifying Questions

Do not ask about details already visible or answered. Prioritize:

- output ratio and final use
- which reference controls each visual attribute
- exact subject count, order, and relative scale
- crop, camera angle, and negative space
- overlap, contact, suspension, or grounding
- label and typography fidelity
- material finish and colour accuracy
- lighting direction, hardness, and shadow behaviour
- depth of field and motion treatment
- elements that must remain unchanged

If the request is already sufficiently constrained, draft immediately.

## Prompt Construction

Lead with one compact sentence defining the deliverable, subject, setting, and visual standard. Then organize instructions by visual system rather than repeating adjectives.

Use concrete, observable language:

- "shorter and wider cylindrical jar" instead of "better proportions"
- "pump locked and pointing right" instead of "correct pump"
- "sharp-edged shadow extending down-left" instead of "dramatic lighting"
- "front label facing camera and unobstructed" instead of "show the branding"

Describe relationships as well as objects: left/right, above/below, behind/in front, overlap percentage, contact points, relative height, angle, and visual flow.

Include exact colour values when supplied, but also describe perceived colour and surface response so lighting does not shift the result unexpectedly.

For packaging text, require correct hierarchy, placement, and legibility, while acknowledging that generation models may not reproduce long copy perfectly. Recommend a clean artwork pass in design software when exact legal or production text is essential.

Avoid contradictory instructions, decorative prose, unsupported camera jargon, and duplicate constraints.

## Revision Mode

Treat phrases such as "keep all other details the same" as a hard lock.

1. Identify the exact changed attributes.
2. Restate the locked attributes most likely to drift.
3. Keep product count, composition, crop, lighting, background, and unrelated styling unchanged unless the revision necessarily affects them.
4. For image editing, use a delta prompt beginning with the requested change and ending with the preservation clause.

Example:

> Make the cream and blue jars shorter in height and slightly wider. Preserve their colours, labels, lid dimensions, positions, rotations, lighting, cascading contact points, background, framing, and every other detail unchanged.

## Quality Check

Before delivery, verify:

- every reference has a defined role
- subject count and order are unambiguous
- proportions and spatial relationships are described
- camera, crop, lighting, shadows, materials, and focus agree
- typography expectations are realistic
- the negative prompt does not contradict desired features
- requested unchanged details are locked during revisions
- the prompt is detailed without repeating itself
