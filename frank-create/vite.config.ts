import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig({
  envDir: "..",
  plugins: [react(), mcpPlugin()],
  build: {
    outDir: "../dist",
    emptyOutDir: true
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts"
  }
});
