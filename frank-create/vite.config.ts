import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  envDir: "..",
  plugins: [mcpPlugin(), tanstackStart(), react()],
  ssr: {
    // TanStack Start imports this npm alias from its server core. Lovable's
    // production runtime cannot resolve package aliases at runtime, so keep it
    // inside the generated worker bundle.
    noExternal: ["h3-v2"],
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
