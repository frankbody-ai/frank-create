## Problem

1. **Uploads fail on Lovable Cloud.** `uploadImage()` in `frank-create/src/lib/api.ts` POSTs to `/api/upload/image` — a ComfyUI-only endpoint that doesn't exist in the cloud runtime. Every online upload returns non-OK, so the catch branch shows "Reference upload failed. Try again after restarting Comfy."
2. **References never reach the model.** The `invokeBody` sent to the `frank-generate` edge function (App.tsx ~L1919) only includes `prompt`, `count`, `modelId`, `aspect_ratio`, `size`, `thinking_budget` — `reference_images` is dropped, so even a successful upload wouldn't influence the generation.
3. **No composer-level indicator.** Thumbnails only appear inside the dock row. Users don't get a quick visual cue near the "Add references" button telling them how many refs are loaded vs. actively in use for the next round.

## Fix

### 1. Upload references to Supabase Storage (replaces ComfyUI upload)
- Add a migration that creates a public bucket `frank-references` with RLS on `storage.objects` allowing authenticated users to insert/select/delete their own files (path prefix `auth.uid()/...`), and public SELECT so the URL works in `<img>` and in the edge function.
- New helper `uploadReferenceToStorage(file)` in `frank-create/src/lib/api.ts` that uses the Supabase JS client to upload under `${userId}/${sessionId}/${uuid}-${filename}` and returns the public URL.
- In `addReferenceFiles` (App.tsx ~L1642), when `connection === "online"` call the new helper and store the returned URL as both `preview_url` and `file_path` on the local reference asset. Drop the ComfyUI `uploadImage` + `createReference` path. Keep the offline branch as-is.
- Update the failure copy to "Reference upload failed. Please try again." (remove the "restart Comfy" wording).

### 2. Pass references into `frank-generate`
- In App.tsx (~L1919) extend `invokeBody` with `reference_images: selectedReferenceAssets.map(a => a.preview_url).filter(Boolean)`. The edge function already accepts and routes `reference_images` per model (verified in `supabase/functions/frank-generate/index.ts` L227, L513).

### 3. Composer indicator so users can see refs are loaded
- Add a small badge on the "Add references" button showing the count of uploaded refs (e.g. a pink pill with the number), and a paperclip/image glyph next to it.
- Add a compact status chip next to the button: `N loaded · M in use` (or `No references` when empty), styled with the existing `--paper`/`--coffee` tokens.
- Add a subtle check-mark overlay on selected thumbnails in the dock (currently only a blue outline) so the selected vs. loaded distinction is obvious at a glance.

### 4. Verification
- `bun run --cwd frank-create build` (typecheck).
- Playwright: sign in, upload an image, confirm the badge shows "1 loaded · 1 in use", generate on Nano Banana Pro with a prompt like "put this on a beach", confirm the returned image reflects the reference.

## Files touched
- `supabase/migrations/*` — new bucket + policies (via migration tool)
- `frank-create/src/lib/api.ts` — add `uploadReferenceToStorage`
- `frank-create/src/App.tsx` — swap upload path, include `reference_images` in generate body, add badge + status chip + selected-check overlay
- `frank-create/src/styles.css` — badge / chip / check styles
