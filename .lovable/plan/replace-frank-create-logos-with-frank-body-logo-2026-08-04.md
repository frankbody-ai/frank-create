Replace frank create logos with Frank Body logo

Goal: swap every frank create logo in the frank-create frontend for the uploaded FrankBody_Logo.svg, and clean up the old logo assets.

What will change:

- Sidebar brand block (src/App.tsx): replace the frank create PNG logo with the Frank Body SVG; keep the Design Studio logo underneath it.
- Sign-in card (src/AuthGate.tsx): replace the frank create PNG logo with the Frank Body SVG.
- Favicon (public/favicon.svg): replace the existing frank create favicon with the Frank Body logo.
- App metadata (frank-create/index.html): update the title and description so the browser tab and SEO no longer reference "frank create" or "the art dept.".
- Alt text: update image alt text from "frank create" to "frank body".
- Asset cleanup: remove the old frank-create.png and frank-create.png.asset.json from src/assets/ once they are no longer referenced.

How it will work:

1. Copy the uploaded FrankBody_Logo.svg into public/favicon.svg (favicon exception) and into src/assets/FrankBody_Logo.svg for direct import.
2. Import FrankBody_Logo.svg directly in App.tsx and AuthGate.tsx (same pattern as the Design Studio SVG already in place, so it renders in local dev).
3. Remove the import and usage of frank-create.png in both files.
4. Update index.html `<title>` and `<meta name="description">` to remove frank create / art dept. wording.
5. Delete the unused frank-create.png and its .asset.json pointer.
6. Run the build and capture a screenshot of the sign-in card and sidebar to confirm the logo renders correctly.

Out of scope:

- Internal IDs, filenames, API keys, localStorage keys, and route names that contain "frank-create" are not changed; this plan only touches visible branding.
