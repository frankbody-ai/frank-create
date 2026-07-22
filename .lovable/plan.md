## Goal
Prevent submitting unsupported settings (e.g. any `size` for Reve 2.1, `4K` for Seedream/Nano Banana 2, non-schema aspect ratios) and surface clear inline errors next to the offending field before the request is sent.

## Scope
Frontend-only. `frank-create/src/App.tsx`, `frank-create/src/lib/studio.ts`, `frank-create/src/styles.css`. No backend changes.

## Approach

1. **Central validator in `studio.ts`** — add `validateStudioSettings(model, settings)` returning `{ aspect?: string; size?: string; count?: string }` of inline error strings. Rules:
   - `aspect_ratio` must be in `model.allowed_aspect_ratios`.
   - `image_size`: if `model.allowed_image_sizes` is empty (Reve), any non-empty value is an error ("This model picks resolution from aspect — leave size empty"); otherwise must be in `allowed_image_sizes` AND pass `sizeMatchesAspect`.
   - `count` must be 1–4 and ≤ `model.max_batch` if present.
   - Reference count vs `reference_image_limit` (already checked, keep as-is but surface via same shape).

2. **UI wiring in `App.tsx`**
   - Compute `const fieldErrors = useMemo(() => validateStudioSettings(selectedModel, settings), [...])`.
   - Under each of the two Aspect/Size/Count `setting-row` blocks (lines ~3052 and ~4280), render `<p className="field-error" role="alert">{fieldErrors.size}</p>` etc. when set.
   - Add `aria-invalid` and `data-invalid` to the offending `<select>`/`<input>` for red-border styling.
   - When the model has no `allowed_image_sizes` (Reve), hide the Size `<label>` entirely instead of showing an empty dropdown, and show a small helper: "Size auto-selected from aspect".
   - In `handleGenerate`, before `buildTurnRequest`, run the validator; if any error exists, `setStatusText("Fix the highlighted fields.")`, focus the first invalid control, and return without calling the function.

3. **Styling in `styles.css`**
   - `.field-error { color: var(--danger, #c0362c); font-size: 12px; margin-top: 4px; }`
   - `select[aria-invalid="true"], input[aria-invalid="true"] { border-color: var(--danger); outline-color: var(--danger); }`
   - `.field-hint { font-size: 12px; opacity: 0.7; }`

4. **Tests** — extend `frank-create/src/lib/studio.test.ts` with cases:
   - Reve model + any size → size error.
   - Seedream + `4K` → size error.
   - Nano Banana 2 + `21:9` → aspect error.
   - Valid combo → no errors.

## Technical Notes
- `normalizeStudioSettingsForModel` already coerces invalid values on model switch; validator is the *pre-submit* gate for user-edited states and future config drift.
- Keep validator pure so it can be reused by future server-side echo if needed.
- No changes to `presets.ts` or edge functions.
