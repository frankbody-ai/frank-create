## Goal

Add a **Preset** dropdown next to the Count field in the composer. Selecting a preset appends its prompt text as a second paragraph to whatever the user has typed. The appended paragraph stays visible and fully editable in the textarea. Swapping to a different preset removes the previously-appended paragraph and appends the new one.

## Behavior spec

- **Location**: inline in the composer settings row, right after the Count control.
- **Options**: every entry from `promptPresets` (the same list shown in the preset library card), plus a `"None"` option at the top.
- **Default**: `"None"` on a fresh session. No preset text is injected automatically anymore.
- **On select preset X**:
  1. If a preset paragraph is currently appended, strip it from the textarea.
  2. Append `\n\n` + preset X's prompt to whatever remains.
  3. Remember which preset is "attached" so the next swap knows what to strip.
- **On select "None"**: strip the attached preset paragraph, leave the rest of the user's text intact.
- **If the user edits the appended paragraph**: their edits win. On the next swap we still strip the currently-attached block by matching the stored snapshot; if the snapshot no longer matches (user edited it heavily), we leave their text alone and just append the new preset — better to keep user edits than to eat them.
- **Frank Body Mode toggle**: unchanged, still just metadata for now (out of scope for this task).

## Technical notes

- File: `frank-create/src/App.tsx`. The composer settings row is around the existing Aspect / Size / Quality / Count controls (grep for the Count select).
- Track two pieces of state:
  - `attachedPresetKey: string | null` — which preset's text is currently in the textarea.
  - `attachedPresetSnapshot: string | null` — the exact `\n\n<preset.prompt>` string we appended, used to strip it cleanly.
- New handler `attachPreset(newKey)`:
  - `base = prompt.endsWith(attachedPresetSnapshot) ? prompt.slice(0, -attachedPresetSnapshot.length) : prompt`
  - if `newKey === "none"`: `setPrompt(base.trimEnd()); clear attached state`
  - else: `snapshot = "\n\n" + preset.prompt; setPrompt(base.trimEnd() + snapshot); store key + snapshot`
- Keep the existing preset library card (bottom-right) working; clicking a card there should call the same `attachPreset` handler so both surfaces stay in sync (and the current-only-if-empty behavior in `selectPreset` gets replaced by this always-append behavior).
- `selectedPresetKey` (used for `preset_key` metadata on the turn) tracks `attachedPresetKey` — sends `null`/undefined when None.

## UI

- Dropdown styled to match the existing Count/Aspect selects in that row.
- Label: `Preset`.
- Option labels come from `preset.label`; first option is `— None —`.

## Out of scope

- No server-side prompt injection; the preset text becomes part of the user's editable prompt, which is already what the edge function sends to Replicate. That's the whole fix for "presets weren't reaching Replicate."
- Frank Body Mode wiring stays as-is.
- No migration; `preset_key` column already exists on turns.