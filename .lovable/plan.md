
# Unblock Cliff handoff — fix image generation backend

Tester's blocker root-caused. Edge function logs show the exact DB error every call:

```
[frank-api] { code: "428C9", message: 'cannot insert a non-DEFAULT value into column "seq"',
  details: 'Column "seq" is an identity column defined as GENERATED ALWAYS.' }
```

The catch handler then does `String(err)` on a Supabase error object → `"[object Object]"` → the frontend sees the generic 500. Every `/inference/turn` POST is failing before it ever reaches the AI gateway. Independently, `handleInference` ignores `body.model` and settings, so even after the DB fix Nano Banana Pro / NB 2 would still all resolve to Gemini 2.5 Flash Image 1024×1024 — matching what the tester saw at `/models`.

Two files change: `supabase/functions/frank-api/index.ts` and `frank-create/src/lib/presets.ts`. No schema migration. No frontend logic change beyond aligning what the model picker advertises.

## Fixes in `supabase/functions/frank-api/index.ts`

1. **Stop writing `seq`.** `messages.seq` is `GENERATED ALWAYS AS IDENTITY`. Remove the max-seq lookup (lines 292–295) and the `seq: nextSeq` field on the insert (line 305). Read the DB-assigned value back with `.select("seq").single()` and use it in the returned `rowToTurn` payloads (lines 326 and 374).

2. **Serialize errors properly.** Replace `String(err)` in the outer catch (line 945) and the inference failure branch (line 329) with a helper that returns `err.message ?? err.error_description ?? JSON.stringify(err)`. No more `"[object Object]"`.

3. **Honor `body.model` and `body.settings` in `handleInference`.** Add a model map matching what `frank-generate` already uses:

    ```text
    nano-banana-pro / google-nb-pro   → google/gemini-3-pro-image-preview
    nano-banana-2   / google-nb-2     → google/gemini-3.1-flash-image-preview
    frank-local-comfy                 → google/gemini-2.5-flash-image-preview (cloud fallback)
    openai-gpt-image-2                → openai/gpt-image-2 (via /images/generations)
    ```

    Extend `lovableImage(prompt, refs, opts)` with `{ gatewayModel, aspectRatio, size, thinkingBudget }`. For Gemini models append aspect/size hints to the prompt (same pattern as `frank-generate`) and map `thinking_budget` → OpenRouter `reasoning.effort` for `gemini-3-pro`. For `openai/gpt-image-2` route to `/v1/images/generations` with the sanitized size list (`1024x1024`, `1536x1024`, `1024x1536`).

4. **Stop hardcoding `nano-banana-pro`.** Use the resolved model id on the asset row (`model_key`), on `providerPayload.model`, and let `rowToTurn` read the model from `settings_snapshot_json.model` rather than defaulting.

5. **Surface upstream failures without hiding them.** Keep the existing `throw new Error(\`Lovable image ${r.status}: ${await r.text()}\`)` — that already gives a real message once fix #2 lands.

## Model catalog alignment in `frank-create/src/lib/presets.ts`

The UI advertises "Nano Banana Pro" and "Nano Banana 2" as 4K. Lovable AI Gateway's Gemini image models don't expose a 4K knob; the earlier `frank-generate` just hinted "4K" inside the prompt string, which the model does not honor as a real output resolution. Two options:

- **A — recommended:** drop `4K` from the size list for both Nano Banana models. Keep `1K` and `2K` as prompt hints only, or reduce to a single "Auto" option. Update the tile subtitle to remove the "4K" claim so the README and picker match reality.
- B — leave the labels, add a footnote in the model card that size is a hint not a guarantee. Weaker; tester will flag it again.

Take A. `openai-gpt-image-2` keeps its real size list.

## Verification (after switch to build mode)

1. Deploy the edge function change.
2. `supabase--curl_edge_functions` POST `/frank-api/inference/turn` with `{ prompt: "test", model: "nano-banana-pro", settings: { aspect_ratio: "1:1" } }` — expect 200 with an asset URL, not 500.
3. Repeat for `nano-banana-2` and `openai-gpt-image-2`.
4. Confirm `messages.seq` auto-increments (read one row back).
5. Confirm a forced upstream failure now returns a readable `error.message` (e.g. temporarily send a bogus model id → response should say `Lovable image 400: ...` not `[object Object]`).
6. Re-run the tester agent's Phase 2/3 loop against the published URL.

## Out of scope for this fix

- Real 4K output (would require a different model family; not on the Cliff MVP contract).
- Schema change to make `seq` non-identity — the identity column is fine; only our code was wrong.
- FC-008 / FC-010 / FC-011 (already flagged deferred).

## Cliff handoff gate stays the same

Do not grant access until Phase 1–4 Playwright run comes back green **and** the manual Cliff Pack ZIP secret scan passes. This plan only unblocks Phase 2 onward; it doesn't change the gate.
