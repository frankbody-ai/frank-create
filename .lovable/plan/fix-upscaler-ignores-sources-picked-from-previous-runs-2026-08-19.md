# Fix: upscaler ignores sources picked from previous runs

## What happens now

Picking a source from the picker grid (previous generations / library) sets the tile, but the run fails or the source is treated as missing. Only files uploaded through the upload button work.

## Confirmed cause

The upscaler sends only `source_asset_id`. The backend resolves that id to a stored file path and signs it:

- if the asset row has no `storage_path` (outputs that only kept a provider URL, e.g. anything the 20 MB storage cap skipped), the signed URL is empty and the run returns `missing_source`;
- if the picked asset only exists locally (not yet in the database), the lookup returns `not_found`.

Uploaded files always have a storage path, which is why that path is the only one that works.

## Fix

1. Client (`Enhancer.tsx`): send the picked asset's usable URL alongside the id — `source_url` from `remote_url` / `preview_url` — for both picker-selected and uploaded sources.
2. Backend (`frank-api` enhance handler): when a `source_asset_id` is given, keep using the signed storage URL, but fall back to the request's `source_url` (and to the asset row's stored remote URL) when the path is missing or signing yields nothing, instead of failing with `missing_source`. A missing row with a valid `source_url` also proceeds rather than returning `not_found`.
3. Keep validation: if neither a signed nor a fallback URL exists, still return the existing "Pick a source" error, and keep rejecting media whose type doesn't match the selected mode.

## Notes

- No schema changes, no new models, no layout changes.
- The before/after compare keeps using whichever URL was actually sent, so the pair stays correct.
