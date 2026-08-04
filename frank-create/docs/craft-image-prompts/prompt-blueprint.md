# Production Prompt Blueprint

Use only the sections relevant to the request. Omit empty sections.

## 1. Core Direction

Define:

- image type and realism level
- primary subject count and identity
- setting
- intended campaign, channel, or output
- overall mood

## 2. Reference Usage

State which reference controls:

- composition and camera
- product or subject identity
- lighting
- environment and colour
- material or styling

Call out anything that must not transfer from a reference.

## 3. Format and Framing

Specify:

- aspect ratio and orientation
- crop and safe space
- camera height and viewing angle
- lens feel only when visually meaningful
- centring, asymmetry, or directional flow

## 4. Composition

List subjects in a stable order. For each one, define:

- position in frame
- relative size and physical proportions
- rotation and facing direction
- depth order
- overlap or contact relationship
- visibility requirements

## 5. Subject Accuracy

Define:

- geometry and construction
- exact colours
- materials and finish
- seams, edges, closures, caps, pumps, or hardware
- realistic imperfections and reflections
- prohibited distortions

## 6. Artwork and Typography

Define:

- label orientation
- logo and type hierarchy
- critical words that must remain readable
- artwork placement and curvature
- whether the package should instead remain blank for later design application

## 7. Environment

Define:

- background colour and surface
- horizon visibility
- props and their placement
- environmental depth
- elements to exclude

## 8. Lighting

Define:

- key-light direction, size, and hardness
- fill level
- highlight behaviour
- shadow direction, edge, length, and density
- exposure and colour neutrality
- whether background shadows are desired

## 9. Camera and Focus

Define:

- focus priority
- depth of field
- motion blur or high-speed sharpness
- perspective and distortion limits
- level of retouching and texture retention

## 10. Final Look

Summarize the intended visual impression without adding new requirements.

## 11. Negative Prompt

Include only model-relevant failures, grouped compactly:

- count and identity errors
- geometry and proportion errors
- composition and crop errors
- material and lighting errors
- typography and artwork errors
- unwanted objects or artefacts
- quality failures

Do not use a negative prompt when the target tool does not benefit from one. Keep critical positive constraints in the main prompt rather than relying on negation.

## Delta Edit Template

Use for iterative edits:

> Change [specific subject/attribute] from [current state] to [desired state]. Keep [high-risk locked details] unchanged. Preserve every other aspect of the original image, including [composition, crop, camera, lighting, background, subject count, styling, and artwork as applicable].
