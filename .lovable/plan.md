# Prompt Generator: make it a real conversation before the final prompt

Today the agent almost always answers with a finished prompt on the first message. The chat UI is already multi-turn, but the instructions it runs on tell it to output a fenced prompt every turn — each skill brief ends with "Output the final prompt in a fenced code block", and that overrides step 5 of the Craft Image Prompts skill ("ask only high-impact clarifying questions ... if the request is already sufficiently constrained, draft immediately"). So the clarify step never happens.

## What changes

1. **Two explicit phases**
   - **Discovery**: the agent reads the brief and any attached references, states what it can already see (and each reference's role), then asks a short numbered list of high-impact questions with suggested answer options. No fenced prompt in this phase.
   - **Final**: only after the questions are answered — or after the user says "just draft it" — does it produce the fenced production prompt using the blueprint.
   - Escape hatch kept from the skill: if the first message is already fully constrained (or is a revision/critique of an existing prompt), it may skip straight to Final and say why in one line.
   - Follow-ups after a final prompt stay conversational: refinements return an updated fenced prompt, treating unmentioned details as locked.

2. **Skill briefs stop forcing an immediate prompt**
   Each skill brief is reworded so it describes the *output format once the brief is locked*, not something to emit on turn one. Variations/product-shot/lifestyle/video keep their formats; Critique & fix keeps drafting immediately (it already has the prompt to fix).

3. **UI reflects the conversation**
   - A small phase indicator in the thread header: "Discovery — answering questions" vs "Prompt ready".
   - A "Draft it now" button next to Send that skips remaining questions (sends a short instruction to draft with sensible defaults and state the assumptions).
   - Numbered question lists render as a readable list rather than a wall of text.
   - "Use in Studio" / "Copy prompt" only attach to fenced blocks the agent marks as final, so an example line inside a discovery answer can't be mistaken for the deliverable.
   - The intro copy under "Prompt Generator" explains the flow: brief → a couple of questions → final prompt.

4. **Admin stays in control**
   The new phase rules live in the editable config (same Prompt Agent tab in the admin portal) alongside persona, craft method, blueprint and rules, so they can be tuned without a code change.

## Technical notes

- `supabase/functions/frank-api/promptAgent.ts`: add a `DEFAULT_CONVERSATION_PROTOCOL` block (discovery/final phases, question budget of 2-5, the constrained-brief and revision exceptions, and the `FINAL PROMPT` marker convention); include it in `buildPromptAgentSystem` between craft method and blueprint; reword `DEFAULT_SKILL_BRIEFS`; extend `PromptAgentConfig` / `loadPromptAgentConfig` / config GET+PUT with a `conversation_protocol` column so admins can edit it.
- Migration: add nullable `conversation_protocol text` to `public.prompt_agent_config` (no new tables, existing grants/RLS unchanged).
- `frank-create/src/components/AdminPortal.tsx` (Prompt Agent tab): one more textarea bound to the new field, with the same reset-to-default behaviour.
- `frank-create/src/components/PromptGenerator.tsx`: derive phase from the last assistant message, render the phase chip, add the "Draft it now" action, gate the prompt-action buttons on the final marker, and format numbered question lists. History is already sent in full, so no API-shape change beyond the config field.
- `frank-create/src/styles.css`: styles for the phase chip and question list.
- No changes to generation, Studio, or the models roster.
