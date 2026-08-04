# Always-on Craft Image Prompts skill in the Prompt Generator

Every message sent to the Prompt Generator will run through the uploaded `craft-image-prompts` skill and its Production Prompt Blueprint, regardless of which skill chip is selected.

## Behaviour

- The skill becomes the agent's base operating method: inspect attached images first, assign each a reference role, extract observable facts, resolve conflicts via the reference hierarchy, and write the final prompt using the blueprint sections (omitting irrelevant ones).
- Revision requests are treated in delta mode: only the requested changes stated, everything unmentioned explicitly locked.
- Clarifying questions follow the skill's rule — only high-impact ones, grouped as a short numbered list, and skipped entirely when the brief is already constrained.
- The existing skill chips (Brief to prompt, Variations, Product shot, Lifestyle, Video prompt, Critique & fix) stay, but now act as a focus layer on top of the always-on craft method rather than replacing it.
- Existing app rules stay in force: no aspect ratio / resolution / seed / model inside prompt text, and every final prompt in its own fenced code block so it can be copied into the composer.
- Negative prompt section only when the target model benefits from one.

## Technical section

- Add the skill text and the blueprint as two constants in `supabase/functions/frank-api/index.ts` inside the `/prompt-agent` handler (a new `CRAFT_SKILL` + `PROMPT_BLUEPRINT` block).
- Compose the system message as: agent identity → craft skill (workflow, reference hierarchy, clarifying questions, prompt construction, revision mode, quality check) → blueprint sections → selected skill chip brief → existing app rules. The chip brief is framed as "focus for this turn", so it narrows output format but cannot override the craft method.
- Keep the model at `openai/gpt-5.6-sol` and the existing multimodal image handling (up to 6 images per user message) unchanged.
- Store the two source docs in the repo for reference: `frank-create/docs/craft-image-prompts/SKILL.md` and `frank-create/docs/craft-image-prompts/prompt-blueprint.md`, so the edge-function text has a tracked origin.
- Update the Prompt Generator header copy in `frank-create/src/components/PromptGenerator.tsx` to state the craft skill is always active.
- Verify with one real `/prompt-agent` request (text-only and one with an attached image) and read the replies to confirm blueprint-structured output.
