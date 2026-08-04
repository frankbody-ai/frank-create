# frank body — Design Studio

A React + Vite single-page app for generating and reviewing brand imagery and video, backed by Lovable Cloud.

- App source: `frank-create/`
- Backend: Lovable Cloud (`supabase/functions/frank-api`, `supabase/migrations`)
- Brand assets: `brand guidelines/`

## Local development

```bash
npm run dev     # serves the app on port 8080
npm run build   # production build
```

Tests live in `frank-create/src`; run them with `npm --prefix frank-create test`.
