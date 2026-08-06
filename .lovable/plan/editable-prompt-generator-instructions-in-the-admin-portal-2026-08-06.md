# Editable Prompt Generator instructions in the Admin portal

Right now everything the Prompt Generator agent runs on is hard-coded inside the backend function: the always-on "Craft Image Prompts" method, the Production Prompt Blueprint, the base persona, and the six focus skills (Brief → prompt, Variations, Product shot, Lifestyle & model, Video prompt, Critique & fix). The skill chip labels and hints are separately hard-coded in the frontend, so they can drift from the backend text.

This adds a third Admin portal tab where an admin can read and edit that text live, without a code change.

## What the admin gets

A new **Prompt agent** tab in the Admin portal (next to Users and Feedback tasks), visible only to admins:

- **Base instructions** section with three large editors:
  - Persona / role
  - Always-on craft method
  - Production prompt blueprint
- **Skills** list — one card per skill with: display label, chip hint (shown under the chips in the Prompt Generator), and the full skill instruction the model receives.
- Per-editor **Reset to default** plus a global **Reset all to defaults** (the current shipped text becomes the stored default, so reset is always available).
- **Save** with a saved/error status line and a "last edited by / at" stamp.
- Add a new skill and disable/remove a custom skill, so the chip row in the Prompt Generator can be extended without code.

Saving takes effect on the next message sent in the Prompt Generator — no redeploy.

## Behaviour details

- The Prompt Generator's chip row, labels and hints are loaded from the stored config, falling back to the built-in defaults if the config has never been saved or the fetch fails. The agent never runs with empty instructions.
- Editing is admin-only; every signed-in user reads the active config.
- Keeps running on GPT-5.6-sol; only the instruction text becomes data.

## Technical section

**Database (one migration)**
- `public.prompt_agent_config`: `id` (single-row, default 1), `persona text`, `craft_method text`, `blueprint text`, `updated_by uuid`, `updated_at timestamptz`.
- `public.prompt_agent_skills`: `key text primary key`, `label text`, `hint text`, `instruction text`, `sort_order int`, `is_active boolean default true`, `updated_at`.
- GRANTs: `SELECT` to `authenticated`, `ALL` to `service_role` on both. RLS enabled; SELECT policy `to authenticated using (true)`; INSERT/UPDATE/DELETE policies gated on `has_role(auth.uid(), 'admin')`.
- Seed both tables with literal INSERTs containing the exact text currently in `supabase/functions/frank-api/index.ts` so the first load matches today's behaviour.

**Backend (`supabase/functions/frank-api/index.ts`)**
- Keep the existing constants as `DEFAULT_*` fallbacks.
- In the `/prompt-agent` handler, read the config + active skills rows first; use DB values when present, otherwise defaults. Assemble the system message exactly as today from the resolved values.
- New `GET /prompt-agent/config` returning `{ persona, craftMethod, blueprint, skills[] }` for both the Prompt Generator chips and the admin editor.
- New `PUT /prompt-agent/config` (admin-only, verified via `has_role` on the caller) that upserts the config row and the skills rows.

**Frontend**
- `src/lib/promptAgentConfig.ts` — typed fetch/save helpers plus the built-in defaults used as fallback.
- `src/components/admin/PromptAgentTab.tsx` — the editor UI; `AdminPortal.tsx` gains the third tab (and `?tab=prompt-agent` deep link).
- `src/components/PromptGenerator.tsx` — load skills from the config helper instead of the local `SKILLS` array, keeping the array as the fallback.
- Styling reuses existing `admin-portal-*` classes with a few additions in `src/styles.css`.
