# Reference picker: centering, fast thumbnails, and upload history

Three fixes to the "Add references" modal.

## 1. Centre the modal

The picker reuses the shared lightbox shell, which is a grid centred inside the page — when the studio page is scrolled or has an ambient overflow it lands off-centre (as in the screenshot).

- Give the picker its own dedicated overlay class instead of piggy-backing on the image lightbox, positioned fixed with flex centring on both axes, and a max height of 86vh with internal scrolling.
- Lock background scroll while the picker is open so the overlay can't drift.
- Move the close button inside the panel padding (currently it sits at a negative offset and can clip off screen).

## 2. Render icon-quality thumbnails

Right now every tile loads the full-resolution generated image, so a library of dozens of 4K images takes ages to paint.

- Request small transformed variants for tiles: for images served from the project's storage bucket, use the image-transform endpoint with a ~280px width and quality ~60; fall back to the original URL when the source isn't a storage URL (data URLs, external provider URLs).
- Add `loading="lazy"`, `decoding="async"`, explicit tile dimensions, and a light placeholder background so the grid lays out instantly and images stream in.
- Full-size URLs are still used when an image is actually attached as a reference — only the picker grid uses thumbnails.

## 3. Show previous uploads, not just approved generations

Today the picker only lists approved non-reference images, so previously uploaded references have to be re-uploaded.

- Load two groups: approved generated images, and previously uploaded reference images belonging to the signed-in user (most recent first, de-duplicated).
- Render them as two labelled sections in the same dense grid: "Approved" and "Your uploads", with the "Upload from computer" tile first.
- Reusing an upload attaches the existing stored file — no re-upload round trip.

## Technical notes

- `frank-create/src/App.tsx`: split the reference library state into approved + uploaded lists, extend the loader to fetch `kind: "reference"` assets, add a `thumbUrl()` helper, restructure the picker markup into sections.
- `frank-create/src/lib/api.ts`: add a listing helper for prior uploaded references (scoped by the authenticated user via existing RLS).
- `frank-create/src/styles.css`: new `.reference-picker-overlay` centring rules, section headers, lazy-tile placeholder styling; remove the lightbox coupling for this modal.
