import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  envDir: "..",
  plugins: [mcpPlugin(), tanstackStart(), react()],
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
