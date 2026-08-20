// `@lovable.dev/vite-tanstack-config` already supplies the plugins this stack needs —
// tanstackStart, viteReact, tailwindcss, tsConfigPaths, VITE_* env injection, the `@`
// alias, and (on production builds) nitro with the `cloudflare-module` preset. Do NOT
// add those manually: duplicate plugins break the app.
//
// Nitro is the step that inlines every dependency into the deployed worker and writes
// `dist/server/wrangler.json`. Without it, `dist/server/server.js` keeps bare imports
// that the Cloudflare runtime cannot resolve, and every route 502s with
// `No such module "..."` before any app code runs.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  // Emits the MCP protocol, OAuth metadata and REST companion routes under src/routes.
  plugins: [mcpPlugin()],
  // Explicit opt-in: with the default the build silently skips nitro if the peer dep
  // goes missing, which is exactly how the unbundled-worker regression happened.
  nitro: true,
});
