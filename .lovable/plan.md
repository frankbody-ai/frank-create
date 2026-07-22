## Update the in-app walkthrough

Rewrite `WALKTHROUGH_STEPS` in `frank-create/src/App.tsx` so it matches the current Studio and drops references to disabled features.

### Remove
- Product Shot Lab step and mentions (feature greyed out)
- Video Lab mentions (feature greyed out)
- Comfy graph / raw Comfy escape hatches on the main path
- Right-side "Model summary / drawer" separate steps — settings now live inside the composer card
- Cliff Pack / handoff / readiness pack / Demo Doctor language from the main tour (kept only as a brief Advanced note)

### Add new steps for features shipped since the last version
1. Feedback button (top‑right of center pane) — how anyone reports bugs/ideas with an optional screenshot.
2. Reference dock (14‑slot) + selectable refs per round.
3. Inline composer settings — Model, Aspect, Size (linked to aspect), Count, Quality, and Aspect preview.
4. Model roster — Nano Banana Pro/2, gpt‑image‑2, Reve 2.1, Seedream 5.0 Pro (all via Replicate), plus Thinking Mode (Off/Low/High) where applicable.
5. Frank Body Mode + the 5 brand prompt presets and the "+ New preset" tile in the preset library at the bottom of the right menu.
6. Generate flow — pending card appears immediately, Stop to cancel, parallel rounds allowed.
7. Rounds thread — newest on top, "New" badge, per‑round Retry / Retry missing / Retry safely, expandable error panel, copy ID, timestamp, delete round.
8. Review desk — click any image to expand (lightbox), approve/reject/favorite sync between center and right panel, audit trail recorded.
9. Sessions — rename in place, auto‑naming from first prompt, session switcher.
10. Account & Admin — profile/sign‑out, and (admins only) the Admin portal for user roles and feedback triage.
11. Advanced (short) — provider keys, diagnostics, health page; explicitly noted as off the normal creative path.

### Housekeeping
- Update the `WalkthroughTarget` union to match the new steps (drop `handoff-pack`, `model-settings-drawer`, `model-output-controls`, `frank-mode-toggle` if merged into the composer step; add targets like `feedback-button`, `reference-dock`, `session-controls`, `admin-entry`).
- Update the corresponding `data-walkthrough` anchor attributes in the JSX where targets change.
- Remove `openSettings` / `openAdvanced` side effects that pointed at the retired right‑side drawers.
- Keep the walkthrough launcher and popover UI unchanged.

### Out of scope
- No changes to business logic, generation, or backend.
- No visual redesign of the popover itself.
