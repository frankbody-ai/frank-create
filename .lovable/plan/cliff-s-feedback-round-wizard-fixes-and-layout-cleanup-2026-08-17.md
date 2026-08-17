# Cliff's feedback round: wizard, fixes and layout cleanup

Ten items, grouped. Each is scoped to the surface named.

## 1. Prompt Generator becomes a real wizard

Today the agent decides ad hoc whether to ask questions and how many, so the experience is inconsistent (free-text questions, sometimes none).

New flow:

- After the brief (and any attached references), the agent returns a **structured question set**: minimum 5, maximum 10 questions. Never fewer than 5.
- Each question renders as a card with **4 choices**: A, B, C are agent-generated options (each with a short label plus a one-line rationale), **D is always "Something else"** and opens a free-text field.
- Immersive one-question-at-a-time wizard: progress bar ("Question 3 of 7"), large option cards with keyboard support (A/B/C/D keys, Enter to advance), Back to revise an earlier answer, and a slide transition between questions.
- A review step at the end lists every answer with an Edit link, then "Generate prompt".
- Skip-ahead stays available: "Draft it now" fills remaining questions with sensible defaults and the final prompt states the assumptions.
- The final prompt renders as today (fenced block, Copy prompt / Use in Studio).
- After the final prompt, follow-up refinements stay conversational — the wizard does not restart unless the user starts a new brief.

## 2. Feedback box gets stuck after a few characters

Confirmed cause: the shared modal's focus-trap effect re-runs on every render because it depends on a callback that is recreated each keystroke. On cleanup it returns focus to the trigger, then focuses the modal's close button — so typing stops after a character or two. Fix in the modal itself (stable handler ref, focus only when it opens), which also fixes every other modal in the app.

## 3. Image preview buttons unreadable

In the full-screen viewer, "Edit this" and "Save" inherit near-invisible contrast on the dark surface, while Approve/Reject read fine. All four buttons get an explicit high-contrast pair on the inverse surface, with Approve/Reject keeping their success/critical accent.

## 4. Delete the top metric bar

Remove the "Rounds this session / Picks delivered / Approved picks / Favourites" strip entirely and pull the studio content up into the space it occupied.

## 5. Compare = one run, two models

Instead of two separate rounds sharing a group id, a side-by-side generation produces **one round card** whose picks carry per-model tags. The card header shows one prompt and one timestamp; each slot is labelled with its model name and the effective settings actually used (aspect, size, and any auto-snapped value), with per-side retry and per-side status when one model fails.

## 6. Enter sends, Shift+Enter newlines

Applies to the Prompt Generator composer, the Studio prompt box, the wizard's free-text option, and the feedback message field: Enter submits, Shift+Enter inserts a line break. (Cmd/Ctrl+Enter keeps working.)

## 7. Reference picker loads 10 at a time

The Add reference grid loads only the 10 most recent items, with pagination controls (Previous / Next, "1–10 of N") for the rest, so the modal opens fast. Selections persist across pages.

## 8. Remove "App health" from the side menu

The nav entry goes; the /health route stays reachable by URL for diagnostics.

## 9. Sign out moves to the bottom of the left menu

Removed from the top-right bar and placed in the side-nav footer, under Settings.

## Technical notes

- `PromptGenerator.tsx`: split into a wizard container plus `PromptWizard` (question card, progress, review step) and the existing chat transcript for post-final refinement. Question sets come from the agent as a JSON block (`{"questions":[{id,question,options:[{key,label,hint}]}]}`) parsed client-side; a validation step pads/truncates to the 5–10 range.
- `supabase/functions/frank-api/promptAgent.ts`: extend the conversation protocol so discovery returns that JSON contract (5–10 questions, exactly 3 generated options each, D reserved for free text), and the final phase consumes the collected answers. The protocol text stays editable in the Admin portal's Prompt Agent tab.
- `ds/components/overlays/Modal.tsx`: hold `onClose` in a ref, key the focus effect on `open` only.
- `app.css`: `.lightbox-actions button` explicit inverse-surface colours; remove `.metric-strip` rules; wizard styles (`.prompt-wizard*`); reference-picker pagination row.
- `App.tsx`: delete the `metric-strip` card; `handleGenerate` compare branch writes a single turn with two model entries and per-asset model metadata instead of two turns under `compare_group`; reference picker gains a page offset with the design system `Pagination` component; Enter/Shift+Enter handlers on the studio composer.
- `nav.ts`: drop the `health` nav entry from `NAV_FOOTER` (route resolution untouched).
- `Shell.tsx` / `SideNav`: sign-out action rendered in the nav footer, removed from `TopBar` actions.
- No schema changes; compare grouping metadata in `lib/types.ts` / `lib/studio.ts` is simplified to per-asset model tagging.
