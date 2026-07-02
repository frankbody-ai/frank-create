## Deviation analysis: current app vs Cliff's original `frank-body-image-studio`

Cliff's repo is a single 967-line `nb-studio-v4.html` — vanilla JS, no build, no backend, browser-side Gemini calls with a user-supplied API key. We built a full TanStack + Lovable Cloud + Supabase edge-function platform on top of the same idea. Below is what he had, what we kept, what we added, and what we lost.

### 1. Kept and improved (deviations that are net-positive)

| Original | Current | Verdict |
|---|---|---|
| Sessions in `localStorage` | Sessions persisted in Supabase + storage bucket + RLS per user | Improved |
| API key in `sessionStorage` | Lovable AI gateway, no user keys needed | Improved |
| No auth | Google OAuth via managed broker | Added |
| CSS variables for palette + inlined Pitch font | Full brand token system, Founders Grotesk + Pitch, concern-category colour tokens | Improved |
| 5 hardcoded presets | Editable preset library with add/delete tile, localStorage-backed | Improved |
| AR + size independent | AR ↔ size dropdown correctly linked per model | Improved |
| No export | JSON/CSV handoff manifest, schema validation, SSE progress, resume-from-stage, review board with approve/reject + audit trail | Added |
| — | Status banner, /health page, error toast, retry, cancel | Added |
| — | Brand kit editor persisted in DB | Added |
| — | Video storyboard stub with desktop-only notice | Added |

### 2. Lost / regressed from Cliff's MVP (need to restore)

These were in his working file and are either missing or half-wired in ours:

1. **Thinking Mode toggle** (Low = 1 000 tokens / High = 5 000, NB Pro only). Not present in our UI or `frank-generate` edge function.
2. **Image count selector (1 / 2 / 4)** running as parallel `Promise.allSettled` calls per turn. Ours generates a single image per turn.
3. **Reference images up to 14** with 7 MB per-file cap and thumbnail row under the textarea. Ours accepts fewer / less obvious flow.
4. **Frank Body Mode toggle** that literally prepends `"FRANKBODY "` to every prompt. Toggle exists in code paths but no user-facing switch on the composer.
5. **Edit-image flow** — click any generated image → lightbox with `✏️ Edit this` + `↓ Download` → edit banner appears above textarea with the source thumbnail, an edit-model selector, and up to 4 edit-reference slots. Ours only has a delete cross on rounds; no per-image edit-continuation.
6. **Lightbox** full-screen viewer with model/AR/size tags, Escape to close.
7. **Skeleton loading cards + animated grid** for each in-flight image.
8. **Header model pill + API-key status dot** (in our case, a "gateway ready" indicator would replace the key dot).
9. **Cmd/Ctrl+Enter to Generate** keyboard shortcut.
10. **Session auto-naming** from the first prompt (we require manual naming).
11. **The 5 baked Frank Body presets** verbatim (Clean Ecom, FB Lifestyle, FB Model Image, Product Texture, Retail Mock) with the exact prompt bodies. Our library has generic presets, not Cliff's copy.
12. **"Coming soon" model buttons** for GPT-Image-2, FLUX 1.1 Pro Ultra, Reve-2.0, MAI-Image-2.5, Grok Imagine, Ideogram 4.0 — visible but disabled, so users see the roadmap. We only expose Nano Banana + GPT + FLUX and hide the rest.
13. **Replicate (or equivalent) router** for the non-Google models. Cliff explicitly asked for this on the call ("Replicate has them all"). We route everything through Lovable AI Gateway, which doesn't cover Reve / MAI / Grok / Ideogram — so those buttons would 501 today.

### 3. Also in the call transcript but not in his repo

Things Cliff said on the call that aren't in either codebase yet — treat as backlog, not regressions:

- Replicate as the primary router for non-Google models, with official OpenAI + Google APIs kept direct.
- AGUI-style conversational canvas for iterative edits (he flagged as "nice to have, don't overkill").
- Cliff shipping his HTML to GitHub as the seed — we already forked past that; not actionable.

### 4. Proposed remediation plan (only the lost MVP items)

Scope: restore parity with Cliff's MVP without touching the review-board / handoff / brand-kit work we added. All frontend + one edge-function change.

**A. Composer parity (`frank-create/src/App.tsx`, `presets.ts`, `styles.css`)**
1. Add **Frank Body Mode** switch to the right panel; when on, prepend `FRANKBODY ` to the prompt sent to `frank-generate`.
2. Add **Thinking Mode** segmented control (Off / Low / High) — visible only when the active model is `gemini-3-pro-image-preview`. Pass `thinkingBudget` (1 000 / 5 000) through to the edge function.
3. Add **Image count** selector (1 / 2 / 4). Loop `Promise.allSettled` on the client (or add a `count` param to the edge function) and render N cards in one round.
4. Raise reference-image cap to **14**, enforce 7 MB per file, show a compact thumb row with remove buttons and a live counter (`refs.length / 14`).
5. Add **Cmd/Ctrl + Enter** shortcut on the prompt textarea.
6. Add **session auto-name** from the first prompt (first ~40 chars) when the user hasn't set one.
7. Replace generic seed presets with Cliff's 5 verbatim presets (Clean Ecom, FB Lifestyle, FB Model Image, Product Texture, Retail Mock) as read-only defaults; keep the "+" tile for custom presets on top.

**B. Lightbox + edit-continuation (`frank-create/src/App.tsx`, new `components/Lightbox.tsx`)**
1. New `<Lightbox>` overlay: click any generated image → full-screen with model/AR/size chips, `↓ Download`, `✏️ Edit this`, `×`/Esc to close.
2. `Edit this` → sets an `editingAssetId` state that renders an inline "Editing this image" banner above the composer, with the source thumb, an edit-model dropdown, and up to 4 edit-reference slots. Submitting posts a new turn with the source image as an `inlineData` reference plus the instruction prompt.

**C. Loading + header polish**
1. Skeleton cards while a round is in flight (N cards matching the count selector).
2. Header pill showing the active model name; small status dot fed by `/health` (green = gateway ok, amber = degraded, red = down).

**D. Model roster (`presets.ts` + `frank-generate/index.ts`)**
1. Show Cliff's full "coming soon" list (GPT-Image-2, FLUX 1.1 Pro Ultra, Reve-2.0, MAI-Image-2.5, Grok Imagine, Ideogram 4.0) as visible-but-disabled tiles with a "Coming soon" badge, so the roadmap matches his UI.
2. Wire the ones Lovable AI Gateway already exposes (GPT-Image-2, FLUX) as enabled; keep the rest disabled until we add a Replicate connector (separate task).

### Not in scope for this pass

- Replicate router integration (needs a Replicate API key + new adapter — call it out for a follow-up).
- AGUI conversational canvas.
- Any changes to review board, handoff, brand kit, or audit trail.

### Technical notes

- `frank-generate` needs three new inputs: `frank_body_mode: boolean`, `thinking_budget?: number`, `count?: 1|2|4`. Loop internally for `count > 1` and return an array of assets so the client renders them in one round.
- The 14-ref cap should be enforced on both client (UX) and edge function (safety). Total payload stays under Gemini's inline-data ceiling by rejecting > 7 MB per file.
- Cliff's presets are copyrighted brand prompts; keep them in `presets.ts` as `readonly: true` so the delete button hides for those tiles.
- Coming-soon models: gate by an `enabled: boolean` on the model definition; disabled tiles render with reduced opacity and a tooltip.
