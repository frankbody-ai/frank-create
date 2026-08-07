# Reference picker: multi-select, faster thumbnails, keep uploads in view

## 1. Select up to 10 at once
Today clicking a tile adds that one image and closes the modal. Change it to a selection flow:

- Clicking a tile toggles selection (checkmark badge in the corner, highlighted border).
- Footer shows `N of 10 selected` plus **Add references** and **Cancel**.
- Selecting beyond the cap (10, or the active model's lower reference limit if it has one) is blocked with a short inline note instead of silently dropping images.
- Images already in the dock render as "In use" and stay non-toggleable.
- **Add references** attaches all selected images in one pass, then closes.

## 2. Much lighter previews
The grid currently requests 280px / quality 60 variants. Drop that to true icon quality:

- `thumbnailUrl` gains a quality/format argument; picker tiles request ~150px wide, quality ~25, WebP.
- Keep the existing fallback to the original URL when a transformed variant isn't available.
- Tiles stay lazy-loaded, with fixed square boxes so the grid doesn't reflow while loading.

## 3. Uploads land preselected in the same view
Currently uploading closes the picker.

- After choosing files from the computer, the picker stays open.
- The new uploads are inserted at the front of the grid (newest first) and come back **already selected**, so the user just confirms with **Add references**.
- Upload tile shows a brief "Uploading N…" state while it works.

## Technical notes
- `frank-create/src/App.tsx`: new `pickerSelection` state (set of asset ids), reworked `ReferencePicker` grid/footer, `handleReferenceUpload` in the picker no longer closes the modal and merges results into `referenceLibrary` + selection, batch attach loop reusing `useAssetAsReference`.
- `frank-create/src/lib/studio.ts`: extend `thumbnailUrl(url, width, quality, format)`.
- `frank-create/src/styles.css`: selection badge/checkbox styling, footer bar for the picker, tighter tile sizing for the smaller thumbnails.
